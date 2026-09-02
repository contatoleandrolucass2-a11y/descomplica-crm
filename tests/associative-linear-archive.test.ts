import { describe, expect, it } from "vitest";

import {
  calculateAssociativeLinearArchive,
  type AssociativeLinearForm,
} from "@/lib/crm/simulators/associative-linear-archive";

const reference: AssociativeLinearForm = {
  development: "Empreendimento oficial",
  product: "Unidade oficial",
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

describe("simulador associativo do arquivo anexado", () => {
  it("reproduz a referência homologada do WF13 linear", () => {
    const result = calculateAssociativeLinearArchive(reference, { today: "2026-08-06" });

    expect(result.ok).toBe(true);
    expect(result.firstInstallmentDate).toBe("2026-11-05");
    expect(result.graceMonths).toBe(2);
    expect(result.preInstallments).toBe(73);
    expect(result.postInstallments).toBe(11);
    expect(result.annualCorrectedTotal).toBeCloseTo(13627.24708159291, 6);
    expect(result.proSoluto).toBe(50000);
    expect(result.correctedInstallmentBalance).toBeCloseTo(36921.076715246185, 6);
    expect(result.correctedInstallment).toBeCloseTo(542.701304331876, 6);
    expect(result.audit.every((item) => item.ok)).toBe(true);
  });

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
});
