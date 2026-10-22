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
  loadQlikRankingV2: vi.fn(async () => ({ status: "unavailable" })),
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

vi.mock("@/lib/crm/qlik/data-v2", () => ({
  loadQlikRankingV2: mocks.loadQlikRankingV2,
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
    expect(markup).toContain('href="/"');
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
    expect(markup).toContain("A leitura da fonte Qlik não pôde ser confirmada.");
    expect(markup).toContain("Dados indisponíveis");
    expect(mocks.loadQlikRankingV2).toHaveBeenCalledExactlyOnceWith(null);
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
    expect(getAssignableRoleKeys("master", 100)).toEqual([
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ]);
    expect(getAssignableRoleKeys("admin", 80)).toEqual([
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ]);
    expect(getAssignableRoleKeys("admin", 999)).not.toContain("admin");
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
    const baseNavigationPermissions = [
      "pages.view",
      "crm.dashboard.view",
      "crm.stages.view",
      "crm.stage.opportunities.view",
      "crm.stage.appointments.view",
      "crm.stage.visits.view",
      "crm.stage.folders.view",
      "crm.stage.sales.view",
      "crm.management.view",
      "crm.management.routine.view",
      "crm.management.forecast.view",
      "crm.management.forecast.values.edit",
    ];
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

    expect(ROLE_INHERITED_PERMISSIONS.master).toEqual(Object.keys(PERMISSIONS));
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

  it.each([
    ["admin", false],
    ["admin", true],
    ["master", false],
  ] as const)("marca os padrões de %s e respeita negação individual: %s", (roleKey, denyRiva) => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            inheritedPermissions: ROLE_INHERITED_PERMISSIONS[roleKey],
            permissionDetailsAvailable: true,
            userId: "81000000-0000-4000-8000-000000000006",
            email: "administrador@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey,
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
  });

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
    expect(ROLE_INHERITED_PERMISSIONS.admin).toContain("crm.simulators.view");
    expect(ROLE_INHERITED_PERMISSIONS.admin).toContain("crm.simulators.execute");

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
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000001",
            email: "usuario@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "user",
            isSelf: true,
            isManageable: false,
            inheritedPermissions: [],
            overrides: [],
            permissionDetailsAvailable: true,
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

    expect(markup).toContain("Buscar pessoas");
    expect(markup).toContain('role="tablist" aria-label="Categorias de acesso"');
    expect(markup.match(/role="tab"/g)).toHaveLength(4);
    expect(markup.match(/role="tabpanel"/g)).toHaveLength(4);
    expect(markup.match(/role="tabpanel" tabindex="-1" hidden=""/g)).toHaveLength(3);
    expect(markup).toContain('aria-label="Filtrar pessoas por status"');
    expect(markup).toContain("resultado do papel e das exceções individuais");
    expect(markup).toContain("O que pode acessar");
    expect(markup).toContain("Configurações avançadas");
    expect(markup).toContain("Você não pode alterar seu próprio papel, permissões ou status.");
    expect(markup).not.toContain("Salvar papel");
  });

  it("mostra caixas marcadas pelo padrão e exceções, sem campo de motivo", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000004",
            email: "corretor-house@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "broker_house",
            isSelf: false,
            isManageable: true,
            inheritedPermissions: ["crm.dashboard.view", "crm.dashboard.without_canal_imob.view"],
            overrides: [
              {
                permissionKey: "crm.dashboard.without_canal_imob.view",
                effect: "deny",
                reason: "Restrição sintética",
              },
            ],
            permissionDetailsAvailable: true,
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

    expect(markup).toContain("Buscar acesso");
    const checkbox = (label: string) =>
      markup.match(new RegExp(`<input[^>]*aria-label="Acesso a ${label}"[^>]*>`))?.[0];
    expect(checkbox("Visualizar dashboard")).toContain('checked=""');
    expect(checkbox("Visualizar dashboard com Canal Imob")).not.toContain('checked=""');
    expect(checkbox("Visualizar dashboard sem Canal Imob")).not.toContain('checked=""');
    expect(markup).toContain("RIVA e DIRECIONAL controlam as unidades visíveis");
    expect(checkbox("RIVA")).toBeDefined();
    expect(checkbox("RIVA")).not.toContain('checked=""');
    expect(checkbox("DIRECIONAL")).toBeDefined();
    expect(checkbox("DIRECIONAL")).not.toContain('checked=""');
    expect(checkbox("Gerenciar usuários")).toContain('disabled=""');
    expect(markup.match(/aria-label="Acessar simuladores"/g)).toHaveLength(1);
    expect(markup).toContain("Visualiza e executa os simuladores disponíveis:");
    expect(markup).toContain("Páginas vinculadas: Dashboard.");
    expect(markup).not.toContain('aria-label="Acesso a Executar simuladores oficiais"');
    expect(markup).not.toContain("Visualizar read model v3");
    expect(markup).not.toContain("Visualizar dataset v3");
    expect(markup).not.toContain('aria-label="Acesso a Visualizar auditoria"');
    expect(markup).toContain("Usar padrão do perfil");
    expect(markup).not.toContain('name="reason"');
    expect(markup).not.toContain('name="effect"');
    expect(markup).toContain("Salvar alterações");
    expect(markup).toContain("Herdada: negada");
    expect(markup).toContain("o papel do usuário não muda");
    expect(markup).toContain("Marcado: acesso liberado. Desmarcado: sem acesso.");
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
          initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
          users: [
            {
              permissionDetailsAvailable: true,
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

  it.each([
    { isActive: false, accessStatus: "suspended" as const },
    { isActive: true, accessStatus: "pending" as const },
  ])("não apresenta herança administrativa como acesso efetivo de conta $accessStatus", (state) => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            inheritedPermissions: ROLE_INHERITED_PERMISSIONS["admin"],
            permissionDetailsAvailable: true,
            userId: "81000000-0000-4000-8000-000000000007",
            email: "sem-acesso@example.test",
            ...state,
            roleKey: "admin",
            isSelf: false,
            isManageable: true,
            overrides: [
              { permissionKey: "crm.inventory.riva.view", effect: "allow", reason: null },
            ],
          },
        ],
        assignableRoles: ["admin"],
        manageablePermissions: ["crm.inventory.riva.view"],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: true,
        canManageUsers: true,
        canApproveUsers: false,
        reportingScopes: [],
      }),
    );
    const checkboxes = markup.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes).toHaveLength(43);
    for (const checkbox of checkboxes) {
      expect(checkbox).not.toContain('checked=""');
      expect(checkbox).toContain('disabled=""');
    }
    expect(markup).toContain("Conta sem acesso");
    expect(markup).toContain('admin-section-count">0 acessos');
    expect(markup).not.toContain("Salvar alterações");
  });
  it("expõe aprovação pendente com papel e escopo, sem motivo manual", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000002",
            email: "pendente@example.test",
            isActive: false,
            accessStatus: "pending",
            roleKey: "pending",
            isSelf: false,
            isManageable: true,
            inheritedPermissions: [],
            overrides: [],
            permissionDetailsAvailable: true,
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
  it("explica a proteção de outro Administrador e não renderiza controles mutáveis", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000005",
            email: "admin-protegido@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "admin",
            isSelf: false,
            isManageable: false,
            inheritedPermissions: [...ROLE_INHERITED_PERMISSIONS.admin],
            overrides: [],
            permissionDetailsAvailable: true,
          },
        ],
        assignableRoles: [
          "coordinator",
          "manager_house",
          "manager_imob",
          "broker_house",
          "broker_imob",
        ],
        manageablePermissions: ["crm.dashboard.view"],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: false,
        canManageUsers: true,
        canApproveUsers: true,
        reportingScopes: [],
      }),
    );

    expect(markup).toContain('class="admin-protected-account-badge" role="status"');
    expect(markup).toContain("Protegida pelo Master");
    expect(markup).toContain(
      "Somente o Master pode alterar papel, permissões ou status de outro Administrador.",
    );
    expect(markup).not.toContain("Salvar papel");
    expect(markup).not.toContain("Incluir na alteração");
    expect(markup).not.toContain("Desativar usuário");
    expect(markup).not.toContain('name="roleKey"');
    expect(markup).not.toContain('name="effect"');
  });

  it("mantém os controles de outro Administrador disponíveis para o Master", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000006",
            email: "admin-gerenciavel@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "admin",
            isSelf: false,
            isManageable: true,
            inheritedPermissions: [...ROLE_INHERITED_PERMISSIONS.admin],
            overrides: [],
            permissionDetailsAvailable: true,
          },
        ],
        assignableRoles: [
          "admin",
          "coordinator",
          "manager_house",
          "manager_imob",
          "broker_house",
          "broker_imob",
        ],
        manageablePermissions: ["crm.dashboard.view"],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: true,
        canManageUsers: true,
        canApproveUsers: true,
        reportingScopes: [],
      }),
    );

    expect(markup).not.toContain("Somente o Master pode alterar");
    expect(markup).toContain("Salvar papel");
    expect(markup).toContain("Clique para ajustar o rascunho");
    expect(markup).toContain("Usar padrão do perfil");
    expect(markup).toContain("Desativar usuário");
    expect(markup).toContain('name="roleKey"');
    expect(markup).not.toContain('name="effect"');
  });
  it("não renderiza caixas nem conta permissões quando os detalhes estão restritos", () => {
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        initialRoleDefaults: ROLE_INHERITED_PERMISSIONS,
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000008",
            email: "restrito@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "admin",
            isSelf: false,
            isManageable: false,
            inheritedPermissions: ROLE_INHERITED_PERMISSIONS.admin,
            overrides: [],
            permissionDetailsAvailable: false,
          },
        ],
        initialTotalCount: 40,
        initialHasMore: true,
        initialNextOffset: 6,
        initialSummary: { total: 40, active: 32, pending: 5, revoked: 3 },
        assignableRoles: [],
        manageablePermissions: [],
        canManageRoles: false,
        canManagePermissions: false,
        isMasterPermissionManager: false,
        canManageUsers: false,
        canApproveUsers: false,
        reportingScopes: [],
      }),
    );
    expect(markup).toContain("Detalhes de acesso efetivo indisponíveis");
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).not.toContain("25 acessos");
    expect(markup).toContain("1 de 40");
    expect(markup).toContain("Carregar mais usuários");
    expect(markup).not.toContain("Fim da lista.");
    expect(markup).toMatch(/Total de usuários<\/span><strong[^>]*>40<\/strong>/);
    expect(markup).toMatch(/Com acesso ativo<\/span><strong[^>]*>32<\/strong>/);
  });
  it("não exibe nem oferece salvar módulos ausentes do catálogo de 42 chaves", () => {
    const absent = new Set([
      "crm.management.forecast.view",
      "crm.management.forecast.values.edit",
      "crm.read_model_v3.view",
      "crm.read_model_v3.ranking.view",
      "crm.read_model_v3.partnerships.view",
      "crm.read_model_v3.stock.view",
      "crm.commercial_engine.execute",
      "crm.commercial_policy.manage",
    ]);
    const keys = ROLE_INHERITED_PERMISSIONS.admin.filter((key) => !absent.has(key));
    const markup = renderToStaticMarkup(
      createElement(UserAccessManager, {
        users: [
          {
            userId: "81000000-0000-4000-8000-000000000009",
            email: "catalogo@example.test",
            isActive: true,
            accessStatus: "approved",
            roleKey: "admin",
            isSelf: false,
            isManageable: true,
            inheritedPermissions: keys,
            overrides: [],
            permissionDetailsAvailable: true,
          },
        ],
        initialRoleDefaults: { admin: keys },
        assignableRoles: ["admin"],
        manageablePermissions: [...ROLE_INHERITED_PERMISSIONS.admin],
        canManageRoles: true,
        canManagePermissions: true,
        isMasterPermissionManager: true,
        canManageUsers: true,
        canApproveUsers: false,
        reportingScopes: [],
      }),
    );
    expect(keys).toHaveLength(42);
    expect(keys).not.toContain("crm.management.forecast.view");
    expect(markup).not.toContain('aria-label="Acesso a Previsão"');
    expect(markup).not.toContain("Executar motores comerciais");
    expect(markup).not.toContain("Gerenciar políticas comerciais");
    expect(markup).not.toContain("read model v3");
    expect(markup).toContain('aria-label="Acesso a RIVA"');
    expect(markup).toContain('aria-label="Acesso a DIRECIONAL"');
    const checkboxes = [...markup.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(
      ([input]) => input,
    );
    expect(checkboxes).toHaveLength(39);
    expect(checkboxes.every((input) => input.includes('checked=""'))).toBe(true);
  });
});
