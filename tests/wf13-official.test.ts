import { describe, expect, it } from "vitest";

import {
  calculateWf13,
  WF13_FORMULA,
  wf13InputSchema,
  type Wf13Input,
} from "@/lib/crm/simulators/official/wf13";
import {
  buildOfficialSimulatorInput,
  officialSimulatorInitialValues,
  officialSimulatorMemoryRows,
  officialSimulatorResultRows,
} from "@/lib/crm/simulators/official/client";

import priorGoldenFixture from "./fixtures/wf13-reference-golden.json";

function validInput(overrides: Partial<Wf13Input> = {}): Wf13Input {
  return {
    development: "Residencial Teste",
    product: "Torre A 101",
    stockMatch: true,
    policyConfirmed: true,
    ranking: "BRONZE",
    policyLimit: "84",
    installments: "84",
    entryDate: "2026-08-17",
    constructionEnd: "2029-02-28",
    monthlyDueDay: "15",
    income: "4000",
    salePrice: "262500",
    bonus: "28500",
    discount: "0",
    cashback: "0",
    cashbackDiscount: "0",
    financing: "210000",
    subsidy: "0",
    fgts: "0",
    housingCheck: "0",
    entry: "1000",
    signal1: "0",
    signal1Date: "",
    signal2: "0",
    signal2Date: "",
    signal3: "0",
    signal3Date: "",
    annuals: ["2000", "2000", "2000"],
    ...overrides,
  };
}

function calculate(input: Wf13Input, today = input.entryDate) {
  return calculateWf13(wf13InputSchema.parse(input), { today });
}

describe("motor oficial WF13", () => {
  it("mantém fontes e versão imutáveis da correção de paridade", () => {
    expect(WF13_FORMULA).toMatchObject({
      workflow: "WF-13",
      version: "wf13-1.2.0",
      sourceSha256: "e9f4d1577cba434582aeb054f0f2a2eb8018a21d66fbf6ec7a72012e35641b71",
      lookerCaptureSha256: "daf02309339c65c6af09cb8fc9183416fa07fca4cd4da8da48a5b57bcd1e44bc",
      referencePdfSha256: "dd54578f8762ea37f0a8eb6496cda945ee555a56d85dcdff317d20ccbbd834dc",
      timeZone: "America/Sao_Paulo",
      paymentDays: [5, 10, 15],
    });
  });

  it("reproduz exatamente o cenário de ouro do PDF 2", () => {
    const result = calculate(validInput());

    expect(result).toMatchObject({
      ok: true,
      errors: [],
      realSaleValue: 234000,
      annualNominalTotal: 6000,
      annualCorrectedTotal: 6506.19,
      deductions: 217000,
      proSoluto: 17000,
      nominalInstallment: 202.38,
      nominalSchedule: {
        installments: 84,
        baseAmount: 202.38,
        baseCount: 76,
        adjustedAmount: 202.39,
        adjustedCount: 8,
        remainder: 0.08,
        total: 17000,
      },
      proSolutoWithInitialCorrection: 17085,
      correctedInstallment: 288.67,
      firstInstallmentDate: "2026-09-15",
      initialToFirstInstallmentDays: 29,
      preInstallments: 29,
      postInstallments: 55,
    });
    expect(result.nominalSchedule.total).toBe(result.proSoluto);
    expect(result.nominalSchedule.baseAmount * 84).not.toBe(result.proSoluto);
  });

  it("separa saldo nominal, correção e memória auditável", () => {
    const result = calculate(validInput());

    expect(result.deductions).toBe(result.realSaleValue - result.proSoluto);
    expect(result.deductions).not.toBe(217506.19);
    expect(result.calculationMemory).toEqual(
      expect.arrayContaining([
        { step: "Anuais nominais", value: 6000, format: "currency" },
        { step: "Anual 1 · vencimento fixo", value: "2026-12-15", format: "date" },
        { step: "Anual 2 · vencimento fixo", value: "2027-12-15", format: "date" },
        { step: "Anual 3 · vencimento fixo", value: "2028-12-15", format: "date" },
        { step: "Saldo nominal do pró-soluto", value: 17000, format: "currency" },
        { step: "Mensal nominal de referência", value: 202.38, format: "currency" },
        { step: "Ajuste total de centavos no cronograma", value: 0.08, format: "currency" },
        { step: "Pró-soluto após correção inicial", value: 17085, format: "currency" },
        { step: "Parcela corrigida", value: 288.67, format: "currency" },
      ]),
    );
    expect(result.audit.every(({ ok }) => ok)).toBe(true);
  });

  it("aprova o limite exato e rejeita 0,01 p.p. acima com precisão integral", () => {
    const exact = calculate(
      validInput({
        salePrice: "100500",
        bonus: "0",
        financing: "84000",
        entry: "1500",
        annuals: [],
        installments: "10",
        income: "200000",
      }),
    );
    const above = calculate(
      validInput({
        salePrice: "100500",
        bonus: "0",
        financing: "83990",
        entry: "1500",
        annuals: [],
        installments: "10",
        income: "200000",
      }),
    );

    expect(exact.approval.proSoluto.value).toBe(0.15);
    expect(exact.approval.status).toBe("APROVADO");
    expect(above.approval.proSoluto.value).toBe(0.1501);
    expect(above.approval.status).toBe("REPROVADO");
    expect(above.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ranking.pro_soluto_exceeded" })]),
    );
  });

  it("rejeita ranking ausente e não elegível no servidor", () => {
    const missing = calculate(validInput({ ranking: "" }));
    const notEligible = calculate(validInput({ ranking: "NÃO ELEGÍVEL" }));

    expect(missing.ok).toBe(false);
    expect(missing.violations[0]?.fieldPaths).toContain("commercialPolicy.ranking");
    expect(notEligible.approval.status).toBe("REPROVADO");
    expect(notEligible.errors).toContain("Cliente classificado como não elegível.");
  });

  it("reprova o status geral quando outra entrada obrigatória falha", () => {
    const result = calculate(validInput({ development: "" }));

    expect(result.approval.proSoluto.approved).toBe(true);
    expect(result.approval.incomeCommitment.approved).toBe(true);
    expect(result.approval.status).toBe("REPROVADO");
    expect(result.approval.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "context.development_required" })]),
    );
  });

  it("aplica 50% da renda por anual e bloqueia quantidade fora das obras", () => {
    const exact = calculate(validInput({ annuals: ["2000", "0", "0"] }));
    const above = calculate(validInput({ annuals: ["2000.01", "0", "0"] }));
    const outside = calculate(validInput({ annuals: ["0", "0", "0", "0"] }));

    expect(exact.annualSchedule[0]).toMatchObject({
      dueDate: "2026-12-15",
      valid: true,
    });
    expect(above.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "annual.1.invalid" })]),
    );
    expect(outside.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "annual.count_exceeded" })]),
    );
  });

  it("aceita entrega na própria data-base quando ambas são 15/12", () => {
    const result = calculate(
      validInput({
        entryDate: "2026-12-15",
        constructionEnd: "2026-12-15",
        annuals: ["2000"],
      }),
    );

    expect(result.violations.map(({ code }) => code)).not.toContain(
      "date.construction_end_before_base",
    );
    expect(result.annualSchedule[0]).toMatchObject({
      dueDate: "2026-12-15",
      valid: true,
    });
  });

  it("mantém Volta ao Caixa neutra e Desconto V.C. no valor final", () => {
    const baseline = calculate(validInput());
    const cashback = calculate(validInput({ cashback: "1000" }));
    const cashbackDiscount = calculate(validInput({ cashbackDiscount: "1000" }));

    expect(cashback.realSaleValue).toBe(baseline.realSaleValue);
    expect(cashback.proSoluto).toBe(baseline.proSoluto);
    expect(cashback.proSolutoOverSale).toBe(baseline.proSolutoOverSale);
    expect(cashbackDiscount.realSaleValue).toBe(baseline.realSaleValue - 1000);
    expect(cashbackDiscount.proSoluto).toBe(baseline.proSoluto - 1000);
  });

  it("rejeita dia de mensal fora de 05, 10 ou 15 no contrato do motor", () => {
    expect(wf13InputSchema.safeParse({ ...validInput(), monthlyDueDay: "20" }).success).toBe(false);
  });

  it("rejeita negativos e falha fechado para renda e valores obrigatórios vazios", () => {
    expect(wf13InputSchema.safeParse({ ...validInput(), salePrice: "-1" }).success).toBe(false);
    const result = calculate(validInput({ income: "", salePrice: "", entry: "" }));

    expect(result.ok).toBe(false);
    expect(result.approval.status).toBe("REPROVADO");
    expect(result.violations.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["income.required", "sale_price.required", "entry.minimum"]),
    );
  });

  const dateCases: Array<{
    name: string;
    input: Partial<Wf13Input>;
    ok: boolean;
    first: string;
    days: number;
    error?: string;
  }> = [
    {
      name: "mês de 31 dias com intervalo exato de 30",
      input: { entryDate: "2026-08-06", monthlyDueDay: "5" },
      ok: true,
      first: "2026-09-05",
      days: 30,
    },
    {
      name: "mês de 31 dias com intervalo de 31 sem sinal",
      input: { entryDate: "2026-08-05", monthlyDueDay: "5" },
      ok: false,
      first: "2026-09-05",
      days: 31,
      error: "excede 30 dias",
    },
    {
      name: "sinal em 10/08 e mensal em 05/09",
      input: {
        entryDate: "2026-08-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2026-08-10",
      },
      ok: true,
      first: "2026-09-05",
      days: 26,
    },
    {
      name: "sinal em 05/08 e mensal em 05/09",
      input: {
        entryDate: "2026-08-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2026-08-05",
      },
      ok: false,
      first: "2026-09-05",
      days: 31,
      error: "limite é 30",
    },
    {
      name: "sem dia futuro permitido no mesmo mês",
      input: { entryDate: "2026-08-15", monthlyDueDay: "15" },
      ok: false,
      first: "2026-09-15",
      days: 31,
      error: "não há dia 05, 10 ou 15 futuro",
    },
    {
      name: "fevereiro de 28 dias",
      input: {
        entryDate: "2027-02-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2027-02-05",
      },
      ok: true,
      first: "2027-03-05",
      days: 28,
    },
    {
      name: "fevereiro bissexto de 29 dias",
      input: {
        entryDate: "2028-02-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2028-02-05",
      },
      ok: true,
      first: "2028-03-05",
      days: 29,
    },
    {
      name: "mês de 30 dias",
      input: {
        entryDate: "2026-04-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2026-04-05",
      },
      ok: true,
      first: "2026-05-05",
      days: 30,
    },
    {
      name: "mês de 31 dias coberto por sinal válido",
      input: {
        entryDate: "2026-07-01",
        monthlyDueDay: "5",
        signal1: "500",
        signal1Date: "2026-07-10",
      },
      ok: true,
      first: "2026-08-05",
      days: 26,
    },
    {
      name: "dia 10 com intervalo exato de 30",
      input: { entryDate: "2026-08-11", monthlyDueDay: "10" },
      ok: true,
      first: "2026-09-10",
      days: 30,
    },
    {
      name: "dia 15 com intervalo exato de 30",
      input: { entryDate: "2026-08-16", monthlyDueDay: "15" },
      ok: true,
      first: "2026-09-15",
      days: 30,
    },
    {
      name: "data de sinal fora de 05, 10 ou 15",
      input: { signal1: "500", signal1Date: "2026-08-12" },
      ok: false,
      first: "2026-09-15",
      days: 29,
      error: "deve ocorrer no dia 05, 10 ou 15",
    },
    {
      name: "sinal com valor sem data",
      input: { signal1: "500", signal1Date: "" },
      ok: false,
      first: "2026-09-15",
      days: 29,
      error: "informe uma data válida",
    },
    {
      name: "sinal com data sem valor",
      input: { signal1: "0", signal1Date: "2026-08-15" },
      ok: false,
      first: "2026-09-15",
      days: 29,
      error: "informe um valor para a data preenchida",
    },
  ];

  it.each(dateCases)("valida $name", ({ input, ok, first, days, error }) => {
    const merged = validInput({
      constructionEnd: "2035-12-31",
      annuals: [],
      ...input,
    });
    const result = calculate(merged, merged.entryDate);

    expect(result.ok).toBe(ok);
    expect(result.firstInstallmentDate).toBe(first);
    expect(result.initialToFirstInstallmentDays).toBe(days);
    if (error) expect(result.errors.join(" ")).toContain(error);
  });

  it("preserva os doze cenários anteriores sob o contrato corrigido", () => {
    const expected = {
      standard: [true, "2026-09-10", 45000, 535.71, 727.66, 39, 45],
      "minimum-entry": [true, "2026-09-10", 59850, 712.5, 967.79, 39, 45],
      "three-signals": [true, "2026-12-10", 42700, 508.33, 710.4, 36, 48],
      "one-annual": [true, "2026-09-10", 42000, 500, 679.15, 39, 45],
      "pre-only": [true, "2026-09-10", 45000, 1875, 2004.4, 24, 0],
      "post-only": [true, "2026-09-10", 45000, 535.71, 959.99, 0, 84],
      "bonus-discount": [true, "2026-09-10", 30000, 357.14, 485.11, 39, 45],
      "invalid-entry": [false, "2026-09-10", 59850.01, 712.5, 967.79, 39, 45],
      "invalid-annual-income": [false, "2026-09-10", 45000, 535.71, 727.66, 39, 45],
      "invalid-policy-limit": [false, "2026-09-10", 45000, 529.41, 722.83, 39, 46],
      "zero-pro-soluto": [true, "2026-09-10", 0, 0, 0, 39, 45],
      "invalid-signal-order": [false, "2026-10-10", 44500, 529.76, 726.35, 38, 46],
    } as const;

    for (const priorCase of priorGoldenFixture) {
      const { annual1, annual2, annual3, annual4, annual5, ...legacyInput } = priorCase.input;
      const annuals = [annual1, annual2, annual3, annual4, annual5];
      while (annuals.at(-1) === "0") annuals.pop();
      const input = {
        ...legacyInput,
        ranking: "DIAMANTE",
        cashback: "0",
        cashbackDiscount: "0",
        annuals,
        monthlyDueDay: "10",
        signal1Date: "",
        signal2Date: "",
        signal3Date: "",
      } as Wf13Input;
      if (priorCase.caseKey === "pre-only") input.income = "1000000";
      if (priorCase.caseKey === "three-signals") {
        Object.assign(input, {
          signal1Date: "2026-09-10",
          signal2Date: "2026-10-10",
          signal3Date: "2026-11-10",
        });
      }
      if (priorCase.caseKey === "invalid-signal-order") {
        Object.assign(input, { signal1Date: "2026-09-10", signal2Date: "2026-10-10" });
      }
      const result = calculate(input, "2026-08-13");
      expect(
        [
          result.ok,
          result.firstInstallmentDate,
          result.proSoluto,
          result.nominalInstallment,
          result.correctedInstallment,
          result.preInstallments,
          result.postInstallments,
        ],
        priorCase.caseKey,
      ).toEqual(expected[priorCase.caseKey as keyof typeof expected]);
    }
  });

  it("rejeita payload monetário ambíguo ou fora do contrato", () => {
    expect(wf13InputSchema.safeParse({ ...validInput(), entry: "1.234,56" }).success).toBe(false);
    expect(wf13InputSchema.safeParse({ ...validInput(), entry: "1.001" }).success).toBe(false);
    expect(wf13InputSchema.safeParse({ ...validInput(), salePrice: "1000000000001" }).success).toBe(
      false,
    );
    expect(wf13InputSchema.safeParse({ ...validInput(), unexpected: "field" }).success).toBe(false);
  });

  it("normaliza a interface e apresenta resultado e memória do PDF 2", () => {
    const values = {
      ...officialSimulatorInitialValues("associativo-fluxo-linear"),
      "simulator-official-context-development": "Residencial Teste",
      "simulator-official-context-product": "Torre A 101",
      "simulator-official-context-official-match": true,
      "simulator-official-context-effective-date": "2026-08-17",
      "simulator-official-context-construction-end": "2029-02-28",
      "simulator-official-context-income": "4.000,00",
      "simulator-pro-soluto-property-value": "262.500,00",
      "simulator-pro-soluto-bonus": "28.500,00",
      "simulator-pro-soluto-financing": "210.000,00",
      "simulator-entry-entry": "1.000,00",
      "simulator-annuals-1-annual-value": "2.000,00",
      "simulator-annuals-2-annual-value": "2.000,00",
      "simulator-annuals-3-annual-value": "2.000,00",
      "simulator-commercial-policy-policy-confirmed": true,
      "simulator-commercial-policy-ranking": "BRONZE",
    };
    const input = buildOfficialSimulatorInput("associativo-fluxo-linear", values);

    expect(input).toMatchObject({
      monthlyDueDay: "15",
      signal1Date: "",
      income: "4000.00",
      salePrice: "262500.00",
      financing: "210000.00",
      entry: "1000.00",
      policyLimit: "84",
      installments: "84",
      ranking: "BRONZE",
      annuals: ["2000.00", "2000.00", "2000.00"],
    });
    const result = calculate(wf13InputSchema.parse(input), "2026-08-17");
    expect(officialSimulatorResultRows("associativo-fluxo-linear", result)).toEqual(
      expect.arrayContaining([
        { label: "Valor real da venda", value: "R$ 234.000,00" },
        { label: "Saldo do pró-soluto", value: "R$ 17.000,00" },
        { label: "Mensal nominal", value: "R$ 202,38" },
        { label: "Mensal corrigida", value: "R$ 288,67" },
        { label: "Início das mensais", value: "15/09/2026" },
      ]),
    );
    expect(officialSimulatorMemoryRows("associativo-fluxo-linear", result)).toEqual(
      expect.arrayContaining([
        { label: "Anuais nominais", value: "R$ 6.000,00" },
        { label: "Total nominal reconciliado", value: "R$ 17.000,00" },
      ]),
    );
    expect(
      officialSimulatorResultRows("associativo-fluxo-linear", { proSoluto: "bad" }),
    ).toBeNull();
  });
});
