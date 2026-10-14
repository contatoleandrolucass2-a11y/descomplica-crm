import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission: mocks.enforce }));
vi.mock("@/lib/authorization/guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization/guards")>()),
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/crm/salesforce/config", () => ({
  getSalesforceIngestConfiguration: () => ({ enabled: true, available: true }),
  getSalesforceRefreshConfiguration: () => ({ available: false }),
  getSalesforceStatusConfiguration: () => ({ available: false }),
}));

import ConnectedSystemsPage from "@/app/(protected)/app/configuracoes/conectar-sistemas/page";
import { GET } from "@/app/api/dashboard/status/route";
import { AuthorizationError } from "@/lib/authorization/types";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforce.mockResolvedValue({ roleKey: "admin", permissions: ["crm.settings.manage"] });
  mocks.requirePermission.mockResolvedValue({});
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc, from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({
    data: [
      {
        generated_at: null,
        last_ingest_at: null,
        last_ingest_status: null,
        refresh_status: null,
        refresh_requested_at: null,
      },
    ],
    error: null,
  });
});

describe("connected systems evidence authorization", () => {
  it("stops at the settings guard", async () => {
    mocks.enforce.mockRejectedValue(new Error("forbidden"));
    await expect(ConnectedSystemsPage()).rejects.toThrow("forbidden");
    expect(mocks.enforce).toHaveBeenCalledWith("crm.settings.manage");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not enable the probe from settings permission or ingestion configuration alone", async () => {
    const page = await ConnectedSystemsPage();
    expect(page.props.canReadSyncStatus).toBeUndefined();
    const markup = renderToStaticMarkup(page);
    expect(markup).toContain("Consulta não autorizada para este acesso.");
    expect(markup).not.toContain("Ingestão confirmada");
    expect(markup).not.toContain("Leitura confirmada");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("enables the existing status probe with dashboard permission even without a heartbeat", async () => {
    mocks.enforce.mockResolvedValue({
      roleKey: "admin",
      permissions: ["crm.settings.manage", "crm.dashboard.view"],
    });
    const page = await ConnectedSystemsPage();
    expect(page.props.canReadSyncStatus).toBe(true);
    expect(page.props.statusConfigured).toBe(false);
    expect(renderToStaticMarkup(page)).not.toContain("Ingestão confirmada");
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["MFA_REQUIRED", 403],
  ] as const)("blocks the server RPC for %s", async (code, status) => {
    mocks.requirePermission.mockRejectedValue(new AuthorizationError(code, "Access denied"));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.dashboard.view", true);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reads the existing RPC and snapshot version through the authenticated client", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_crm_sync_status");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("crm_dashboard_snapshots");
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("generated_at,updated_at");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("snapshot_key", "global");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      generatedAt: null,
      updatedAt: null,
      ingestion: { status: null, completedAt: null },
    });
  });

  it("uses the persisted version, including reimports with the same generation date", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        generated_at: "2026-10-14T12:33:00.123456+00:00",
        updated_at: "2026-10-14T12:34:00.234567+00:00",
      },
      error: null,
    });
    expect(await (await GET()).json()).toMatchObject({
      generatedAt: "2026-10-14T12:33:00.123456+00:00",
      updatedAt: "2026-10-14T12:34:00.234567+00:00",
    });
  });

  it.each([
    { data: null, error: { message: "private database detail" } },
    { data: {}, error: null },
    { data: { generated_at: "invalid", updated_at: "invalid" }, error: null },
  ])("fails closed when the snapshot version cannot be confirmed", async (result) => {
    mocks.maybeSingle.mockResolvedValue(result);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "status_unavailable" });
  });

  it.each([
    { data: null, error: { code: "42501", message: "private database detail" } },
    { data: [], error: null },
    { data: [{ last_ingest_status: "bad" }], error: null },
  ])("returns an unavailable response for denied or malformed RPC data", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "status_unavailable" });
  });
});
