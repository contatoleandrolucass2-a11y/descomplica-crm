import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforcePageAccess: vi.fn(),
  renderClient: vi.fn(),
}));

vi.mock("@/lib/authorization/enforce", () => ({
  enforcePageAccess: mocks.enforcePageAccess,
}));

vi.mock("@/app/(protected)/app/leads/_components/LeadPlusClient", () => ({
  LeadPlusClient: mocks.renderClient,
}));

import LeadActivitiesPage from "@/app/(protected)/app/leads/atividades/page";
import LeadFunnelPage from "@/app/(protected)/app/leads/funil/page";
import LeadsListPage from "@/app/(protected)/app/leads/lista/page";
import LeadsHubPage from "@/app/(protected)/app/leads/page";

const routes = [
  ["hub", LeadsHubPage, "/app/leads", "Leads"],
  ["lista", LeadsListPage, "/app/leads/lista", "Leads"],
  ["atividades", LeadActivitiesPage, "/app/leads/atividades", "Leads"],
  ["funil", LeadFunnelPage, "/app/leads/funil", "Funil"],
] as const;

describe("DESCOMPLICA LEAD protected pages", () => {
  beforeEach(() => {
    mocks.enforcePageAccess.mockReset().mockResolvedValue({ permissions: [] });
    mocks.renderClient
      .mockReset()
      .mockImplementation(({ initialScreen }: { initialScreen: string }) => (
        <section data-lead-plus-screen={initialScreen}>DESCOMPLICA LEAD</section>
      ));
  });

  it.each(routes)(
    "opens %s in the replacement workspace after its page guard",
    async (_, Page, path, screen) => {
      const workspace = await Page();

      expect(mocks.enforcePageAccess).toHaveBeenCalledExactlyOnceWith(path);
      expect(workspace.props).toEqual({ initialScreen: screen });
      expect(mocks.renderClient).not.toHaveBeenCalled();

      const markup = renderToStaticMarkup(workspace);
      expect(mocks.renderClient).toHaveBeenCalledTimes(1);
      expect(markup).toContain(`data-lead-plus-screen="${screen}"`);
      expect(markup).toContain("DESCOMPLICA LEAD");
      expect(markup).not.toContain("Fonte não configurada");
      expect(markup).not.toContain("Lead demonstrativo");
      expect(markup).not.toContain('type="password"');
    },
  );

  it.each(routes)(
    "does not render %s when the canonical page guard denies access",
    async (_, Page, path) => {
      const denied = new Error("forbidden");
      mocks.enforcePageAccess.mockRejectedValueOnce(denied);

      await expect(Page()).rejects.toBe(denied);
      expect(mocks.enforcePageAccess).toHaveBeenCalledExactlyOnceWith(path);
      expect(mocks.renderClient).not.toHaveBeenCalled();
    },
  );
});
