import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/middleware", () => ({ updateSession: mocks.updateSession }));

import { proxy } from "@/proxy";

const origin = "https://crm.example.test";

function configureSession(permissions: string[]) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set("rotated-session-proof", "opaque", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "81000000-0000-4000-8000-000000000001" } },
    error: null,
  });
  mocks.getClaims.mockResolvedValue({ data: { claims: { amr: [] } }, error: null });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: [{ permissions }], error: null });
  mocks.updateSession.mockResolvedValue({
    response,
    supabase: {
      auth: {
        getClaims: mocks.getClaims,
        getUser: mocks.getUser,
        mfa: { getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel },
      },
      rpc: mocks.rpc,
    },
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("pre-stream page permission gates", () => {
  it.each([
    ["/app", "crm.dashboard.view"],
    ["/app/etapas/oportunidades", "crm.stages.view"],
    ["/app/ranking", "crm.ranking.view"],
    ["/app/canal-de-parcerias", "crm.partnerships.view"],
    ["/app/configuracoes", "crm.settings.view"],
    ["/app/configuracoes/metas", "crm.settings.manage"],
    ["/app/configuracoes/metas/parcerias", "crm.settings.manage"],
    ["/app/configuracoes/metas/pontos", "crm.settings.manage"],
    ["/app/simulacao", "crm.simulators.view"],
    ["/app/simulacao/associativo-fluxo-linear", "crm.simulators.view"],
    ["/admin", "admin.access"],
    ["/admin/usuarios", "users.view"],
    ["/admin/paginas", "pages.manage"],
  ])("returns a real 403 before rendering %s", async (pathname, permission) => {
    configureSession([]);

    const deniedResponse = await proxy(new NextRequest(`${origin}${pathname}`));

    expect(deniedResponse.status).toBe(403);
    expect(deniedResponse.headers.get("x-middleware-rewrite")).toBe(`${origin}/unauthorized`);
    expect(deniedResponse.headers.get("cache-control")).toContain("no-store");
    expect(deniedResponse.headers.get("set-cookie")).toContain("rotated-session-proof");
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_authorization_context", {
      user_uuid: "81000000-0000-4000-8000-000000000001",
    });

    configureSession([permission]);
    const allowedResponse = await proxy(new NextRequest(`${origin}${pathname}`));

    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("continues when the exact permission is effective", async () => {
    configureSession(["crm.partnerships.view"]);

    const response = await proxy(new NextRequest(`${origin}/app/canal-de-parcerias`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("defers a recovery session to the assurance quarantine", async () => {
    configureSession([]);
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    mocks.getClaims.mockResolvedValueOnce({
      data: { claims: { amr: [{ method: "recovery", timestamp: 1_787_934_000 }] } },
      error: null,
    });

    const response = await proxy(new NextRequest(`${origin}/app`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("defers an AAL1 session with an enrolled factor to the MFA quarantine", async () => {
    configureSession([]);
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const response = await proxy(new NextRequest(`${origin}/app`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it.each([
    "/app/simulacao/calcular-documentacao",
    "/app/simulacao/caixa",
    "/app/simulacao/tabela-direta",
    "/app/simulacao/tabela-investidor",
    "/app/simulacao/tabela",
    "/app/discador",
    "/app/discador/previsao-final-de-semana",
  ])(
    "returns 403 for inactive catalog route %s even when Master has the shared permission",
    async (pathname) => {
      configureSession(["crm.simulators.view"]);

      const response = await proxy(new NextRequest(`${origin}${pathname}`));

      expect(response.status).toBe(403);
      expect(response.headers.get("x-middleware-rewrite")).toBe(`${origin}/unauthorized`);
      expect(mocks.getUser).toHaveBeenCalledOnce();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/app/simulacao/calcular-documentacao", "crm.simulators.view"],
    ["/app/simulacao/caixa", "crm.simulators.view"],
    ["/app/simulacao/tabela-direta", "crm.simulators.view"],
    ["/app/simulacao/tabela-investidor", "crm.simulators.view"],
    ["/app/simulacao/tabela", "crm.simulators.view"],
    ["/app/discador", "crm.dialer.view"],
    ["/app/discador/previsao-final-de-semana", "crm.dialer.view"],
  ])("releases canary route %s only with its exact permission", async (pathname, permission) => {
    vi.stubEnv("LEGACY_MIGRATION_RUNTIME_MODE", "active");
    vi.stubEnv(
      "LEGACY_MIGRATION_ENABLED_MODULES",
      "simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15,simulator.tabelao,dialer,dialer.weekend-forecast",
    );
    configureSession([permission]);

    const response = await proxy(new NextRequest(`${origin}${pathname}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves non-catalog routes on the existing session path", async () => {
    configureSession([]);

    const response = await proxy(new NextRequest(`${origin}/conta/seguranca`));

    expect(response.status).toBe(200);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("defers response auth cookies for the MFA verification POST", async () => {
    configureSession([]);
    const request = new NextRequest(`${origin}/auth/mfa/verify`, {
      method: "POST",
      headers: { origin },
    });

    await proxy(request);

    expect(mocks.updateSession).toHaveBeenCalledWith(request, {
      deferResponseAuthCookies: true,
    });
  });

  it("fails closed when the effective permission RPC errors", async () => {
    configureSession(["crm.partnerships.view"]);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "sanitized" } });

    const response = await proxy(new NextRequest(`${origin}/app/canal-de-parcerias`));

    expect(response.status).toBe(403);
  });

  it.each([
    { data: [] },
    { data: [{ permissions: ["crm.partnerships.view"] }, { permissions: [] }] },
  ])("fails closed when the authorization RPC cardinality is invalid", async ({ data }) => {
    configureSession(["crm.partnerships.view"]);
    mocks.rpc.mockResolvedValueOnce({ data, error: null });

    const response = await proxy(new NextRequest(`${origin}/app/canal-de-parcerias`));

    expect(response.status).toBe(403);
  });
});
