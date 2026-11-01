import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Server-only operational ESM module.
import { fetchMetaCampaignCatalog } from "../lib/crm/lead-plus/server/meta-campaign-catalog.mjs";

let sequence = 0;
const environment = () => ({
  META_ADS_ACCESS_TOKEN: `synthetic-catalog-token-${++sequence}`,
  META_ADS_ACCOUNT_ID: "1080988750909489",
  META_ADS_API_VERSION: "v26.0",
  META_PAGE_ACCESS_TOKEN: "never-use-page-token",
});
const account = { id: "act_1080988750909489", name: "Superitendente Leandro" };
const campaign = {
  id: "123",
  name: "Campanha de teste",
  effective_status: "ACTIVE",
  objective: "OUTCOME_LEADS",
};
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.restoreAllMocks());

describe("LEAD+ read-only Meta campaign catalogue", () => {
  it("reads configured account metadata and follows only cursors on the fixed Graph endpoint", async () => {
    const env = environment();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(account))
      .mockResolvedValueOnce(
        response({
          data: [campaign],
          paging: {
            next: "https://evil.invalid/steal?access_token=upstream",
            cursors: { after: "cursor/+==" },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({ data: [{ ...campaign, id: "456", effective_status: "PAUSED" }] }),
      );
    const result = await fetchMetaCampaignCatalog(env, fetcher);
    expect(result).toEqual({
      available: true,
      account: { id: env.META_ADS_ACCOUNT_ID, name: account.name },
      business: { id: "310106776631136", name: "BM MÃE 2" },
      data: [
        {
          id: "123",
          name: campaign.name,
          status: "ACTIVE",
          account_id: env.META_ADS_ACCOUNT_ID,
          account_name: account.name,
        },
        {
          id: "456",
          name: campaign.name,
          status: "PAUSED",
          account_id: env.META_ADS_ACCOUNT_ID,
          account_name: account.name,
        },
      ],
    });
    for (const [input, options] of fetcher.mock.calls) {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://graph.facebook.com");
      expect(url.pathname).toMatch(/^\/v26\.0\/act_1080988750909489(?:\/campaigns)?$/);
      expect(url.searchParams.has("access_token")).toBe(false);
      expect(String(input)).not.toContain(env.META_ADS_ACCESS_TOKEN);
      expect(options?.redirect).toBe("error");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(options?.headers).get("authorization")).toBe(
        `Bearer ${env.META_ADS_ACCESS_TOKEN}`,
      );
      expect(url.searchParams.get("fields")).not.toMatch(/business|insights|field_data/);
    }
    expect(new URL(String(fetcher.mock.calls[2]![0])).searchParams.get("after")).toBe("cursor/+==");
    expect(JSON.stringify(result)).not.toContain(env.META_ADS_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(env.META_PAGE_ACCESS_TOKEN);
  });

  it("accepts an empty complete catalogue only after account validation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(account))
      .mockResolvedValueOnce(response({ data: [] }));
    expect(await fetchMetaCampaignCatalog(environment(), fetcher)).toMatchObject({
      available: true,
      data: [],
    });
  });

  it.each([
    [{ id: "act_999", name: "Other" }, { data: [] }],
    [account, { data: [{ ...campaign, account_id: "999" }] }],
    [account, { data: [{ ...campaign, name: undefined }] }],
    [account, { data: [{ ...campaign, effective_status: undefined }] }],
    [account, {}],
    [account, { data: [], paging: { next: "https://graph.facebook.com/anything" } }],
    [account, { data: [campaign, campaign] }],
  ])("fails closed for wrong accounts or incomplete Graph data %#", async (metadata, campaigns) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(metadata))
      .mockResolvedValueOnce(response(campaigns));
    await expect(fetchMetaCampaignCatalog(environment(), fetcher)).rejects.toMatchObject({
      code: "META_CAMPAIGN_CATALOG_UNAVAILABLE",
      status: 503,
    });
  });

  it("sanitizes HTTP, network and parsing failures without returning invented empty data", async () => {
    for (const mode of ["http", "network", "json"] as const) {
      const env = environment();
      const fetcher = vi.fn<typeof fetch>();
      if (mode === "network")
        fetcher.mockRejectedValueOnce(
          Error(`private ${env.META_ADS_ACCESS_TOKEN} https://private.invalid`),
        );
      else if (mode === "http")
        fetcher.mockResolvedValueOnce(
          response({ error: { message: env.META_ADS_ACCESS_TOKEN } }, 403),
        );
      else fetcher.mockResolvedValueOnce(new Response(`invalid ${env.META_ADS_ACCESS_TOKEN}`));
      const error = await fetchMetaCampaignCatalog(env, fetcher).catch((failure: Error) => failure);
      expect(error).toMatchObject({ status: 503 });
      expect(String(error)).not.toContain(env.META_ADS_ACCESS_TOKEN);
      expect(String(error)).not.toContain("https://private.invalid");
      expect(error).not.toHaveProperty("data");
    }
  });

  it("does not fall back to Page credentials or accept client-controlled account URLs", async () => {
    for (const invalid of [
      { ...environment(), META_ADS_ACCESS_TOKEN: "" },
      { ...environment(), META_ADS_ACCOUNT_ID: "https://evil.invalid" },
      { ...environment(), META_ADS_API_VERSION: "v26.0/evil" },
      { ...environment(), META_ADS_ACCESS_TOKEN: "bad\r\nsecret" },
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      await expect(fetchMetaCampaignCatalog(invalid, fetcher)).rejects.toMatchObject({
        status: 503,
      });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("rejects repeating cursors and pagination truncation instead of serving partial results", async () => {
    for (const repeated of [true, false]) {
      const env = environment();
      let page = 0;
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(account))
        .mockImplementation(async () =>
          response({
            data: [],
            paging: {
              next: "https://evil.invalid",
              cursors: { after: repeated ? "same" : `cursor-${++page}` },
            },
          }),
        );
      await expect(fetchMetaCampaignCatalog(env, fetcher)).rejects.toMatchObject({ status: 503 });
      expect(fetcher.mock.calls.length).toBeLessThanOrEqual(21);
    }
  });

  it("deduplicates in-flight work, caches for 30 seconds and returns isolated copies", async () => {
    const env = environment();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      await gate;
      return response(String(input).includes("/campaigns?") ? { data: [campaign] } : account);
    });
    const first = fetchMetaCampaignCatalog(env, fetcher);
    const second = fetchMetaCampaignCatalog(env, fetcher);
    release();
    const [a, b] = await Promise.all([first, second]);
    a.data[0].name = "client mutation";
    expect(b.data[0].name).toBe(campaign.name);
    expect((await fetchMetaCampaignCatalog(env, fetcher)).data[0].name).toBe(campaign.name);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 30001);
    await fetchMetaCampaignCatalog(env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("refreshes explicitly but coalesces rapid refreshes and separates credential cache keys", async () => {
    const env = environment();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        response(String(input).includes("/campaigns?") ? { data: [] } : account),
      );
    await fetchMetaCampaignCatalog(env, fetcher);
    await fetchMetaCampaignCatalog(env, fetcher, { refresh: true });
    await fetchMetaCampaignCatalog(env, fetcher, { refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(4);
    await fetchMetaCampaignCatalog(
      { ...env, META_ADS_ACCESS_TOKEN: `${env.META_ADS_ACCESS_TOKEN}-rotated` },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("bounds upstream metadata bodies and rejects malformed pagination", async () => {
    for (const payload of [
      { data: [], paging: { next: false } },
      { data: [], padding: "x".repeat(1_048_576) },
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(account))
        .mockResolvedValueOnce(response(payload));
      await expect(fetchMetaCampaignCatalog(environment(), fetcher)).rejects.toMatchObject({
        status: 503,
      });
    }
  });

  it("isolates cache entries for different accounts and Graph versions", async () => {
    const env = environment();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/campaigns")) return response({ data: [] });
      return response({ id: url.pathname.split("/").at(-1), name: account.name });
    });
    await fetchMetaCampaignCatalog(env, fetcher);
    await fetchMetaCampaignCatalog({ ...env, META_ADS_ACCOUNT_ID: "999" }, fetcher);
    await fetchMetaCampaignCatalog({ ...env, META_ADS_API_VERSION: "v27.0" }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
});
