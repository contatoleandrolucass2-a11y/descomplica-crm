import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PAGE_REGISTRY } from "../lib/navigation/registry";

const route = vi.hoisted(() => ({ pathname: "/app/links-uteis/grupos-whatsapp" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

import { UsefulLinksSidebar } from "../app/(protected)/app/links-uteis/UsefulLinksSidebar";

const pages = PAGE_REGISTRY.filter(
  (page) => page.pageKey === "crm.useful_links" || page.parentKey === "crm.useful_links",
).map(({ pageKey: key, name, path }) => ({ key, name, path }));

beforeEach(() => {
  route.pathname = "/app/links-uteis/grupos-whatsapp";
});

describe("Links Úteis sidebar", () => {
  it("renders only the authorized Links Úteis destinations", () => {
    const markup = renderToStaticMarkup(
      <UsefulLinksSidebar pages={pages}>Conteúdo</UsefulLinksSidebar>,
    );

    expect(markup).toContain('aria-label="Páginas de Links Úteis"');
    expect(markup).toContain('aria-label="Grupos WhatsApp" aria-current="page"');
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain("Conteúdo");
    expect(markup).not.toContain("Dashboard");
  });

  it("does not invent destinations omitted by authorization", () => {
    const allowed = pages.filter(
      (page) =>
        page.key === "crm.useful_links.grupos_whatsapp" ||
        page.key === "crm.useful_links.lojas_horarios",
    );
    const markup = renderToStaticMarkup(
      <UsefulLinksSidebar pages={allowed}>Conteúdo</UsefulLinksSidebar>,
    );

    expect(markup).toContain('href="/app/links-uteis/grupos-whatsapp"');
    expect(markup).toContain('href="/app/links-uteis/lojas-horarios"');
    expect(markup).not.toContain('href="/app/links-uteis/relacionamento"');
  });

  it("assigns a distinct semantic icon to every Links Úteis destination", () => {
    const markup = renderToStaticMarkup(
      <UsefulLinksSidebar pages={pages}>Conteúdo</UsefulLinksSidebar>,
    );

    for (const icon of [
      "overview",
      "whatsapp",
      "stores",
      "relationship",
      "rules",
      "campaign",
      "app",
      "resources",
    ]) {
      expect(markup).toContain(`data-useful-links-icon="${icon}"`);
    }
    expect(markup.match(/data-useful-links-icon=/g)).toHaveLength(8);
  });

  it("keeps the shared Dashboard and top navigation files free of Links Úteis behavior", () => {
    const sharedFiles = [
      "../app/(protected)/_components/DashboardShell.tsx",
      "../app/(protected)/_components/AuthorizedNavigation.tsx",
      "../app/(protected)/_components/ProtectedShell.module.css",
    ].map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));

    for (const source of sharedFiles) {
      expect(source).not.toContain("crm.useful_links");
      expect(source).not.toContain("data-context-sidebar-navigation");
    }
  });
});
