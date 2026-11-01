import { describe, it, expect, vi } from "vitest";
import {
  readCampaignSelection,
  saveCampaignSelection,
} from "../lib/crm/lead-plus/server/meta-campaign-selection.mjs";
import { processMeta } from "../lib/crm/lead-plus/server/integrations.mjs";
const env = {
  META_PAGE_ACCESS_TOKEN: "synthetic-only-token",
  META_GRAPH_VERSION: "v26.0",
  META_PAGE_IDS: "123",
  META_REQUIRE_FORM_ROUTE: "1",
  META_FORM_ROUTES_JSON: "[]",
};
const job = {
  id: "job",
  external_id: "1000",
  form_id: "2000",
  ad_id: "3000",
  page_id: "123",
  attempts: 1,
};
const metadata = {
  id: "1000",
  form_id: "2000",
  ad_id: "3000",
  campaign_id: "10",
  campaign_name: "Synthetic campaign",
  is_organic: false,
};
const masters = [
  { id: "admin", role: "admin", active: true },
  { id: "manager", role: "manager", active: true },
  { id: "broker", role: "broker", active: true },
  { id: "inactive", role: "admin", active: false },
];
function fixture(
  options: {
    ids?: string[];
    metadata?: Record<string, unknown>;
    form?: Record<string, unknown>;
    users?: typeof masters;
    afterMetadata?: () => void;
    afterContact?: () => void;
  } = {},
) {
  let ids = options.ids ?? ["10"],
    claimed = false;
  const fieldsRequested: string[] = [];
  const store = {
    listResources: vi.fn(async (kind: string) =>
      kind === "settings"
        ? [{ id: "meta-campaign-selection", campaign_ids: ids, version: 1 }]
        : (options.users ?? masters),
    ),
    claimMeta: vi.fn(async () => (claimed ? null : ((claimed = true), { ...job }))),
    ignoreMeta: vi.fn(async () => {}),
    failMeta: vi.fn(async () => {}),
    completeMeta: vi.fn(async () => {}),
    createMetaLead: vi
      .fn<
        (
          input: Record<string, unknown>,
          key: string,
          owners: Set<string>,
        ) => Promise<{ lead: { id: string } }>
      >()
      .mockResolvedValue({ lead: { id: "saved" } }),
  };
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input)),
      fields = url.searchParams.get("fields") || "";
    fieldsRequested.push(fields);
    if (url.pathname.endsWith("/2000"))
      return Response.json(
        options.form ?? { id: "2000", page_id: "123", name: "Synthetic recruitment" },
      );
    const source = { ...metadata, ...options.metadata };
    if (fields.includes("field_data")) {
      options.afterContact?.();
      return Response.json({
        ...source,
        field_data: [{ name: "email", values: ["synthetic@example.invalid"] }],
      });
    }
    options.afterMetadata?.();
    return Response.json(source);
  });
  return {
    store,
    fetcher,
    fieldsRequested,
    setIds: (value: string[]) => {
      ids = value;
    },
  };
}
describe("Meta campaign selection policy", () => {
  it("starts paused and saves only catalog-authorized unique campaign IDs with CAS", async () => {
    expect(await readCampaignSelection({ listResources: async () => [] })).toEqual({
      campaign_ids: [],
      version: 0,
    });
    let current = { campaign_ids: [] as string[], version: 0 };
    const store = {
      saveCampaignSelectionCAS: vi.fn(async (ids: string[], version: number) => {
        if (version !== current.version) throw Error("conflict");
        current = { campaign_ids: ids, version: version + 1 };
        return current;
      }),
    };
    expect(
      await saveCampaignSelection(store, { campaign_ids: ["10"], version: 0 }, [
        { id: "10", name: "trusted metadata" },
      ]),
    ).toEqual({ campaign_ids: ["10"], version: 1 });
    await expect(
      saveCampaignSelection(store, { campaign_ids: [], version: 0 }, []),
    ).rejects.toThrow("conflict");
    expect(await saveCampaignSelection(store, { campaign_ids: [], version: 1 }, [])).toEqual({
      campaign_ids: [],
      version: 2,
    });
    for (const input of [
      { campaign_ids: ["99"], version: 2 },
      { campaign_ids: ["10", "10"], version: 2 },
      { campaign_ids: ["10"], version: 2, name: "forged" },
      { campaign_ids: ["10"], version: -1 },
    ])
      await expect(saveCampaignSelection(store, input, [{ id: "10" }])).rejects.toThrow();
  });
  it("does not fetch any lead metadata or contact while no campaign is selected", async () => {
    const f = fixture({ ids: [] });
    await processMeta(f.store, env, f.fetcher);
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.store.ignoreMeta).toHaveBeenCalledWith("job");
    expect(f.store.createMetaLead).not.toHaveBeenCalled();
    expect(f.store.failMeta).not.toHaveBeenCalled();
  });
  it("fetches only metadata for unselected, missing-campaign and organic leads", async () => {
    for (const changes of [
      { campaign_id: "99" },
      { campaign_id: undefined },
      { is_organic: true },
    ]) {
      const f = fixture({ metadata: changes });
      await processMeta(f.store, env, f.fetcher);
      expect(f.fieldsRequested).toHaveLength(1);
      expect(f.fieldsRequested[0]).not.toContain("field_data");
      expect(f.store.ignoreMeta).toHaveBeenCalled();
      expect(f.store.createMetaLead).not.toHaveBeenCalled();
      expect(f.store.failMeta).not.toHaveBeenCalled();
    }
  });
  it("imports only the selected campaign even when two campaigns share a form", async () => {
    const selected = fixture();
    await processMeta(selected.store, env, selected.fetcher);
    expect(selected.store.createMetaLead).toHaveBeenCalledOnce();
    expect(selected.store.createMetaLead.mock.calls[0]).toMatchObject([
      {
        source: "facebook",
        product: "Synthetic recruitment",
        attribution: { campaign_id: "10", campaign_name: "Synthetic campaign", form_id: "2000" },
      },
      "meta:1000",
      new Set(["admin", "manager"]),
    ]);
    expect([
      ...((selected.store.createMetaLead.mock.calls[0] as unknown[])[2] as Set<string>),
    ]).toEqual(["admin", "manager"]);
    const other = fixture({ metadata: { campaign_id: "11" } });
    await processMeta(other.store, env, other.fetcher);
    expect(other.store.createMetaLead).not.toHaveBeenCalled();
    expect(other.fieldsRequested.every((fields) => !fields.includes("field_data"))).toBe(true);
  });
  it("rechecks selection before contact and before persistence", async () => {
    const first: ReturnType<typeof fixture> = fixture({ afterMetadata: () => first.setIds([]) });
    await processMeta(first.store, env, first.fetcher);
    expect(first.fieldsRequested).toHaveLength(1);
    expect(first.store.createMetaLead).not.toHaveBeenCalled();
    const second: ReturnType<typeof fixture> = fixture({ afterContact: () => second.setIds([]) });
    await processMeta(second.store, env, second.fetcher);
    expect(second.store.createMetaLead).not.toHaveBeenCalled();
    expect(second.store.ignoreMeta).toHaveBeenCalled();
  });
  it("rejects forged lead/ad/form/Page metadata and unavailable masters before contact", async () => {
    for (const options of [
      { metadata: { id: "forged" } },
      { metadata: { ad_id: "999" } },
      { metadata: { form_id: "999" } },
      { form: { id: "2000", page_id: "999" } },
      { users: masters.slice(2) },
    ]) {
      const f = fixture(options);
      await processMeta(f.store, env, f.fetcher);
      expect(f.fieldsRequested.every((fields) => !fields.includes("field_data"))).toBe(true);
      expect(f.store.createMetaLead).not.toHaveBeenCalled();
      expect(f.store.failMeta).toHaveBeenCalled();
    }
  });
  it("keeps configured form product and reuses the stable external idempotency key", async () => {
    const f = fixture();
    const routed = {
      ...env,
      META_FORM_ROUTES_JSON: JSON.stringify([
        {
          page_id: "123",
          form_id: "2000",
          product: "Configured product",
          roles: ["admin", "superintendent", "manager"],
        },
      ]),
    };
    await processMeta(f.store, routed, f.fetcher);
    expect(f.store.createMetaLead.mock.calls[0]).toMatchObject([
      { product: "Configured product" },
      "meta:1000",
      new Set(["admin", "manager"]),
    ]);
    expect(await processMeta(f.store, routed, f.fetcher)).toBe(false);
    expect(f.store.createMetaLead).toHaveBeenCalledOnce();
  });
  it("treats deselection detected inside the commit transaction as ignored without retry", async () => {
    const f = fixture();
    f.store.createMetaLead.mockRejectedValueOnce(
      Object.assign(Error("removed"), { code: "META_CAMPAIGN_NOT_SELECTED" }),
    );
    await processMeta(f.store, env, f.fetcher);
    expect(f.store.ignoreMeta).toHaveBeenCalled();
    expect(f.store.failMeta).not.toHaveBeenCalled();
    expect(f.store.completeMeta).not.toHaveBeenCalled();
  });
});
