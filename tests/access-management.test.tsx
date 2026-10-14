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
import PartnershipsChannelLayout from "@/app/(protected)/app/canal-de-parcerias/layout";
import PartnershipsChannelPage from "@/app/(protected)/app/canal-de-parcerias/page";
import SimulationLayout from "@/app/(protected)/app/simulacao/layout";
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

  it("aplica gates de rota antes do streaming de Canal e Simulação", async () => {
    mocks.requirePermission.mockResolvedValue({
      userId: "81000000-0000-4000-8000-000000000002",
      roleKey: "master",
      level: 100,
      permissions: ["crm.partnerships.view", "crm.simulators.view"],
    });
    const partnershipChild = createElement("span", null, "Canal autorizado");
    const simulationChild = createElement("span", null, "Simulação autorizada");

    expect(
      renderToStaticMarkup(
        (await PartnershipsChannelLayout({ children: partnershipChild })) as React.ReactElement,
      ),
    ).toContain("Canal autorizado");
    expect(
      renderToStaticMarkup(
        (await SimulationLayout({ children: simulationChild })) as React.ReactElement,
      ),
    ).toContain("Simulação autorizada");
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.partnerships.view");
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.simulators.view");
  });
});

describe("catálogo localizado de acesso", () => {
  it("preserva as chaves técnicas e apresenta todos os papéis em português", () => {
    expect(Object.keys(ROLES)).toEqual([
      "master",
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
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
      "Gerente House",
      "Gerente Imob",
      "Corretor House",
      "Corretor Imob",
      "Gerente (legado)",
      "Supervisor (legado)",
      "House (legado)",
      "Imobiliária (legado)",
      "Canal de Parcerias (legado)",
      "Líder de corretores (legado)",
      "Corretor (legado)",
      "Usuário (legado)",
      "Pendente",
    ]);
  });

  it("oferece somente os seis papéis ativos não protegidos", () => {
    expect(getAssignableRoleKeys(100)).toEqual([
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ]);
    expect(getAssignableRoleKeys(80)).toEqual([
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ]);
    expect(
      Object.entries(ROLES)
        .filter(([, role]) => !role.assignable)
        .map(([roleKey]) => roleKey),
    ).toEqual([
      "master",
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
  });

  it("mantém a matriz visual dos papéis alinhada ao catálogo protegido", () => {
    const baseNavigationPermissions = ["pages.view", "crm.dashboard.view", "crm.stages.view"];
    const withCanalImobPermissions = [
      ...baseNavigationPermissions,
      "crm.dashboard.with_canal_imob.view",
      "crm.partnerships.view",
      "crm.simulators.view",
      "crm.simulators.execute",
    ];
    const withoutCanalImobPermissions = [
      ...baseNavigationPermissions,
      "crm.dashboard.without_canal_imob.view",
      "crm.ranking.view",
      "crm.simulators.view",
      "crm.simulators.execute",
    ];

    expect(ROLE_INHERITED_PERMISSIONS.master).toEqual(
      Object.keys(PERMISSIONS).filter(
        (permission) =>
          ![
            "crm.read_model_v3.view",
            "crm.read_model_v3.ranking.view",
            "crm.read_model_v3.partnerships.view",
            "crm.read_model_v3.stock.view",
            "crm.commercial_engine.execute",
            "crm.inventory.riva.view",
            "crm.inventory.direcional.view",
          ].includes(permission),
      ),
    );
    expect(ROLE_INHERITED_PERMISSIONS.master).toHaveLength(24);
    expect(ROLE_INHERITED_PERMISSIONS.admin).toEqual(Object.keys(PERMISSIONS));
    for (const roleKey of ["coordinator", "manager_imob", "broker_imob"] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toEqual(withCanalImobPermissions);
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("crm.ranking.view");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("crm.settings.manage");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("pages.manage");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("permissions.manage");
    }

    for (const roleKey of ["manager_house", "broker_house"] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toEqual(withoutCanalImobPermissions);
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("crm.partnerships.view");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toContain("crm.simulators.view");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("crm.settings.manage");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("pages.manage");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).not.toContain("permissions.manage");
    }

    for (const roleKey of [
      "manager",
      "supervisor",
      "house",
      "real_estate",
      "partnership_channel",
      "broker_lead",
      "broker",
      "user",
      "pending",
    ] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toEqual([]);
    }
  });

  it("resume acessos adicionados e removidos antes da troca de papel", () => {
    const elevation = summarizeRoleChange("user", "admin");
    const downgrade = summarizeRoleChange("admin", "broker_house");

    expect(elevation.added).toContain("admin.access");
    expect(elevation.removed).toEqual([]);
    expect(downgrade.removed).toContain("roles.manage");
    expect(downgrade.added).toEqual([]);
  });

  it.each([false, true])(
    "marca os padrões do Administrador e respeita negação individual: %s",
    (denyRiva) => {
      const markup = renderToStaticMarkup(
        createElement(UserAccessManager, {
          users: [
            {
              userId: "81000000-0000-4000-8000-000000000006",
              email: "administrador@example.test",
              isActive: true,
              accessStatus: "approved",
              roleKey: "admin",
              isSelf: false,
              isManageable: true,
              overrides: denyRiva
                ? [{ permissionKey: "crm.inventory.riva.view", effect: "deny", reason: null }]
                : [],
            },
          ],
          assignableRoles: ["admin"],
          manageablePermissions: ["crm.inventory.riva.view", "crm.inventory.direcional.view"],
          canManageRoles: true,
          canManagePermissions: true,
          isMasterPermissionManager: true,
          canManageUsers: true,
          canApproveUsers: false,
          reportingScopes: [],
        }),
      );
      const checkboxes = markup.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
      expect(checkboxes.length).toBeGreaterThan(0);
      for (const checkbox of checkboxes) {
        expect(checkbox.includes('checked=""')).toBe(
          !(denyRiva && checkbox.includes('aria-label="Acesso a RIVA"')),
        );
      }
    },
  );

  it("não mantém descrições de permissão em inglês na interface", () => {
    const visibleText = Object.values(PERMISSIONS)
      .flatMap((permission) => [permission.label, permission.description])
      .join(" ");

    expect(visibleText).not.toMatch(/\b(View|Manage|Grant|Request|Access|Create)\b/);
  });

  it("mantém o Canal de Parcerias disponível somente para a matriz Imob autorizada", () => {
    expect(PERMISSIONS["crm.partnerships.view"]).toEqual({
      label: "Visualizar Canal de Parcerias",
      description: "Acessa o Canal de Parcerias quando concedido pelo papel.",
      minLevel: 10,
    });
    expect(ROLE_INHERITED_PERMISSIONS.coordinator).toContain("crm.partnerships.view");
    expect(ROLE_INHERITED_PERMISSIONS.manager_imob).toContain("crm.partnerships.view");
    expect(ROLE_INHERITED_PERMISSIONS.broker_imob).toContain("crm.partnerships.view");
    expect(ROLE_INHERITED_PERMISSIONS.manager_house).not.toContain("crm.partnerships.view");
    expect(ROLE_INHERITED_PERMISSIONS.broker_house).not.toContain("crm.partnerships.view");
  });

  it("concede visualização e execução de simuladores aos sete papéis ativos", () => {
    expect(PERMISSIONS["crm.simulators.view"]).toEqual({
      label: "Visualizar simuladores",
      description: "Acessa as interfaces de simulação autorizadas para a conta.",
      minLevel: 10,
    });
    expect(ROLE_INHERITED_PERMISSIONS.master).toContain("crm.simulators.view");

    for (const roleKey of [
      "master",
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ] as const) {
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toContain("crm.simulators.view");
      expect(ROLE_INHERITED_PERMISSIONS[roleKey]).toContain("crm.simulators.execute");
    }
    expect(ROLE_INHERITED_PERMISSIONS.pending).toEqual([]);
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
        assignableRoles: ["admin", "broker_house"],
        manageablePermissions: ["crm.dashboard.view"],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: false,
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

  it("mostra caixas marcadas pelo padrão e exceções, sem campo de motivo", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000004",
            email: "corretor-house@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "broker_house",
            isSelf: false,
            isManageable: true,
            overrides: [
              {
                permissionKey: "crm.dashboard.without_canal_imob.view",
                effect: "deny",
                reason: "Restrição sintética",
              },
            ],
          },
        ],
        assignableRoles: ["coordinator", "manager_house", "broker_house"],
        manageablePermissions: [
          "crm.dashboard.view",
          "crm.dashboard.with_canal_imob.view",
          "crm.dashboard.without_canal_imob.view",
        ],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: true,
        canManageUsers: true,
        canApproveUsers: false,
        reportingScopes: [],
      }),
    );

    expect(markup).toContain("Buscar permissão");
    const checkbox = (label: string) =>
      markup.match(new RegExp(`<input[^>]*aria-label="Acesso a ${label}"[^>]*>`))?.[0];
    expect(checkbox("Visualizar dashboard")).toContain('checked=""');
    expect(checkbox("Visualizar dashboard com Canal Imob")).not.toContain('checked=""');
    expect(checkbox("Visualizar dashboard sem Canal Imob")).not.toContain('checked=""');
    expect(markup).toContain("Marcas nos simuladores");
    expect(checkbox("RIVA")).toBeDefined();
    expect(checkbox("RIVA")).not.toContain('checked=""');
    expect(checkbox("DIRECIONAL")).toBeDefined();
    expect(checkbox("DIRECIONAL")).not.toContain('checked=""');
    expect(checkbox("Gerenciar usuários")).toContain('disabled=""');
    expect(markup.match(/aria-label="Acessar simuladores"/g)).toHaveLength(1);
    expect(markup).toContain("Permite visualizar e executar os simuladores disponíveis.");
    expect(markup).not.toContain('aria-label="Acesso a Executar simuladores oficiais"');
    expect(markup).not.toContain("Visualizar read model v3");
    expect(markup).not.toContain("Visualizar dataset v3");
    expect(markup).not.toContain('aria-label="Acesso a Visualizar auditoria"');
    expect(markup).toContain("Usar padrão do perfil");
    expect(markup).not.toContain('name="reason"');
    expect(markup).not.toContain('name="effect"');
    expect(markup).toContain("Salvar alterações");
    expect(markup).toContain("Herdada: negada");
    expect(markup).toContain("Como Master");
    expect(markup).toContain("qualquer usuário abaixo do seu nível");
    expect(markup).toContain("O papel do usuário não muda");
    expect(markup).not.toContain("Adicionar uma exceção");
  });

  it.each([
    { inherited: ["crm.simulators.view", "crm.simulators.execute"], checked: true },
    { inherited: ["crm.simulators.view"], checked: false },
    { inherited: [], checked: false },
  ] as const)(
    "exibe um único acesso aos simuladores conforme a herança recebida: $checked",
    ({ inherited, checked }) => {
      const markup = renderToStaticMarkup(
        createElement(UserAccessManager, {
          users: [
            {
              userId: "81000000-0000-4000-8000-000000000005",
              email: "simuladores@example.test",
              isActive: true,
              accessStatus: "approved",
              roleKey: "broker_house",
              inheritedPermissions: inherited,
              isSelf: false,
              isManageable: true,
              overrides: [],
            },
          ],
          assignableRoles: ["broker_house"],
          manageablePermissions: ["crm.simulators.view"],
          canManageRoles: true,
          canManagePermissions: true,
          isMasterPermissionManager: false,
          canManageUsers: true,
          canApproveUsers: false,
          reportingScopes: [],
        }),
      );
      const checkbox = markup.match(/<input[^>]*aria-label="Acessar simuladores"[^>]*>/)?.[0];
      expect(checkbox).toBeDefined();
      expect(checkbox?.includes('checked=""')).toBe(checked);
      expect(checkbox).toContain('disabled=""');
      expect(markup).not.toContain('aria-label="Acesso a Executar simuladores oficiais"');
    },
  );

  it("expõe aprovação pendente com papel e escopo, sem motivo manual", () => {
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
        assignableRoles: ["coordinator", "broker_house"],
        manageablePermissions: [],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: false,
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
    expect(markup).not.toContain('name="reason"');
    expect(markup).toContain("Nenhuma associação é inferida pelo nome");
  });
});
