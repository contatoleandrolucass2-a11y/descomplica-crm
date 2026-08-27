import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SimulatorWorkspace } from "../app/(protected)/app/simulacao/_components/SimulatorWorkspace";
import {
  SIMULATORS,
  SIMULATOR_LIST,
  isSimulatorSlug,
  type SimulatorField,
} from "../lib/crm/simulators/catalog";

describe("simulator visual catalog", () => {
  it("maps the five user-approved simulator identities without inventing another route", () => {
    expect(SIMULATOR_LIST.map(({ slug, code }) => [slug, code])).toEqual([
      ["associativo-fluxo-linear", "WF13"],
      ["calcular-documentacao", "WF16"],
      ["caixa", "CAIXA"],
      ["tabela-direta", "WF14"],
      ["tabela-investidor", "WF15"],
    ]);
    expect(isSimulatorSlug("caixa")).toBe(true);
    expect(isSimulatorSlug("regra-nao-aprovada")).toBe(false);
  });

  it.each(SIMULATOR_LIST)("renders full $code composition with a blocked engine", (definition) => {
    const markup = renderToStaticMarkup(<SimulatorWorkspace definition={definition} />);
    const fieldCount = definition.sections.reduce(
      (total, section) => total + section.fields.length,
      0,
    );

    expect(definition.sections.length).toBeGreaterThan(1);
    expect(fieldCount).toBeGreaterThan(5);
    expect(definition.resultItems.length).toBeGreaterThan(3);
    expect(markup).toContain(definition.title);
    expect(markup).toContain("Cálculo temporariamente indisponível — regra aguardando validação");
    expect(markup).toContain("Nenhuma fórmula é executada enquanto o gate permanece desligado");
    expect(markup).toContain('aria-label="Ferramentas de simulação"');
    expect(markup).toContain('data-cta-state="enabled"');
    expect(markup).toContain('data-cta-state="blocked"');
    expect(markup).toContain('id="calculation-blocked-reason"');
    expect(markup).toContain("Motor bloqueado");
    expect(markup).toMatch(
      /data-cta-state="blocked"[^>]*disabled|disabled[^>]*data-cta-state="blocked"/,
    );
    if (definition.slug === "associativo-fluxo-linear") {
      expect(markup).toContain("Data do ato");
      expect(markup).toContain("somente leitura");
    } else {
      expect(markup).not.toContain("<output");
    }
    expect(markup).not.toContain("action=");
  });

  it("keeps the Tabela Investidor identity isolated from WF16", () => {
    const definition = SIMULATORS["tabela-investidor"];
    const markup = renderToStaticMarkup(<SimulatorWorkspace definition={definition} />);

    expect(definition).toMatchObject({
      slug: "tabela-investidor",
      code: "WF15",
      title: "Tabela Investidor",
      shortTitle: "Tabela Investidor",
    });
    expect(markup).toContain("Simulação · WF15");
    expect(markup).toContain("Tabela Investidor");
    expect(markup).toContain('data-cta-state="unavailable"');
    expect(markup).not.toContain("Calcular documentação");
  });

  it("keeps the required simulator stages visible", () => {
    expect(SIMULATORS["associativo-fluxo-linear"].sections.map(({ title }) => title)).toEqual([
      "Contexto oficial",
      "Formação do pró-soluto",
      "ATO — pagamento na assinatura",
      "SINAIS — pagamentos intermediários",
      "ANUAIS — vencimentos fixos em 15/12",
      "Política comercial",
    ]);
    expect(SIMULATORS["calcular-documentacao"].sections.map(({ title }) => title)).toEqual([
      "Perfil",
      "Tipo da compra",
      "Valores",
      "Estrutura financeira",
      "Resultado",
      "Resumo financeiro",
    ]);
    expect(SIMULATORS.caixa.sections.map(({ title }) => title)).toEqual(
      expect.arrayContaining([
        "Simulador · Cliente e imóvel",
        "Documentos · Perfil",
        "Documentos · Fase 1",
        "Documentos · Fase 2",
        "Diagnóstico",
        "Utilitários · Amortização",
        "Utilitários · Tempo de FGTS",
      ]),
    );
    expect(SIMULATORS["tabela-direta"].sections.map(({ title }) => title)).toEqual([
      "Identificação",
      "Estrutura financeira",
      "Cronograma",
      "Comparação",
    ]);
    expect(SIMULATORS["tabela-investidor"].sections.map(({ title }) => title)).toEqual([
      "Escolha a unidade",
      "Unidade selecionada",
      "Monte a proposta",
      "Intermediárias",
      "Quatro cenários padrão",
      "Fluxo personalizado",
    ]);
  });

  it("keeps commercial dates explicit and derives WF13 signal dates in the official engine", () => {
    const dateFields = SIMULATOR_LIST.flatMap((definition) =>
      definition.sections.flatMap((section) =>
        section.fields
          .filter((field) => field.type === "date")
          .map((field) => `${definition.code}:${field.label}`),
      ),
    );

    expect(dateFields).toEqual(
      expect.arrayContaining([
        "WF13:Data vigente",
        "WF13:Término da obra",
        "CAIXA:Data de nascimento",
        "CAIXA:Data inicial",
        "CAIXA:Data final",
        "WF14:Data da simulação",
        "WF14:Término da obra",
        "WF15:Data de término da obra",
        "WF15:Data inicial",
        "WF15:Data final do intervalo",
      ]),
    );

    const directTableMarkup = renderToStaticMarkup(
      <SimulatorWorkspace definition={SIMULATORS["tabela-direta"]} />,
    );
    expect(directTableMarkup).toContain('type="date"');
    expect(directTableMarkup).not.toMatch(/type="date"[^>]*value="[^\"]+"/);
    expect(SIMULATORS["calcular-documentacao"].resultItems).toEqual(
      expect.arrayContaining(["Data da simulação", "Primeira data de vencimento"]),
    );
  });

  it("renders WF13 as actionable only when the server authorizes the Master canary", () => {
    const markup = renderToStaticMarkup(
      <SimulatorWorkspace
        definition={SIMULATORS["associativo-fluxo-linear"]}
        executionEnabled
        releasedSimulatorSlugs={["associativo-fluxo-linear"]}
      />,
    );

    expect(markup).toContain("Motor oficial em validação Master");
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('data-cta-state="enabled"');
    expect(markup).not.toContain('data-cta-state="blocked"');
    expect(markup).toContain('value="84"');
    expect(markup).toMatch(/value="84"[^>]*readonly|readonly[^>]*value="84"/);
    expect(markup).toContain('aria-readonly="true"');
    expect(markup).toContain('min="1"');
    expect(markup).toContain('max="84"');
    expect(markup).toContain('step="1"');
    expect(markup).toContain("Limite máximo: 84 parcelas mensais");
    expect(markup).toContain("Política comercial pendente");
    expect(markup).toContain("Nenhuma confirmação manual é aceita");
    expect(markup).not.toContain('id="simulator-commercial-policy-policy-confirmed"');
    expect(markup).toContain("Ranking no Bora Vender");
    expect(markup).toContain('<option value="NÃO ELEGÍVEL">NÃO ELEGÍVEL</option>');
    expect(markup).toContain("Nenhuma data anual disponível");
    expect(markup).toContain('href="/app/simulacao/associativo-fluxo-linear"');
    for (const blockedSlug of [
      "calcular-documentacao",
      "caixa",
      "tabela-direta",
      "tabela-investidor",
    ]) {
      expect(markup).not.toContain(`href="/app/simulacao/${blockedSlug}"`);
    }
    expect(markup.match(/data-release-state="blocked"/g)).toHaveLength(4);
    expect(markup.match(/Aguardando autorização/g)).toHaveLength(4);
  });

  it("renders neutral tabs, repeaters, inventory pagination and local tools", () => {
    const caixaMarkup = renderToStaticMarkup(<SimulatorWorkspace definition={SIMULATORS.caixa} />);
    const investorMarkup = renderToStaticMarkup(
      <SimulatorWorkspace definition={SIMULATORS["tabela-investidor"]} />,
    );

    expect(caixaMarkup).toContain('role="tablist"');
    expect(caixaMarkup).toContain('role="tabpanel"');
    expect(caixaMarkup).toContain("Adicionar proponente");
    expect(caixaMarkup).toContain("Adicionar período");
    expect(caixaMarkup).toContain("Limpar");
    expect(caixaMarkup).toContain("Imprimir estrutura");
    expect(investorMarkup).toContain("Paginação preparada");
    expect(investorMarkup).toContain("Atualizar estoque");
    expect(investorMarkup).toContain("Adicionar intermediária");
    expect(investorMarkup).toContain("C1");
    expect(investorMarkup).toContain("C4");
  });

  it("keeps diagnosis details conditional and configuration-owned", () => {
    const diagnosis = SIMULATORS.caixa.sections.find(({ key }) => key === "diagnosis");
    const fields: readonly SimulatorField[] = diagnosis?.fields ?? [];

    expect(fields.find(({ key }) => key === "managed-reason")?.visibleWhen).toEqual({
      fieldKey: "diagnosis-result",
      values: ["Condicionado", "Reprovado"],
    });
    expect(fields.find(({ key }) => key === "document-pending-item")?.visibleWhen).toEqual({
      fieldKey: "diagnosis-result",
      values: ["Documentação pendente"],
    });
    expect(fields.find(({ key }) => key === "action-plan")?.visibleWhen).toEqual({
      fieldKey: "diagnosis-result",
      values: ["Reprovado"],
    });
  });

  it.each(SIMULATOR_LIST)("keeps every field id unique in $code", (definition) => {
    const markup = renderToStaticMarkup(<SimulatorWorkspace definition={definition} />);
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
