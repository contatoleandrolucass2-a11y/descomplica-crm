import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforcePageAccess: vi.fn(),
  getAuthorizedNavigation: vi.fn(),
}));

vi.mock("@/lib/authorization/enforce", () => ({
  enforcePageAccess: mocks.enforcePageAccess,
}));

vi.mock("@/lib/navigation/pages", () => ({
  getAuthorizedNavigation: mocks.getAuthorizedNavigation,
}));

import LeadActivitiesPage from "@/app/(protected)/app/leads/atividades/page";
import LeadFunnelPage from "@/app/(protected)/app/leads/funil/page";
import LeadsListPage from "@/app/(protected)/app/leads/lista/page";
import LeadsHubPage from "@/app/(protected)/app/leads/page";

const authorizedLeadAreas = ["/app/leads/lista", "/app/leads/atividades", "/app/leads/funil"].map(
  (path, index) => ({
    key: `lead-${index}`,
    path,
    name: path,
    description: path,
    section: "leads",
    parentKey: "crm.leads",
    sortOrder: index,
  }),
);

describe("Lead workspace", () => {
  beforeEach(() => {
    mocks.enforcePageAccess.mockReset().mockResolvedValue({ permissions: [] });
    mocks.getAuthorizedNavigation.mockReset().mockResolvedValue(authorizedLeadAreas);
  });

  it("renders only authorized areas from the protected Lead hub", async () => {
    const markup = renderToStaticMarkup(await LeadsHubPage());

    expect(mocks.enforcePageAccess).toHaveBeenCalledExactlyOnceWith("/app/leads");
    expect(markup).toContain("Central de acompanhamento dos contatos");
    expect(markup).toContain('href="/app/leads/lista"');
    expect(markup).toContain('href="/app/leads/atividades"');
    expect(markup).toContain('href="/app/leads/funil"');
    expect(markup).toContain("Fonte não configurada");
    expect(markup).not.toContain("Lead demonstrativo");
  });

  it.each([
    ["lista", LeadsListPage, "/app/leads/lista", "Nenhum lead foi consultado"],
    ["atividades", LeadActivitiesPage, "/app/leads/atividades", "Agenda indisponível"],
    ["funil", LeadFunnelPage, "/app/leads/funil", "Etapas do funil ainda não configuradas"],
  ] as const)("renders the honest unavailable state for %s", async (_, Page, path, message) => {
    const markup = renderToStaticMarkup(await Page());

    expect(mocks.enforcePageAccess).toHaveBeenCalledExactlyOnceWith(path);
    expect(markup).toContain("Fonte não configurada");
    expect(markup).toContain(message);
    expect(markup).not.toContain(">0<");
  });
});
