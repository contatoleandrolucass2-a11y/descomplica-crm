import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  authorizeRoute: vi.fn(),
  revalidatePath: vi.fn(),
  getLead: vi.fn(),
  getLeadCatalogs: vi.fn(),
  resolveLeadScope: vi.fn(),
  saveLead: vi.fn(),
  mutateLead: vi.fn(),
  saveLeadDistribution: vi.fn(),
  setLeadPresence: vi.fn(),
  assignLead: vi.fn(),
  previewLeadImport: vi.fn(),
  applyLeadImport: vi.fn(),
  saveLeadOperationsSettings: vi.fn(),
  exportLeads: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));
vi.mock("@/lib/crm/leads/data", () => ({
  getLead: mocks.getLead,
  getLeadCatalogs: mocks.getLeadCatalogs,
  resolveLeadScope: mocks.resolveLeadScope,
  saveLead: mocks.saveLead,
  mutateLead: mocks.mutateLead,
}));
vi.mock("@/lib/crm/leads/operations-data", () => ({
  saveLeadDistribution: mocks.saveLeadDistribution,
  setLeadPresence: mocks.setLeadPresence,
  assignLead: mocks.assignLead,
  previewLeadImport: mocks.previewLeadImport,
  applyLeadImport: mocks.applyLeadImport,
  saveLeadOperationsSettings: mocks.saveLeadOperationsSettings,
  exportLeads: mocks.exportLeads,
}));

import * as leadActions from "@/app/(protected)/app/leads/actions";
import * as operationActions from "@/app/(protected)/app/leads/operations-actions";
import { GET } from "@/app/(protected)/app/leads/exportar/route";

const forms = [
  ...Object.entries(leadActions).filter(([name]) => name.endsWith("FormAction")),
  ...Object.entries(operationActions),
] as Array<[string, (data: FormData) => Promise<{ status: string; message: string }>]>;
const legacySpies = [
  mocks.getLead,
  mocks.getLeadCatalogs,
  mocks.resolveLeadScope,
  mocks.saveLead,
  mocks.mutateLead,
  mocks.saveLeadDistribution,
  mocks.setLeadPresence,
  mocks.assignLead,
  mocks.previewLeadImport,
  mocks.applyLeadImport,
  mocks.saveLeadOperationsSettings,
  mocks.exportLeads,
  mocks.revalidatePath,
];

function expectNoLegacyAccess() {
  for (const spy of legacySpies) expect(spy).not.toHaveBeenCalled();
}

describe("Retired Lead server entry points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockReset().mockResolvedValue({});
    mocks.authorizeRoute.mockReset().mockResolvedValue({ ok: true, context: {} });
  });

  it.each(forms)(
    "retires %s without reading or mutating the former database",
    async (_, action) => {
      const form = new FormData();
      form.set("organizationId", "stale-browser-value");
      form.set("leadId", "stale-lead");
      const result = await action(form);
      expect(result).toMatchObject({ status: "error" });
      expect(result.message).toContain("desativada");
      expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.leads.view");
      expectNoLegacyAccess();
    },
  );

  it.each(forms)("preserves server authorization denial for %s", async (_, action) => {
    const denied = new Error("UNAUTHENTICATED");
    mocks.requirePermission.mockRejectedValueOnce(denied);
    await expect(action(new FormData())).rejects.toBe(denied);
    expectNoLegacyAccess();
  });

  it.each([
    ["saveLeadAction", leadActions.saveLeadAction],
    ["mutateLeadAction", leadActions.mutateLeadAction],
  ] as const)(
    "retires typed %s and preserves denial before any legacy access",
    async (_, action) => {
      await expect(action(undefined as never)).rejects.toMatchObject({ status: 410 });
      expectNoLegacyAccess();
      const denied = new Error("FORBIDDEN");
      mocks.requirePermission.mockRejectedValueOnce(denied);
      await expect(action(undefined as never)).rejects.toBe(denied);
      expectNoLegacyAccess();
    },
  );

  it("returns 410 for the authorized old export link without exporting personal data", async () => {
    const response = await GET(
      new Request("https://crm.example.test/app/leads/exportar?scope=old"),
    );
    expect(mocks.authorizeRoute).toHaveBeenCalledExactlyOnceWith("crm.leads.export");
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toMatchObject({ error: "legacy_lead_export_retired" });
    expectNoLegacyAccess();
  });

  it("preserves the authentication response for the retired export endpoint", async () => {
    const denial = Response.json({ error: "unauthenticated" }, { status: 401 });
    mocks.authorizeRoute.mockResolvedValueOnce({ ok: false, response: denial });
    expect(await GET(new Request("https://crm.example.test/app/leads/exportar"))).toBe(denial);
    expectNoLegacyAccess();
  });
});
