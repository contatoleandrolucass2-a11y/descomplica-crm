import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { current: {} as Record<string, unknown> },
  paths: [] as string[],
}));
vi.mock("../lib/crm/lead-plus/client/Auth", () => ({ useAuth: () => mocks.auth.current }));
vi.mock("../lib/crm/lead-plus/client/api", () => ({
  api: vi.fn(),
  LeadApiError: class extends Error {},
  useApi: (path: string) => {
    mocks.paths.push(path);
    return {
      data: path.startsWith("/crm-users?")
        ? {
            data: [{ id: "crm-1", name: "Usuário CRM", email: "crm@example.invalid" }],
            total: 1,
            offset: 0,
            limit: 20,
          }
        : { data: [] },
      loading: false,
      error: "",
      refresh: vi.fn(),
    };
  },
}));
vi.mock("../lib/crm/lead-plus/client/MetaCampaignSelection", () => ({
  default: () => <div>Campanhas globais editáveis</div>,
}));
import { ConnectedIntegrations } from "../lib/crm/lead-plus/client/ConnectedCRM";
import UserViewSelector from "../lib/crm/lead-plus/client/UserViewSelector";
import CrmUserLinks from "../lib/crm/lead-plus/client/CrmUserLinks";
beforeEach(() => {
  mocks.paths = [];
  mocks.auth.current = {
    actor: { id: "actor", name: "Admin original", role: "admin" },
    user: { id: "actor", role: "admin", scope: "all" },
    viewable_users: [{ id: "target", name: "Corretora alvo", role: "broker", team: "" }],
    view_as: { active: false },
    can: () => true,
    switchUser: vi.fn(),
    refresh: vi.fn(),
  };
});
describe("LEAD+ controles de usuário", () => {
  it("mostra aviso persistente com alvo e ator, mesmo sem opções disponíveis", () => {
    mocks.auth.current.view_as = {
      active: true,
      target_id: "target",
      target_name: "Corretora alvo",
    };
    mocks.auth.current.viewable_users = [];
    const markup = renderToStaticMarkup(<UserViewSelector />);
    expect(markup).toContain("Atenção: você está visualizando Corretora alvo.");
    expect(markup).toContain("Qualquer alteração será registrada na auditoria de Admin original.");
    expect(markup).toContain("Voltar ao meu usuário");
  });
  it("oferece visualização somente para os usuários fornecidos pelo servidor", () => {
    const markup = renderToStaticMarkup(<UserViewSelector />);
    expect(markup).toContain('value="target"');
    expect(markup).toContain("Corretora alvo");
    expect(markup).not.toContain("senha");
    mocks.auth.current.actor = undefined;
    expect(renderToStaticMarkup(<UserViewSelector />)).toBe("");
  });
  it("vincula usuários do diretório, sem formulário para criar nome e e-mail", () => {
    const markup = renderToStaticMarkup(<CrmUserLinks />);
    expect(markup).toContain("Usuário CRM");
    expect(markup).toContain("crm@example.invalid");
    expect(markup).toContain("Vincular");
    expect(markup).not.toContain('type="email"');
    expect(markup).not.toContain('type="password"');
    mocks.auth.current.can = () => false;
    expect(renderToStaticMarkup(<CrmUserLinks />)).not.toContain(
      "Vincular usuário existente do CRM",
    );
  });
});

describe("LEAD+ configuração global e diretório do CRM", () => {
  it.each(["superintendent", "manager", "broker"])(
    "não consulta diretório nem permite vínculo para %s",
    (role) => {
      mocks.auth.current.actor = { id: "actor", role };
      mocks.auth.current.user = {
        id: "actor",
        role,
        scope: role === "superintendent" ? "all" : "team",
      };
      const markup = renderToStaticMarkup(<CrmUserLinks />);
      expect(markup).toContain("Usuários vinculados");
      expect(markup).not.toContain("Vincular usuário existente do CRM");
      expect(mocks.paths.some((path) => path.startsWith("/crm-users"))).toBe(false);
    },
  );
  it("não consulta diretório durante visualização de outro usuário, mesmo para Admin", () => {
    mocks.auth.current.view_as = { active: true, target_id: "target" };
    expect(renderToStaticMarkup(<CrmUserLinks />)).not.toContain(
      "Vincular usuário existente do CRM",
    );
    expect(mocks.paths.some((path) => path.startsWith("/crm-users"))).toBe(false);
  });
  it("consulta diretório somente para Admin original autorizado, com fallback do usuário", () => {
    renderToStaticMarkup(<CrmUserLinks />);
    expect(mocks.paths.some((path) => path.startsWith("/crm-users?"))).toBe(true);
    mocks.paths = [];
    mocks.auth.current.actor = undefined;
    expect(renderToStaticMarkup(<CrmUserLinks />)).toContain("Vincular usuário existente do CRM");
    expect(mocks.paths.some((path) => path.startsWith("/crm-users?"))).toBe(true);
  });
  it.each(["admin", "superintendent"])(
    "oferece campanhas globais para %s com escopo global e permissão",
    (role) => {
      mocks.auth.current.user = { role, scope: "all" };
      expect(renderToStaticMarkup(<ConnectedIntegrations />)).toContain(
        "Campanhas globais editáveis",
      );
    },
  );
  it.each(["team", "own", undefined])("oculta edição global para escopo %s", (scope) => {
    mocks.auth.current.user = { role: "manager", scope };
    const markup = renderToStaticMarkup(<ConnectedIntegrations />);
    expect(markup).not.toContain("Campanhas globais editáveis");
    expect(markup).toContain("Leads recebidos do Facebook");
  });
  it("oculta campanhas globais sem a permissão de configurações", () => {
    mocks.auth.current.can = () => false;
    expect(renderToStaticMarkup(<ConnectedIntegrations />)).not.toContain(
      "Campanhas globais editáveis",
    );
  });
});
