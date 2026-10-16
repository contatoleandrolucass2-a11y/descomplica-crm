import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/middleware", () => ({ updateSession: mocks.updateSession }));

import { proxy } from "@/proxy";
import { PAGE_REGISTRY } from "@/lib/navigation/registry";

const origin = "https://crm.example.test";

function configureSession(permissions: string[], roleKey = "master") {
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
  mocks.rpc.mockResolvedValue({ data: [{ permissions, role_key: roleKey }], error: null });
  mocks.updateSession.mockResolvedValue({
    response,
    supabase: {
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
      from: () => {
        let pageKey = "";
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => {
            if (column === "key") pageKey = String(value);
            return query;
          },
          maybeSingle: async () => {
            const page = PAGE_REGISTRY.find((entry) => entry.pageKey === pageKey);
            return {
              data: page
                ? {
                    key: page.pageKey,
                    path: page.path,
                    permission_key: page.permission,
                    is_active: true,
                  }
                : null,
              error: null,
            };
          },
        };
        return query;
      },
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
    ["/app/repasse", "crm.repasse.view"],
    ["/app/etapas/oportunidades", "crm.stage.opportunities.view"],
    ["/app/ranking", "crm.ranking.view"],
    ["/app/canal-de-parcerias", "crm.partnerships.view"],
    ["/app/configuracoes", "crm.settings.view"],
    ["/app/configuracoes/metas", "crm.settings.goals.view"],
    ["/app/configuracoes/metas/parcerias", "crm.settings.partnerships.view"],
    ["/app/configuracoes/metas/pontos", "crm.settings.points.view"],
    ["/app/configuracoes/recurso-mkt", "crm.settings.marketing.view"],
    ["/app/configuracoes/conectar-sistemas", "crm.settings.connected_systems.view"],
    ["/app/simulacao", "crm.simulators.view"],
    ["/app/simulacao/associativo-fluxo-linear", "crm.simulators.view"],
    ["/app/simulacao/tabela-direta", "crm.simulators.view"],
    ["/app/simulacao/tabela-investidor", "crm.simulators.view"],
    ["/app/simulacao/tabelao", "crm.simulators.view"],
    ["/app/simulacao/calcular-documentacao", "crm.simulators.view"],
    ["/app/simulacao/caixa", "crm.simulators.view"],
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

  it.each(["master", "admin"])(
    "allows Repasse for %s with its independent access",
    async (roleKey) => {
      configureSession(["crm.repasse.view"], roleKey);

      const response = await proxy(new NextRequest(`${origin}/app/repasse`));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it.each(["coordinator", "manager_imob", "broker_imob"])(
    "denies Repasse for %s even with partnership access",
    async (roleKey) => {
      configureSession(["crm.repasse.view"], roleKey);

      const response = await proxy(new NextRequest(`${origin}/app/repasse`));

      expect(response.status).toBe(403);
      expect(response.headers.get("x-middleware-rewrite")).toBe(`${origin}/unauthorized`);
    },
  );

  it("lets the removed legacy public snapshot path resolve as a normal 404", async () => {
    configureSession([]);

    const response = await proxy(new NextRequest(`${origin}/data/investor-inventory.json`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
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
});
