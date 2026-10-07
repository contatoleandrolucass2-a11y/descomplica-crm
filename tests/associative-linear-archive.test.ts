import { describe, expect, it } from "vitest";

import {
  calculateAssociativeLinearArchive,
  type AssociativeLinearForm,
} from "@/lib/crm/simulators/associative-linear-archive";

// @ts-expect-error -- The canonical archive module has no TypeScript declaration.
import { calculateAssociativeLinear } from "@/lib/archive-investor/associative-linear-calculator-rules.mjs";

const reference: AssociativeLinearForm = {
  development: "Empreendimento sintetico",
  product: "Unidade sintetica",
  stockMatch: true,
  policyConfirmed: true,
  policyLimit: "84",
  installments: "84",
  entryDate: "2026-08-06",
  constructionEnd: "2032-12-31",
  salePrice: "300000",
  bonus: "0",
  discount: "0",
  financing: "200000",
  subsidy: "30000",
  fgts: "10000",
  housingCheck: "0",
  entry: "8000",
  signal1: "1000",
  signal2: "1000",
  signal3: "0",
  annual1: "2350",
  annual2: "2350",
  annual3: "2350",
  annual4: "2350",
  annual5: "2350",
};

function synthetic(overrides: Partial<AssociativeLinearForm> = {}): AssociativeLinearForm {
  return {
    ...reference,
    installments: "12",
    entryDate: "2026-01-10",
    calculationDate: "2026-01-10",
    constructionEnd: "2027-02-01",
    firstInterestDate: "2025-11-30",
    firstInstallmentDate: "2026-02-15",
    signal1: "0",
    signal2: "0",
    annual1: "0",
    annual2: "0",
    annual3: "0",
    annual4: "0",
    annual5: "0",
    ...overrides,
  };
}

// Independent monthly discounting from the 2026-10-07 audit, without PMT or phase weights.
function discountedPayments(pre: number, post: number): number {
  let discount = 1;
  let total = 0;
  for (let month = 1; month <= pre + post; month += 1) {
    discount /= 1 + (month <= pre ? 0.005 : 0.015);
    total += discount;
  }
  return total;
}

describe("simulador associativo do arquivo anexado", () => {
  it("deduz anuais nominais e confere a mensal sintetica por valor presente", () => {
    const result = calculateAssociativeLinearArchive(reference, { today: "2026-08-06" });

    expect(result.ok).toBe(true);
    expect(result.firstInstallmentDate).toBe("2026-11-05");
    expect(result.firstInterestDate).toBe("2026-07-31");
    expect(result.monthlyCorrectionMonths).toBe(3);
    expect(result.graceMonths).toBe(2);
    expect(result.preInstallments).toBe(73);
    expect(result.postInstallments).toBe(11);
    expect(result.annualCorrectedTotal).toBeCloseTo(13627.24708159291, 6);
    expect(result.annualNominalTotal).toBe(11750);
    expect(result.proSoluto).toBe(50000);
    expect(result.installmentBalance).toBe(38250);
    const correctedPrincipal = 38250 * 1.005 ** 3;
    expect(result.correctedInstallmentBalance).toBeCloseTo(correctedPrincipal, 8);
    expect(result.correctedInstallment).toBeCloseTo(
      correctedPrincipal / discountedPayments(73, 11),
      8,
    );
    expect(Math.round(result.correctedInstallment * 100)).toBe(57071);
    expect(result.audit.every((item) => item.ok)).toBe(true);
  });

  it.each([
    { constructionEnd: "2028-02-01", pre: 24, post: 0 },
    { constructionEnd: "2027-02-01", pre: 12, post: 12 },
    { constructionEnd: "2026-03-01", pre: 1, post: 23 },
    { constructionEnd: "2026-02-28", pre: 0, post: 24 },
    { constructionEnd: "2025-12-31", pre: 0, post: 24 },
  ])(
    "fecha VP com $pre pre e $post pos, entrega $constructionEnd",
    ({ constructionEnd, pre, post }) => {
      const result = calculateAssociativeLinearArchive(
        synthetic({ installments: "24", constructionEnd }),
      );
      const correctedPrincipal = 52000 * (pre > 0 ? 1.005 : 1.015) ** 2;

      expect(result.ok).toBe(true);
      expect(result.preInstallments).toBe(pre);
      expect(result.postInstallments).toBe(post);
      expect(result.monthlyCorrectionMonths).toBe(2);
      expect(result.correctedInstallmentBalance).toBeCloseTo(correctedPrincipal, 8);
      expect(result.correctedInstallment * discountedPayments(pre, post)).toBeCloseTo(
        correctedPrincipal,
        7,
      );
      expect(result.prePeriodTotal + result.postPeriodTotal).toBeCloseTo(correctedPrincipal, 8);
      expect(result.prePercentage + result.postPercentage).toBeCloseTo(1, 12);
    },
  );

  it("usa competencias para k, independentemente do dia do primeiro juro", () => {
    for (const firstInterestDate of ["2025-11-01", "2025-11-15", "2025-11-30"]) {
      const result = calculateAssociativeLinearArchive(synthetic({ firstInterestDate }));
      expect(result.ok).toBe(true);
      expect(result.graceMonths).toBe(0);
      expect(result.monthlyCorrectionMonths).toBe(2);
      expect(result.correctedInstallmentBalance).toBeCloseTo(52000 * 1.005 ** 2, 8);
    }
  });

  it("preserva k zero sem acrescentar um periodo inicial", () => {
    const result = calculateAssociativeLinearArchive(
      synthetic({ firstInterestDate: "2026-01-31" }),
    );
    expect(result.ok).toBe(true);
    expect(result.monthlyCorrectionMonths).toBe(0);
    expect(result.correctedInstallmentBalance).toBe(52000);
  });

  it.each([
    ["2026-01-10", "2025-12-31"],
    ["2028-03-01", "2028-02-29"],
    ["2027-03-01", "2027-02-28"],
  ])("deriva o primeiro juro do fim do mes anterior a %s", (calculationDate, firstInterestDate) => {
    const result = calculateAssociativeLinearArchive({
      ...reference,
      entryDate: calculationDate,
      calculationDate,
    });
    expect(result.ok).toBe(true);
    expect(result.calculationDate).toBe(calculationDate);
    expect(result.firstInterestDate).toBe(firstInterestDate);
  });

  it("preserva prioridade de today sobre calculationDate sem mudar as datas explicitas", () => {
    const raw = Object.freeze(synthetic());
    const options = Object.freeze({ today: "2026-01-20" });
    const result = calculateAssociativeLinearArchive(raw, options);
    expect(result.ok).toBe(true);
    expect(result.calculationDate).toBe("2026-01-20");
    expect(result.firstInstallmentDate).toBe("2026-02-15");
    expect(result.firstInterestDate).toBe("2025-11-30");
    expect(result).toEqual(calculateAssociativeLinear(raw, options));
    expect(raw).toEqual(synthetic());
  });

  it("aceita anual nominal menor que o principal mesmo com anual corrigida maior", () => {
    const result = calculateAssociativeLinearArchive(
      synthetic({ annual1: "51000", firstInterestDate: "2026-01-31" }),
    );
    expect(result.ok).toBe(true);
    expect(result.annualCorrectedTotal).toBeGreaterThan(result.proSoluto);
    expect(result.annualNominalTotal).toBe(51000);
    expect(result.installmentBalance).toBe(1000);
    expect(result.correctedInstallmentBalance).toBe(1000);
  });

  it.each(["52000", "52000.01"])(
    "bloqueia anual nominal de %s que esgota as mensais",
    (annual1) => {
      const result = calculateAssociativeLinearArchive(synthetic({ annual1 }));
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        "O total das anuais deve ser menor que o Pró-Soluto para preservar ao menos uma parcela mensal.",
      );
    },
  );

  it.each(["2026-02-30", "2027-02-29", "2026-04-31", "2026-13-15", "2026-2-05", ""])(
    "rejeita data explicita inexistente ou fora de ISO: %s",
    (invalid) => {
      for (const field of [
        "entryDate",
        "constructionEnd",
        "calculationDate",
        "firstInterestDate",
        "firstInstallmentDate",
      ]) {
        const result = calculateAssociativeLinearArchive(synthetic({ [field]: invalid }));
        expect(result.ok, field).toBe(false);
        expect(result.errors.length, field).toBeGreaterThan(0);
      }
      expect(calculateAssociativeLinearArchive(synthetic(), { today: invalid }).ok).toBe(false);
    },
  );

  it.each([
    [{ firstInstallmentDate: "2026-02-16" }, "A primeira mensal deve vencer no dia 5, 10 ou 15."],
    [{ firstInstallmentDate: "2026-01-10" }, "A primeira mensal deve ser posterior à entrada."],
    [{ firstInterestDate: "2026-02-15" }, "O primeiro juro deve ser anterior à primeira mensal."],
    [{ firstInterestDate: "2026-03-01" }, "O primeiro juro deve ser anterior à primeira mensal."],
    [
      { signal1: "1000", firstInstallmentDate: "2026-02-05" },
      "A primeira mensal deve ser posterior ao último sinal.",
    ],
  ] satisfies Array<[Partial<AssociativeLinearForm>, string]>)(
    "rejeita calendario explicito incoerente: %o",
    (overrides, error) => {
      const result = calculateAssociativeLinearArchive(synthetic(overrides));
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(error);
    },
  );

  it("bloqueia parcelas acima da política e sinal fora da sequência", () => {
    const result = calculateAssociativeLinearArchive(
      { ...reference, installments: "85", signal1: "0", signal2: "500" },
      { today: "2026-08-06" },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("limite comercial"),
        expect.stringContaining("Sinal 2 exige"),
      ]),
    );
  });

  it("mantem politica ausente como pendencia de validacao", () => {
    const result = calculateAssociativeLinearArchive(
      synthetic({ policyConfirmed: false, policyLimit: "" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Confirme a consulta à política comercial do empreendimento.",
        "Informe o limite de parcelas aprovado na política comercial.",
      ]),
    );
  });
});
