import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigation: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission: mocks.enforce }));
vi.mock("@/lib/authorization/guards", () => ({
  hasPermission: (context: { permissions: string[] }, key: string) =>
    context.permissions.includes(key),
}));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.navigation }));
import SettingsPage from "@/app/(protected)/app/configuracoes/page";
import AdminHomePage from "@/app/(protected)/admin/page";

beforeEach(() => vi.resetAllMocks());

describe("hub links follow each persisted page access", () => {
  it("opens only the selected settings page even without configuration editing", async () => {
    mocks.enforce.mockResolvedValue({ permissions: ["crm.settings.view"] });
    mocks.navigation.mockResolvedValue([{ path: "/app/configuracoes/metas/pontos" }]);
    const markup = renderToStaticMarkup(await SettingsPage());
    expect(markup).toContain('href="/app/configuracoes/metas/pontos"');
    expect(markup).not.toContain('href="/app/configuracoes/metas"');
    expect(markup).not.toContain('href="/app/configuracoes/recurso-mkt"');
    expect(markup).toContain("Edição de configurações indisponível.");
  });

  it("does not expose denied or inactive destinations from administration", async () => {
    mocks.enforce.mockResolvedValue({
      permissions: ["users.view", "pages.manage", "crm.settings.manage"],
    });
    mocks.navigation.mockResolvedValue([{ path: "/admin/usuarios" }]);
    const markup = renderToStaticMarkup(await AdminHomePage());
    expect(markup).toContain('href="/admin/usuarios"');
    expect(markup).not.toContain('href="/admin/paginas"');
    expect(markup).not.toContain('href="/app/configuracoes/conectar-sistemas"');
  });
});
