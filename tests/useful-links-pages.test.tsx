import { parseFragment } from "parse5";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), navigation: vi.fn() }));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePageAccess: mocks.enforce }));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.navigation }));

import HubPage from "@/app/(protected)/app/links-uteis/page";
import WhatsAppPage from "@/app/(protected)/app/links-uteis/grupos-whatsapp/page";
import StoresPage from "@/app/(protected)/app/links-uteis/lojas-horarios/page";
import RelationshipPage from "@/app/(protected)/app/links-uteis/relacionamento/page";
import RulesPage from "@/app/(protected)/app/links-uteis/regras-comerciais/page";
import CampaignPage from "@/app/(protected)/app/links-uteis/campanha-do-mes/page";
import BoraPage from "@/app/(protected)/app/links-uteis/app-bora-vender/page";
import MaterialsPage from "@/app/(protected)/app/links-uteis/linktree-liveprint/page";
import { UsefulLinksContent } from "@/app/(protected)/app/links-uteis/UsefulLinksContent";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";

const routes = [
  ["", HubPage],
  ["/grupos-whatsapp", WhatsAppPage],
  ["/lojas-horarios", StoresPage],
  ["/relacionamento", RelationshipPage],
  ["/regras-comerciais", RulesPage],
  ["/campanha-do-mes", CampaignPage],
  ["/app-bora-vender", BoraPage],
  ["/linktree-liveprint", MaterialsPage],
] as const;

type HtmlNode = {
  nodeName: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[];
};

function descendants(node: HtmlNode): HtmlNode[] {
  return [node, ...(node.childNodes ?? []).flatMap(descendants)];
}

function anchors(markup: string) {
  return descendants(parseFragment(markup))
    .filter((node) => node.nodeName === "a")
    .map((node) => ({
      attributes: Object.fromEntries((node.attrs ?? []).map((attr) => [attr.name, attr.value])),
      text: descendants(node)
        .filter((child) => child.nodeName === "#text")
        .map((child) => child.value)
        .join(""),
    }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforce.mockResolvedValue({});
  mocks.navigation.mockResolvedValue([]);
});

describe("Links Úteis: rotas protegidas", () => {
  it.each(routes)("aplica o guard individual de /app/links-uteis%s", async (suffix, Page) => {
    await Page();
    expect(mocks.enforce).toHaveBeenCalledExactlyOnceWith(`/app/links-uteis${suffix}`);
  });

  it.each(routes)(
    "interrompe /app/links-uteis%s antes de renderizar quando o guard nega",
    async (_suffix, Page) => {
      const denial = new Error("Acesso negado pelo catálogo persistido");
      mocks.enforce.mockRejectedValue(denial);
      await expect(Page()).rejects.toBe(denial);
      expect(mocks.navigation).not.toHaveBeenCalled();
    },
  );

  it("o hub mostra somente os conteúdos presentes na navegação autorizada", async () => {
    const context = { sessionId: "synthetic-session" };
    mocks.enforce.mockResolvedValue(context);
    mocks.navigation.mockResolvedValue([
      { path: "/app/links-uteis/lojas-horarios" },
      { path: "/app/links-uteis/app-bora-vender" },
      { path: "/app/ranking" },
    ]);
    const markup = renderToStaticMarkup(await HubPage());
    expect(mocks.navigation).toHaveBeenCalledExactlyOnceWith(context);
    expect(anchors(markup).map((anchor) => anchor.attributes.href)).toEqual([
      "/app/links-uteis/lojas-horarios",
      "/app/links-uteis/app-bora-vender",
    ]);
    expect(markup).not.toContain("Grupos WhatsApp");
    expect(markup).not.toContain("Ranking Geral");
  });

  it("expõe um estado vazio sem fabricar links quando nenhum filho está autorizado", async () => {
    const markup = renderToStaticMarkup(await HubPage());
    expect(markup).toContain("Nenhum conteúdo liberado para o seu acesso.");
    expect(anchors(markup)).toEqual([]);
  });
});

describe("Links Úteis: conteúdo e destinos", () => {
  it.each(usefulLinksPages)("renderiza $title com fonte e nomes de link acessíveis", (page) => {
    const markup = renderToStaticMarkup(<UsefulLinksContent page={page} />);
    const links = anchors(markup);
    expect(markup).toContain(page.title);
    expect(markup).not.toContain("Ranking Geral");
    expect(markup).toContain("Conteúdo da referência consultado em 27/10/2026.");
    expect(links.some((link) => link.attributes.href?.endsWith(`/page/${page.sourcePage}`))).toBe(
      true,
    );
    for (const link of links) {
      const href = link.attributes.href;
      const rel = link.attributes.rel;
      expect(href).toBeDefined();
      if (!href) throw new Error("Link renderizado sem href.");
      expect(link.text.trim().length).toBeGreaterThan(0);
      if (href.startsWith("/")) continue;
      expect(link.attributes.target).toBe("_blank");
      expect(rel).toBeDefined();
      if (!rel) throw new Error("Link externo renderizado sem rel.");
      expect(rel.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
      expect(link.text).toContain("abre em nova aba");
      expect(["https:", "tel:"]).toContain(new URL(href).protocol);
    }
  });

  it("preserva a matriz financeira transcrita e seu limite de uso como referência", () => {
    const page = usefulLinksPages.find((item) => item.slug === "regras-comerciais")!;
    const associative = page.sections.find((section) => section.title === "Regras Associativo")!;
    expect(associative.table).toEqual({
      headers: ["Parâmetro", "Renda a partir de R$ 3.700,00", "Renda abaixo de R$ 3.700,00"],
      rows: [
        ["Máximo da renda mensal", "50%", "48%"],
        ["Comprometimento de renda da parcela", "20%", "18%"],
        ["Percentual pró-soluto", "18%", "18%"],
      ],
    });
    expect(associative.paragraphs?.join(" ")).toContain(
      "reprovada automaticamente, sem margem para negociar",
    );
    expect(page.description).toContain("Valide as condições do mês");
    expect(page.sourcePage).toBe("p_85thpu1ttd");
    expect(
      page.sections.find((section) => section.title === "Comissionamento — imobiliárias chave")
        ?.table?.rows,
    ).toEqual([
      ["Sem pró-soluto", "5,00%"],
      ["1 até 36x", "4,50%"],
      ["37 até 48x", "4,25%"],
      ["49 até 52x", "4,00%"],
      ["53 até 60x", "3,75%"],
      ["61 até 65x", "3,50%"],
    ]);
    expect(
      page.sections.find((section) => section.title === "Comissionamento — imobiliária padrão")
        ?.table?.rows,
    ).toEqual([
      ["Sem pró-soluto", "4,75%"],
      ["1 até 36x", "4,25%"],
      ["37 até 48x", "4,00%"],
      ["49 até 52x", "3,75%"],
      ["53 até 60x", "3,50%"],
      ["61 até 65x", "3,25%"],
    ]);
  });

  it("não apresenta materiais históricos como campanha vigente", () => {
    const campaign = usefulLinksPages.find((page) => page.slug === "campanha-do-mes")!;
    const markup = renderToStaticMarkup(<UsefulLinksContent page={campaign} />);
    expect(markup).toContain("Julho/25");
    expect(markup).toContain("históricos");
    expect(markup).toContain("não comprovam uma campanha vigente");
  });

  it("mantém Lucas e Grupo de Apoio sem os destinos incorretos da referência", () => {
    const page = usefulLinksPages.find((item) => item.slug === "grupos-whatsapp")!;
    const items = page.sections.flatMap((section) => section.items ?? []);
    const lucas = items.find((item) => item.label.startsWith("Lucas"))!;
    expect(lucas.href).toBeUndefined();
    expect(lucas.description).toContain("difere do destino");
    const support = page.sections.find((section) => /grupo de apoio/i.test(section.title))!;
    expect(support.items?.every((item) => !item.href)).toBe(true);
    const markup = renderToStaticMarkup(<UsefulLinksContent page={page} />);
    expect(anchors(markup).some((anchor) => anchor.text.includes("Lucas"))).toBe(false);
    expect(
      anchors(markup).some((anchor) => anchor.attributes.href === "https://datastudio.google.com/"),
    ).toBe(false);
  });
});
