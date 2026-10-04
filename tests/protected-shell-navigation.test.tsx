import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  enforceAuthorization: vi.fn(),
  getAuthorizedNavigation: vi.fn(),
  getCurrentUser: vi.fn(),
  getDisabledNavigationItems: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => createElement("img", props),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
vi.mock("@/lib/auth/actions/logout", () => ({ logoutAction: "/logout" }));
vi.mock("@/lib/authorization/enforce", () => ({
  enforceAuthorization: mocks.enforceAuthorization,
}));
vi.mock("@/lib/authorization/guards", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/navigation/pages", () => ({
  getAuthorizedNavigation: mocks.getAuthorizedNavigation,
  getDisabledNavigationItems: mocks.getDisabledNavigationItems,
}));

import ProtectedLayout from "../app/(protected)/layout";

const dashboard = {
  key: "crm.dashboard",
  path: "/app",
  name: "Dashboard",
  description: "Visão geral",
  section: "crm",
  permissionKey: "crm.dashboard.view" as const,
  parentKey: null,
  sortOrder: 10,
  isNavigation: true,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceAuthorization.mockResolvedValue({
    userId: "10000000-0000-4000-8000-000000000001",
    roleKey: "user",
    level: 10,
    permissions: ["pages.view", "crm.dashboard.view"],
  });
  mocks.getAuthorizedNavigation.mockResolvedValue([dashboard]);
  mocks.getDisabledNavigationItems.mockReturnValue([]);
  mocks.cookies.mockResolvedValue({ get: () => undefined });
});

describe("protected shell navigation", () => {
  it("keeps a long synthetic identity intact while withholding unauthorized admin labels", async () => {
    const identity =
      "qa.synthetic.identity.with.a.very.long.local.part+navigation@nonexistent.invalid";
    mocks.getCurrentUser.mockResolvedValue({ email: identity });
    mocks.getAuthorizedNavigation.mockResolvedValue([
      dashboard,
      {
        ...dashboard,
        key: "admin.users",
        path: "/admin/usuarios",
        name: "Usuários indevidos",
        description: "Filho administrativo sem raiz autorizada",
        section: "admin",
        permissionKey: "users.view",
        parentKey: "admin.home",
        sortOrder: 20,
      },
    ]);

    const markup = renderToStaticMarkup(
      await ProtectedLayout({ children: createElement("main", null, "Conteúdo autorizado") }),
    );

    expect(markup.match(/<header\b/g)).toHaveLength(1);
    expect(markup).toContain("data-protected-topbar");
    expect(markup).toContain('href="#protected-main-content"');
    expect(markup).toContain("Pular para o conteúdo");
    expect(markup).toMatch(
      /id="protected-main-content"[^>]*data-protected-main-content="true"[^>]*tabindex="-1"/,
    );
    expect(markup).toContain(`title="${identity}"`);
    expect(markup).toContain(identity);
    expect(markup).not.toContain('href="/admin"');
    expect(markup).not.toContain('href="/admin/usuarios"');
    expect(markup).not.toMatch(/Administração|Gerenciar usuários|Gerenciar páginas/);
    expect(markup).not.toContain("Usuários indevidos");
    expect(markup).toContain("Conteúdo autorizado");
  });
});
