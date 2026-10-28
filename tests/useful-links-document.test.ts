import { describe, expect, it } from "vitest";

import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import {
  createDefaultUsefulLinksDocument,
  usefulLinksDocumentSchema,
} from "@/lib/crm/useful-links/document";

function page(slug: string) {
  return usefulLinksPages.find((entry) => entry.slug === slug)!;
}

describe("documentos editáveis de Links Úteis", () => {
  it("cria o organograma vertical e lateral com os quatro cards solicitados", () => {
    const document = createDefaultUsefulLinksDocument(page("grupos-whatsapp"));
    expect(usefulLinksDocumentSchema.parse(document)).toEqual(document);
    expect(document.cards).toHaveLength(5);
    const chart = document.cards[0];
    expect(chart?.kind).toBe("org-chart");
    if (!chart || chart.kind !== "org-chart") throw new Error("Organograma ausente");
    expect(chart.nodes.map(({ role }) => role)).toEqual([
      "Diretor Comercial",
      "Diretor de Vendas",
      "Gerente Regional",
      "Gerente Regional",
      "Gerente Regional",
      "Gerente Regional",
    ]);
    expect(chart.nodes.filter(({ parentId }) => parentId === "diretor-vendas")).toHaveLength(4);
    expect(document.cards.slice(1).map(({ title }) => title)).toEqual([
      "Acessar os grupos das CCAs",
      "Comunidade Direcional",
      "Grupo de propostas — unidades Direcional",
      "Grupo de apoio",
    ]);
  });

  it("divide Lojas Horários por endereço e preserva horários e exceções", () => {
    const document = createDefaultUsefulLinksDocument(page("lojas-horarios"));
    expect(usefulLinksDocumentSchema.parse(document)).toEqual(document);
    expect(document.cards).toHaveLength(8);
    const text = JSON.stringify(document);
    expect(text).toContain("Residencial Despertar · Terrase — Vila Ema");
    expect(text).toContain("Conquista Clube São Miguel · Conquista Clube Itaim Paulista");
    expect(text).toContain("011 Brooklin Riva");
    expect(text).toContain("Mirante Jardim das Esmeraldas");
    expect(text).toContain("9:00 às 20:00");
    expect(text).toContain("9:00 às 18:00");
    expect(text).toContain("25/12");
    expect(text).toContain("01/01");
  });

  it("rejeita links executáveis, ciclos e posições duplicadas", () => {
    const document = createDefaultUsefulLinksDocument(page("grupos-whatsapp"));
    const chart = document.cards[0];
    if (!chart || chart.kind !== "org-chart") throw new Error("Organograma ausente");
    const invalid = structuredClone(document);
    const invalidChart = invalid.cards[0];
    if (!invalidChart || invalidChart.kind !== "org-chart") throw new Error("Organograma ausente");
    invalidChart.nodes[0]!.parentId = "diretor-vendas";
    invalidChart.nodes[1]!.href = "javascript:alert(1)";
    invalid.cards[1]!.layout.order = invalid.cards[0]!.layout.order;
    expect(usefulLinksDocumentSchema.safeParse(invalid).success).toBe(false);
  });
});
