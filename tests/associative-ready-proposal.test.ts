import { describe, expect, it } from "vitest";
// @ts-expect-error — módulo de regras compartilhado com o componente legado em JavaScript.
import * as associativeReadyProposalRules from "@/lib/archive-investor/associative-ready-proposal.mjs";

const { buildAssociativeReadyProposal, buildAssociativeReadyProposalResponseRows } =
  associativeReadyProposalRules;

type ResponseRow = {
  label: string;
  value: number;
  currency: boolean;
};

const workbookBase = {
  grossSaleValue: 340_000,
  originalUnitBonus: 95_000,
  tableSlack: 15_000,
  sourceDiscount: 0,
  netSaleValue: 230_000,
  requestedFinancing: 190_000,
  subsidy: 0,
  fgts: 0,
  housingCheck: 0,
  entry: 1_000,
  signals: [],
  annuals: [],
  installments: 84,
  appraisal: 350_000,
  modality: "MCMV",
};

describe("buildAssociativeReadyProposal", () => {
  it("replica o cenário original MCMV da planilha revisada", () => {
    const result = buildAssociativeReadyProposal(workbookBase);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.quota).toBe(0.8);
    expect(result.proposal).toMatchObject({
      appraisalLimit: 280_000,
      contractMinimum: 237_500,
      contractValue: 237_500,
      financing: 190_000,
      proposalUnitBonus: 7_500,
      proposalDiscount: 102_500,
      balanceAfterResources: 40_000,
      monthlyBalance: 39_000,
      averageInstallment: 464.29,
      creditShortfall: 0,
      reconciliationDifference: 0,
    });
  });

  it("aplica a cota SBPE de 90% sem aumentar o contrato além da venda líquida", () => {
    const result = buildAssociativeReadyProposal({ ...workbookBase, modality: "SBPE" });

    expect(result.quota).toBe(0.9);
    expect(result.proposal).toMatchObject({
      contractMinimum: 211_111.12,
      contractValue: 230_000,
      financing: 190_000,
      proposalUnitBonus: 0,
      proposalDiscount: 110_000,
      monthlyBalance: 39_000,
    });
  });

  it("reproduz os valores do exemplo visual enviado", () => {
    const result = buildAssociativeReadyProposal({
      ...workbookBase,
      netSaleValue: 234_490,
      appraisal: 340_000,
    });

    expect(result.proposal).toMatchObject({
      contractValue: 237_500,
      financing: 190_000,
      proposalUnitBonus: 3_010,
      balanceAfterResources: 44_490,
      monthlyBalance: 43_490,
      averageInstallment: 517.74,
    });
  });

  it("inclui subsídio, sinais e todos os anuais do CRM na conciliação", () => {
    const result = buildAssociativeReadyProposal({
      ...workbookBase,
      subsidy: 2_000,
      fgts: 3_000,
      housingCheck: 4_000,
      signals: [{ label: "Sinal 1", date: "2026-10-05", value: 5_000 }],
      annuals: [
        { label: "Anual 1", date: "2027-09-05", value: 6_000 },
        { label: "Anual 5", date: "2031-09-05", value: 7_000 },
      ],
    });

    expect(result.proposal).toMatchObject({
      resourceTotal: 199_000,
      balanceAfterResources: 31_000,
      signalTotal: 5_000,
      annualTotal: 13_000,
      monthlyBalance: 12_000,
      averageInstallment: 142.86,
      reconciliationDifference: 0,
    });
  });

  it("sinaliza crédito não atendido quando a avaliação limita o financiamento", () => {
    const result = buildAssociativeReadyProposal({ ...workbookBase, appraisal: 210_000 });

    expect(result.status).toBe("review");
    expect(result.proposal).toMatchObject({
      appraisalLimit: 168_000,
      contractValue: 230_000,
      financing: 168_000,
      creditShortfall: 22_000,
      monthlyBalance: 61_000,
    });
    expect(result.warnings).toContain(
      "O financiamento solicitado supera a capacidade desta proposta.",
    );
  });

  it("preserva o centavo quando a avaliação fica abaixo do contrato", () => {
    const result = buildAssociativeReadyProposal({ ...workbookBase, appraisal: 237_499.99 });

    expect(result.proposal).toMatchObject({
      appraisalLimit: 189_999.99,
      financing: 189_999.99,
      creditShortfall: 0.01,
      monthlyBalance: 39_000.01,
      reconciliationDifference: 0,
    });
  });

  it("bloqueia o cálculo sem avaliação bancária", () => {
    const result = buildAssociativeReadyProposal({ ...workbookBase, appraisal: 0 });

    expect(result.ok).toBe(false);
    expect(result.proposal).toBeNull();
    expect(result.errors).toContain("Informe a avaliação bancária para calcular a proposta.");
  });

  it("monta a resposta no padrão fixo da planilha revisada", () => {
    const calculation = buildAssociativeReadyProposal({
      ...workbookBase,
      signals: [{ label: "Sinal 2", value: 2_000 }],
      annuals: [{ label: "Anual 3", value: 3_000 }],
    });
    const rows = buildAssociativeReadyProposalResponseRows(calculation) as ResponseRow[];

    expect(rows.map((row) => row.label)).toEqual([
      "Desconto",
      "Valor de Contrato",
      "B.A. da Unidade",
      "Financiamento",
      "FGTS",
      "Cheque Moradia",
      "Sinal CC",
      "Sinal 1",
      "Sinal 2",
      "Sinal 3",
      "Anual 1",
      "Anual 2",
      "Anual 3",
      "Anual 4",
      "Qtd. de parcelas",
    ]);
    expect(Object.fromEntries(rows.map((row) => [row.label, row.value]))).toMatchObject({
      Desconto: 102_500,
      "Valor de Contrato": 237_500,
      "B.A. da Unidade": 7_500,
      Financiamento: 190_000,
      "Sinal CC": 1_000,
      "Sinal 1": 0,
      "Sinal 2": 2_000,
      "Anual 3": 3_000,
      "Qtd. de parcelas": 84,
    });
  });

  it("não oculta subsídio nem pagamentos além das linhas fixas quando ativos", () => {
    const calculation = buildAssociativeReadyProposal({
      ...workbookBase,
      subsidy: 4_000,
      signals: [{ label: "Sinal 4", value: 5_000 }],
      annuals: [{ label: "Anual 5", value: 6_000 }],
    });
    const rows = buildAssociativeReadyProposalResponseRows(calculation) as ResponseRow[];

    expect(rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(["Subsídio", "Sinal 4", "Anual 5"]),
    );
    expect(rows.at(-1)).toMatchObject({
      label: "Qtd. de parcelas",
      currency: false,
      value: 84,
    });
  });
});
