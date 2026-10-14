import { readFileSync } from "node:fs";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforcePermission } = vi.hoisted(() => ({ enforcePermission: vi.fn() }));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission }));

import RankingPage from "@/app/(protected)/app/ranking/page";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
function elements(node: Node): Element[] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(elements) : []),
  ];
}
function attr(node: Element, name: string) {
  return node.attrs.find((entry) => entry.name === name)?.value;
}
function text(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(text).join("")
      : "";
}
async function rendered() {
  const html = renderToStaticMarkup(await RankingPage());
  return { html, nodes: elements(parseFragment(html)) };
}

describe("ranking de parcerias indisponivel", () => {
  beforeEach(() => {
    enforcePermission.mockReset();
    enforcePermission.mockResolvedValue({});
  });

  it("preserva exclusivamente o guard da rota e propaga sua negativa", async () => {
    await rendered();
    expect(enforcePermission).toHaveBeenCalledExactlyOnceWith("crm.ranking.view");
    enforcePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(RankingPage()).rejects.toThrow("FORBIDDEN");
  });

  it("nao importa leitores, cliente de banco, fixtures ou calculos Salesforce", () => {
    const source = readFileSync(
      new URL("../app/(protected)/app/ranking/page.tsx", import.meta.url),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual([
      "lucide-react",
      "@/app/(protected)/_components/ManagementCanvas",
      "@/app/(protected)/app/_components/analytics",
      "@/lib/authorization/enforce",
      "./RankingCanvas.module.css",
    ]);
    expect(source).not.toMatch(
      /fetch\(|\.rpc\(|loadRankingReadModel|loadReadModelV3|fixture|mock/i,
    );
  });

  it("mostra os dois rankings sem linhas financeiras ficticias", async () => {
    const { html, nodes } = await rendered();
    expect(nodes.filter((node) => node.tagName === "table")).toHaveLength(2);
    for (const table of nodes.filter((node) => node.tagName === "table")) {
      expect(text(table)).toMatch(/Top 10 (imobiliárias|empreendimentos)/);
      expect(text(table)).toContain("Variação");
      expect(text(table)).toContain("VGV");
      expect(text(table)).toContain("Total de contratos");
      const body = elements(table).find((node) => node.tagName === "tbody")!;
      expect(elements(body).filter((node) => node.tagName === "tr")).toHaveLength(0);
    }
    expect(html).toContain("Fonte Qlik ainda não homologada");
    expect(html).not.toMatch(/R\$|Ranking por pontos|Roleta|Conectada|Sem dados|Nenhum resultado/);
  });

  it("limita o contexto ao recorte confirmado sem habilitar controles", async () => {
    const { html, nodes } = await rendered();
    expect(html).toContain("Recorte confirmado. Atualização automática ainda indisponível.");
    expect(html).toContain("Fonte Qlik ainda não homologada");
    expect(nodes.filter((node) => node.tagName === "option").map(text)).toEqual([
      "Direcional",
      "SP CAPITAL",
      "CANAL IMOB",
    ]);
    for (const control of nodes.filter((node) =>
      ["input", "select", "button"].includes(node.tagName),
    )) {
      expect(attr(control, "disabled")).toBe("");
    }
    expect(nodes.filter((node) => node.tagName === "a")).toHaveLength(0);
    for (const select of nodes.filter((node) => node.tagName === "select")) {
      expect(attr(select, "aria-describedby")).toBe("scope-status");
    }
  });

  it("nao presume competencia, intervalo ou trimestre disponivel", async () => {
    const { nodes } = await rendered();
    const inputs = nodes.filter((node) => node.tagName === "input");
    expect(
      inputs.filter((node) => attr(node, "type") === "radio").map((node) => attr(node, "value")),
    ).toEqual(["Mês atual", "Mês anterior", "Ano", "Personalizado"]);
    expect(inputs.some((node) => attr(node, "checked") !== undefined)).toBe(false);
    expect(inputs.filter((node) => attr(node, "type") === "month")).toHaveLength(2);
    expect(inputs.some((node) => attr(node, "type") === "date")).toBe(false);
    for (const node of inputs.filter((node) =>
      ["number", "month"].includes(attr(node, "type") ?? ""),
    )) {
      for (const name of ["value", "min", "max"]) expect(attr(node, name)).toBeUndefined();
    }
    const checkboxes = inputs.filter((node) => attr(node, "type") === "checkbox");
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes.map((node) => attr(node, "value"))).toEqual(["1", "2", "3", "4"]);
    for (const checkbox of checkboxes) {
      expect(attr(checkbox, "disabled")).toBe("");
      expect(attr(checkbox, "aria-describedby")).toBe("period-availability");
    }
    expect(
      nodes
        .filter(
          (node) =>
            node.tagName === "label" &&
            elements(node).some((child) => attr(child, "type") === "checkbox"),
        )
        .map(text),
    ).toEqual(["1º trimestre", "2º trimestre", "3º trimestre", "4º trimestre"]);
    expect(nodes.filter((node) => node.tagName === "button")).toHaveLength(0);
  });

  it("mantem podio, alvos, resumos e timestamps indisponiveis sem cards aninhados", async () => {
    const { nodes } = await rendered();
    const cards = nodes.filter((node) => node.tagName === "article");
    expect(cards).toHaveLength(3);
    expect(cards.map((node) => attr(node, "aria-label"))).toEqual([
      "Prata: resultado indisponível",
      "Ouro: resultado indisponível",
      "Bronze: resultado indisponível",
    ]);
    for (const card of cards) {
      expect(elements(card).filter((node) => node.tagName === "article")).toHaveLength(1);
      expect(text(card)).toContain("Próximo alvo");
      expect(text(card)).toContain("Diferença ao alvo");
    }
    const labels = nodes.filter((node) => node.tagName === "dt").map(text);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Atualização da fonte",
        "Processamento",
        "Período disponível",
        "Imobiliárias com produção",
        "Empreendimentos com produção",
      ]),
    );
    for (const value of nodes.filter((node) => node.tagName === "dd"))
      expect(text(value)).toBe("Indisponível");
  });
});
