import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_INTERRUPT");
  }),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  requireAuthorization: vi.fn(),
  requirePermission: vi.fn(),
  loadReadModelV3: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  forbidden: mocks.forbidden,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/authorization/guards", () => ({
  requireAuthorization: mocks.requireAuthorization,
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/crm/read-model-v3/data", () => ({
  loadReadModelV3: mocks.loadReadModelV3,
}));

import ForbiddenPage from "@/app/forbidden";
import ErrorPage from "@/app/error";
import NotFoundPage from "@/app/not-found";
import PartnershipsChannelPage from "@/app/(protected)/app/canal-de-parcerias/page";
import { UserAccessManager } from "@/app/(protected)/admin/usuarios/UserAccessManager";
import {
  ROLE_INHERITED_PERMISSIONS,
  summarizeRoleChange,
} from "@/lib/authorization/access-presentation";
import { enforcePermission } from "@/lib/authorization/enforce";
import { PERMISSIONS } from "@/lib/authorization/permissions";
import { getAssignableRoleKeys, ROLES } from "@/lib/authorization/roles";
import { AuthorizationError } from "@/lib/authorization/types";

describe("experiência de acesso", () => {
  it("converte falta de permissão no interruptor HTTP 403 do Next.js", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new AuthorizationError("FORBIDDEN", "denied"));

    await expect(enforcePermission("admin.access")).rejects.toThrow("FORBIDDEN_INTERRUPT");
    expect(mocks.forbidden).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("mantém ausência de sessão como redirecionamento para login", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AuthorizationError("UNAUTHENTICATED", "login required"),
    );

    await expect(enforcePermission("admin.access")).rejects.toThrow("REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("renderiza uma página 403 localizada e neutra", () => {
    const markup = renderToStaticMarkup(createElement(ForbiddenPage));

    expect(markup).toContain("Você não possui acesso a esta página");
    expect(markup).toContain("Voltar ao início");
    expect(markup).toContain("AUTH-403");
    expect(markup).not.toContain("admin.access");
  });

  it("distingue rota inexistente de acesso negado", () => {
    const markup = renderToStaticMarkup(createElement(NotFoundPage));

    expect(markup).toContain("Página não encontrada");
    expect(markup).toContain("Isso é diferente de uma restrição de acesso");
    expect(markup).toContain("ROUTE-404");
  });

  it("mantém erro interno em uma superfície 500 localizada", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorPage, { error: new Error("unexpected"), reset: vi.fn() }),
    );

    expect(markup).toContain("Não foi possível carregar esta página");
    expect(markup).toContain("APP-500");
    expect(markup).not.toContain("unexpected");
  });

  it("permite abrir Canal de Parcerias quando a permissão dedicada autoriza", async () => {
    mocks.requirePermission.mockResolvedValueOnce({
      userId: "81000000-0000-4000-8000-000000000002",
      roleKey: "admin",
      level: 80,
      permissions: ["pages.view", "crm.partnerships.view"],
    });

    const markup = renderToStaticMarkup(await PartnershipsChannelPage());

    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.partnerships.view");
    expect(markup).toContain("Ranking das imobiliárias");
    expect(markup).toContain("Aguardando conciliação das fontes");
    expect(markup).toContain("Dado indisponível — integração pendente");
    expect(markup).not.toContain("crm_imob_ranking");
    expect(mocks.loadReadModelV3).not.toHaveBeenCalled();
  });

  it("nega Canal de Parcerias com 403 quando a permissão efetiva não autoriza", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new AuthorizationError("FORBIDDEN", "denied"));

    await expect(PartnershipsChannelPage()).rejects.toThrow("FORBIDDEN_INTERRUPT");
    expect(mocks.forbidden).toHaveBeenCalled();
  });
});

describe("catálogo localizado de acesso", () => {
  it("preserva as chaves técnicas e apresenta todos os papéis em português", () => {
    expect(Object.keys(ROLES)).toEqual([
      "master",
      "admin",
      "coordinator",
      "manager",
      "supervisor",
      "house",
      "real_estate",
      "partnership_channel",
      "broker_lead",
      "broker",
      "user",
      "pending",
    ]);
    expect(Object.values(ROLES).map((role) => role.label)).toEqual([
      "Master",
      "Administrador",
      "Coordenador",
      "Gerente",
      "Supervisor",
      "House",
      "Imobiliária",
      "Canal de Parcerias",
      "Líder de corretores",
      "Corretor",
      "Usuário",
      "Pendente",
    ]);
  });

  it("nunca oferece Master como papel atribuível", () => {
    expect(getAssignableRoleKeys(100)).not.toContain("master");
    expect(getAssignableRoleKeys(80)).not.toContain("master");
    expect(getAssignableRoleKeys(100)).not.toContain("pending");
  });

  it("mantém a matriz visual dos papéis alinhada ao catálogo protegido", () => {
    const visualFoundationPermissions = ["pages.view", "crm.simulators.view"];

    expect(ROLE_INHERITED_PERMISSIONS.master).toEqual(
      Object.keys(PERMISSIONS).filter(
        (permission) => permission !== "crm.commercial_engine.execute",
      ),
    );
    expect(ROLE_INHERITED_PERMISSIONS.admin).toEqual([
      "users.view",
      "users.manage",
      "permissions.view",
      "permissions.manage",
      "roles.view",
      "roles.manage",
      "audit.view",
      "admin.access",
      ...visualFoundationPermissions,
    ]);
    for (const roleKey of [
      "coordinator",
      "supervisor",
      "real_estate",
      "broker_lead",
      "broker",
      "user",
    ] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toEqual(visualFoundationPermissions);
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("crm.settings.manage");
    }

    for (const roleKey of ["manager", "house", "partnership_channel", "pending"] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toEqual([]);
    }
  });

  it("resume acessos adicionados e removidos antes da troca de papel", () => {
    const elevation = summarizeRoleChange("user", "admin");
    const downgrade = summarizeRoleChange("admin", "user");

    expect(elevation.added).toContain("admin.access");
    expect(elevation.removed).toEqual([]);
    expect(downgrade.removed).toContain("roles.manage");
    expect(downgrade.added).toEqual([]);
  });

  it("não mantém descrições de permissão em inglês na interface", () => {
    const visibleText = Object.values(PERMISSIONS)
      .flatMap((permission) => [permission.label, permission.description])
      .join(" ");

    expect(visibleText).not.toMatch(/\b(View|Manage|Grant|Request|Access|Create)\b/);
  });

  it("mantém o Canal de Parcerias como gate exclusivo do Master", () => {
    expect(PERMISSIONS["crm.partnerships.view"]).toEqual({
      label: "Visualizar Canal de Parcerias",
      description: "Acessa o Canal de Parcerias exclusivamente no perfil Master.",
      minLevel: 100,
    });
  });

  it("mostra busca, herança e exceções sem oferecer autoelevação", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000001",
            email: "usuario@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "user",
            isSelf: true,
            isManageable: false,
            overrides: [],
          },
        ],
        assignableRoles: ["admin", "user"],
        manageablePermissions: ["crm.dashboard.view"],
        canManageRoles: true,
        canManagePermissions: true,
        canManageUsers: true,
        canApproveUsers: false,
        reportingScopes: [],
      }),
    );

    expect(markup).toContain("Buscar usuário");
    expect(markup).toContain("Permissões herdadas do papel");
    expect(markup).toContain("Exceções individuais");
    expect(markup).toContain("Configurações avançadas");
    expect(markup).toContain("proteção contra autoelevação");
    expect(markup).not.toContain("Salvar papel");
  });

  it("expõe aprovação pendente somente com papel, escopo oficial e motivo explícitos", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000002",
            email: "pendente@example.test",
            isActive: false,
            accessStatus: "pending",
            roleKey: "pending",
            isSelf: false,
            isManageable: true,
            overrides: [],
          },
        ],
        assignableRoles: ["coordinator", "broker"],
        manageablePermissions: [],
        canManageRoles: true,
        canManagePermissions: true,
        canManageUsers: true,
        canApproveUsers: true,
        reportingScopes: [
          {
            id: "82000000-0000-4000-8000-000000000001",
            key: "team:qa-official",
            type: "team",
          },
        ],
      }),
    );

    expect(markup).toContain("Aprovação de acesso escopado");
    expect(markup).toContain('name="reportingScopeIds"');
    expect(markup).toContain("team:qa-official");
    expect(markup).toContain('name="reason"');
    expect(markup).toContain("Nenhuma associação é inferida pelo nome");
  });
});
