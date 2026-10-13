import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
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
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
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
  });

  it("reads only the existing RPC through the authenticated client", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_crm_sync_status");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ ingestion: { status: null, completedAt: null } });
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
