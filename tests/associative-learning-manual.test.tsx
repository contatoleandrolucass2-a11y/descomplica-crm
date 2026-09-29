import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestorLearningManual } from "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator";
import {
  ASSOCIATIVE_FIELD_GUIDE,
  ASSOCIATIVE_POLICY_TOPICS,
  ASSOCIATIVE_PROFILE_HELP,
} from "../app/(protected)/app/simulacao/_components/archive-investor/associative-learning-content";

describe("Associative learning manual", () => {
  it("renders accessible tabs with stable anchors and all contents before interaction", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    expect(html).toContain('role="tablist"');
    for (const key of ["policy", "faq"]) {
      expect(html).toContain(`id="investor-associative-learning-${key}"`);
      expect(html).toContain(`aria-controls="investor-associative-learning-${key}"`);
      expect(html).toContain(`aria-labelledby="investor-associative-learning-${key}-tab"`);
    }
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toMatch(
      /id="investor-associative-learning-policy-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/,
    );
    expect(html).toMatch(
      /id="investor-associative-learning-faq-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    );
    expect(html).toMatch(/id="investor-associative-learning-faq"[^>]*hidden=""/);
    expect(html).toContain("Resumo da simulação");
    expect(html).toContain("Checklist antes de apresentar");
    expect(html).toContain("Fontes oficiais");
    expect(html.match(/<details>/g)?.length).toBeGreaterThan(10);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("covers income, modality, first property and every field guide location", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    for (const topic of ASSOCIATIVE_POLICY_TOPICS) expect(html).toContain(topic.title);
    for (const help of Object.values(ASSOCIATIVE_PROFILE_HELP)) {
      expect(html).toContain(help.description);
    }
    expect(ASSOCIATIVE_FIELD_GUIDE).toHaveLength(27);
    expect(new Set(ASSOCIATIVE_FIELD_GUIDE.map(({ label }) => label)).size).toBe(27);
    for (const field of ASSOCIATIVE_FIELD_GUIDE) {
      expect(html).toContain(`<summary>${field.label}</summary>`);
      expect(html).toContain(`Onde se aplica: ${field.location}.`);
      expect(field.detail.length).toBeGreaterThan(80);
    }
    for (const label of [
      "Financiamento",
      "Subsídio",
      "FGTS",
      "Cheque Moradia",
      "Saldo após recursos",
      "Entrada",
      "Saldo parcelado",
      "Qtd. de parcelas",
      "% Pró-Soluto",
      "% Comprometimento da Renda",
      "% Máximo da renda por anual",
      "Resumo das parcelas",
      "Composição da documentação",
    ]) {
      expect(ASSOCIATIVE_FIELD_GUIDE.some((field) => field.label === label)).toBe(true);
    }
  });

  it("distinguishes local estimates, monthly peaks and official approvals", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    expect(html).toContain("R$ 5.000,00");
    expect(html).toContain("15% de comprometimento");
    expect(html).toContain("40%");
    expect(html).toContain("não inclui o valor da anual");
    expect(html).toContain("mesma linha mensal no cronograma");
    expect(html).toContain("não o encargo bancário real");
    expect(html).toContain("Não há isenção nacional automática de ITBI");
    expect(html).toContain("não equivale a receber uma nova aprovação");
    expect(html).not.toContain("entrada, sinais e anuais válidas.");
  });

  it.each([{ directTable: true }, {}])("keeps the other manuals unchanged: %j", (props) => {
    const html = renderToStaticMarkup(<InvestorLearningManual {...props} />);
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("investor-documentation-dialog investor-learning-dialog");
    expect(html).toContain("Fechar manual");
    expect(html).not.toContain("Guia dos ícones de informação");
  });
});
