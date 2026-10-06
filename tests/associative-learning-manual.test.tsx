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
    for (const topic of ASSOCIATIVE_POLICY_TOPICS) {
      expect(html).toContain(topic.title);
      for (const item of topic.items) expect(html).toContain(item);
    }
    for (const help of Object.values(ASSOCIATIVE_PROFILE_HELP)) {
      expect(html).toContain(help.description);
    }
    expect(ASSOCIATIVE_FIELD_GUIDE).toHaveLength(27);
    expect(new Set(ASSOCIATIVE_FIELD_GUIDE.map(({ label }) => label)).size).toBe(27);
    for (const field of ASSOCIATIVE_FIELD_GUIDE) {
      expect(html).toContain(`<summary>${field.label}</summary>`);
      expect(html).toContain(`Onde se aplica: ${field.location}.`);
      expect(html).toContain(field.detail);
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
      "% Máximo da renda mensal",
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

  it.each([
    ...Object.values(ASSOCIATIVE_PROFILE_HELP).map(({ title, description }) => ({
      label: title,
      text: description,
    })),
    ...ASSOCIATIVE_FIELD_GUIDE.map(({ label, detail }) => ({ label, text: detail })),
  ])("uses short sentences and everyday explanations in $label", ({ text }) => {
    const sentences = new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(text);
    for (const { segment } of sentences) {
      expect(segment.trim().split(/\s+/).length, segment).toBeLessThanOrEqual(30);
    }
    expect(text).not.toMatch(
      /triagem|enquadramento|numerador|denominador|nominal|parametrizado|máxima carga|concilia|deduz|deduç/iu,
    );
  });

  it("explains the profile without promising credit or first-property benefits", () => {
    expect(ASSOCIATIVE_PROFILE_HELP.income.description).toContain(
      "Some quanto ganham por mês todas as pessoas que participarão da compra.",
    );
    expect(ASSOCIATIVE_PROFILE_HELP.income.description).toContain(
      "comprovantes aceitos pelo banco",
    );
    expect(ASSOCIATIVE_PROFILE_HELP.income.description).toContain("análise oficial");
    const modality = ASSOCIATIVE_PROFILE_HELP.modality.description;
    expect(modality).toContain("MCMV (Minha Casa, Minha Vida)");
    expect(modality).toContain("SBPE (Sistema Brasileiro de Poupança e Empréstimo)");
    expect(modality).toContain("Se não atender, usa SBPE");
    expect(modality).toContain(
      "não aprova crédito nem muda sozinha o valor que você informou em Financiamento",
    );
    const firstProperty = ASSOCIATIVE_PROFILE_HELP.firstProperty.description;
    expect(firstProperty).toContain(
      "não tem outro imóvel residencial e não tem financiamento de moradia em andamento",
    );
    expect(firstProperty).toContain("Se tiver qualquer um deles, marque Não");
    expect(firstProperty).toContain("ITBI (imposto sobre a compra)");
    expect(firstProperty).toContain("não prova, sozinha, que esta é a primeira compra");
    expect(firstProperty).toContain("não garante dispensa de pagamento ou desconto");
    expect(firstProperty).toContain("Banco, prefeitura e cartório precisam conferir");
  });

  it("separates the displayed balance from the adjusted annual base used for monthly payments", () => {
    const guide = new Map(ASSOCIATIVE_FIELD_GUIDE.map(({ label, detail }) => [label, detail]));
    const balance = guide.get("Saldo parcelado");
    expect(balance).toContain(
      "Saldo após recursos − Entrada − Sinais válidos = Pró-Soluto, antes da correção",
    );
    expect(balance).toContain(
      "Pró-Soluto − soma dos valores digitados nas anuais válidas = Saldo parcelado",
    );
    expect(balance).toContain("sem reajustes");
    expect(balance).toContain(
      "Para calcular as mensais, o simulador faz uma conta separada: Pró-Soluto − total das anuais reajustadas",
    );
    expect(balance).toContain("Depois, aplica a regra de reajuste das mensais");
    expect(balance).toContain(
      "dividir o Saldo parcelado pela quantidade de parcelas não mostra, sozinho, quanto será pago por mês",
    );
    expect(balance).toContain("Não desconte as anuais de novo do Saldo parcelado");
    expect(balance).toContain("O Pró-Soluto continua incluindo as anuais");
    const annuals = guide.get("Anual 1 a Anual 5");
    expect(annuals).toContain(
      "O Saldo parcelado desconta as anuais válidas pelos valores digitados, sem reajustes",
    );
    expect(annuals).toContain(
      "o cálculo das mensais usa as anuais reajustadas para definir sua base",
    );
    expect(annuals).toContain("As anuais continuam dentro do Pró-Soluto");
    const summary = guide.get("Resumo das parcelas");
    expect(summary).toContain(
      "O Saldo parcelado usa as anuais válidas pelos valores digitados, sem reajustes",
    );
    expect(summary).toContain(
      "O cálculo das mensais usa outra base: Pró-Soluto − total das anuais reajustadas",
    );
    expect(summary).toContain("A regra de reajuste das mensais é aplicada separadamente");
    for (const text of [balance, annuals, summary]) {
      expect(text).not.toContain("não o Pró-Soluto nem o Saldo parcelado");
      expect(text).not.toContain("o saldo parcelado não diminui");
      expect(text).not.toContain(
        "Pró-Soluto − total corrigido das anuais válidas = Saldo parcelado",
      );
    }
  });

  it("keeps annuals in the pro-soluto percentage and preserves payment limits and adjustment rules", () => {
    const guide = new Map(ASSOCIATIVE_FIELD_GUIDE.map(({ label, detail }) => [label, detail]));
    const proSoluto = guide.get("% Pró-Soluto");
    expect(proSoluto).toContain("Pró-Soluto ÷ valor real do imóvel após desconto × 100");
    expect(proSoluto).toContain(
      "Saldo após recursos menos Entrada e Sinais válidos, antes da correção",
    );
    expect(proSoluto).toContain("Ele inclui as anuais, por isso elas não reduzem esse percentual");
    expect(proSoluto).toContain("Não use o Saldo parcelado nesta conta");
    expect(proSoluto).toContain("igual no Linear e no Decrescente");
    expect(proSoluto).toContain("limite do Ranking");
    expect(proSoluto).not.toContain("Saldo parcelado ÷");
    expect(guide.get("Entrada")).toContain("pelo menos R$ 150,00 na data mostrada");
    const signals = guide.get("Sinal 1, Sinal 2 e Sinal 3");
    expect(signals).toContain("até três pagamentos");
    expect(signals).toContain("Cada um deve ter pelo menos R$ 150,00");
    expect(signals).toContain("Sinal 2 não pode superar o Sinal 1");
    expect(signals).toContain("Sinal 3 não pode superar o Sinal 2");
    expect(signals).toContain("os seguintes também podem ser zerados");
    const annuals = guide.get("Anual 1 a Anual 5");
    expect(annuals).toContain("15/12 até a entrega");
    expect(annuals).toContain("Cada anual, antes da correção, pode ser de até 50% da renda mensal");
    expect(annuals).toContain("valor × 1,005 × 1,005 elevado aos meses do cronograma");
    expect(annuals).toContain("Ao ocultar uma anual, seu valor é zerado");
    expect(guide.get("Qtd. de parcelas")).toContain("até 84 parcelas");
    expect(guide.get("Qtd. de parcelas")).toContain("40%, 30%, 20% e 10%");
    expect(guide.get("Resumo das parcelas")).toContain(
      "0,5% ao mês antes do mês de entrega e 1,5% a partir do mês de entrega",
    );
    expect(guide.get("Resumo das parcelas")).toContain(
      "não são as taxas do financiamento bancário",
    );
  });

  it("preserves official policy caveats and the separate documentation calculation", () => {
    const policy = ASSOCIATIVE_POLICY_TOPICS.flatMap(({ items }) => items).join(" ");
    for (const rule of [
      "maior parcela mensal corrigida do cronograma ÷ renda familiar × 100",
      "Não soma Evolução de Obra",
      "O indicador exclui a anual",
      "renda × 30% × andamento",
      "não é o cálculo do encargo bancário real",
      "selecionar MCMV não garante benefício",
      "Não é uma faixa do MCMV nem um programa de subsídio habitacional",
      "HIS-1, HIS-2 e HMP são classificações municipais distintas",
      "Não há isenção nacional automática de ITBI",
      "Não possuir imóvel hoje não comprova que nunca houve aquisição anterior",
      "em SBPE essa condição de isenção não é aplicada",
      "ITBI + Registro total + Despachante + Seguro Caixa",
      "o menor valor entre venda e avaliação × cota",
      "80% para MCMV e 90% para SBPE",
      "não são uma promessa de financiamento",
      "Exibir parcelas em Resumo financeiro mostra somente a documentação",
    ]) {
      expect(policy).toContain(rule);
    }
  });

  it.each([{ directTable: true }, {}])("keeps the other manuals unchanged: %j", (props) => {
    const html = renderToStaticMarkup(<InvestorLearningManual {...props} />);
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("investor-documentation-dialog investor-learning-dialog");
    expect(html).toContain("Fechar manual");
    expect(html).not.toContain("Guia dos ícones de informação");
  });
});
