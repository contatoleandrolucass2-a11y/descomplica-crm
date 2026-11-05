import { describe, expect, it } from "vitest";
import { calculateHousingSimulation, type HousingInput } from "@/lib/crm/simulators/caixa";
import {
  assessCaixaAvailableUnit,
  type CaixaUnit,
} from "@/lib/crm/simulators/caixa-available-units";

const profile: HousingInput = {
  income: 4000,
  propertyValue: 275000,
  birthDate: "1987-01-22",
  state: "SP",
  city: "São Paulo",
  term: 420,
  product: "mcmv",
  system: "price",
  hasFgts36: true,
  previousSubsidy: false,
  singlePersonFamily: false,
  propertyType: "apartment",
  propertyArea: 32,
  officialQuickEstimate: true,
  propertyCondition: "new",
  inConstruction: true,
  asOf: "2026-11-05",
  ownFunds: 0,
};
const unit: CaixaUnit = {
  id: "synthetic-capacity",
  businessUnit: "Incorporadora fictícia",
  project: "Projeto fictício",
  product: "Apartamento fictício",
  status: "Disponível",
  unitType: "Apartamento",
  finalPrice: 253790,
  appraisal: 340000,
  city: "São Paulo",
  state: "SP",
  privateArea: 25.77,
  completionDate: "2029-12-31",
  progress: 0.15,
  constructionStatus: "Em obras",
};
function assess(input = profile, property = unit) {
  const original = calculateHousingSimulation(input);
  if (!original.ok) throw Error(original.errors.join("; "));
  return {
    original,
    assessment: assessCaixaAvailableUnit(property, input, original, "gold", "2026-11-05", true, {
      includeDetails: true,
    }),
  };
}

describe("CAIXA credit and ranking belong to the unit being assessed", () => {
  it.each([275000, 276000, 350000])(
    "does not inherit the initial property %s interest band as a credit ceiling",
    (propertyValue) => {
      const { original, assessment } = assess({ ...profile, propertyValue });
      expect(assessment.status).toBe("approved");
      if (assessment.status !== "approved") return;
      expect(assessment.value.price).toBe(253790);
      expect(assessment.value.financing).toBe(203032);
      expect(assessment.value.subsidy).toBe(3357.01);
      expect(assessment.value.unit.appraisal).toBe(340000);
      expect(assessment.value.details?.purchaseValue).toBe(253790);
      if (propertyValue > 275000)
        expect(assessment.value.financing).toBeGreaterThan(original.maximumFinancingByIncome);
    },
  );

  it("uses all four permitted annuals at the canonical income limit", () => {
    const { assessment } = assess();
    expect(assessment.status).toBe("approved");
    if (assessment.status !== "approved") return;
    expect(assessment.value.annuals).toEqual(
      [2026, 2027, 2028, 2029].map((year) => ({ date: `${year}-12-15`, amount: 2000 })),
    );
    const commitment = assessment.value.details!.approvalRows[1];
    expect(commitment.linear).toBeCloseTo(0.1608, 4);
    expect(commitment.decreasing).toBeCloseTo(0.1983, 4);
    expect(assessment.value.installments).toBe(84);
  });

  it("offers a unit approved in Linear even when Decreasing exceeds the same ranking", () => {
    const { assessment } = assess(profile, { ...unit, finalPrice: 260000 });
    expect(assessment.status).toBe("approved");
    if (assessment.status !== "approved") return;
    expect(assessment.value.financing).toBe(208000);
    const rows = assessment.value.details!.approvalRows;
    expect(rows.every((row) => row.linear <= row.limit)).toBe(true);
    expect(rows[1].decreasing).toBeGreaterThan(rows[1].limit);
  });

  it("still rejects a unit whose two flows exceed the ranking", () => {
    expect(assess(profile, { ...unit, finalPrice: 300000 }).assessment.status).toBe("rejected");
  });

  it("keeps a lower real appraisal as the quota basis", () => {
    const { assessment } = assess(profile, { ...unit, finalPrice: 210000, appraisal: 209000 });
    expect(assessment.status).toBe("approved");
    if (assessment.status !== "approved") return;
    expect(assessment.value.financing).toBe(167200);
    expect(assessment.value.price).toBe(210000);
  });

  it("preserves the client's lower approved payment and rejects an invalid initial capacity", () => {
    expect(assess({ ...profile, approvedPayment: 800 }).assessment.status).toBe("rejected");
    for (const maximumFinancingByIncome of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(
        assessCaixaAvailableUnit(
          unit,
          profile,
          { maximumFinancingByIncome },
          "gold",
          "2026-11-05",
          true,
        ).status,
      ).toBe("unavailable");
  });

  it.each([
    [{ ownFunds: 70000, approvedPayment: 800 }, 137260.59],
    [{ ownFunds: 60000, approvedFinancingQuotaPercent: 60 }, 152274],
  ])("retains individual client limits %j", (limits, financing) => {
    const { assessment } = assess({ ...profile, ...limits });
    expect(assessment.status).toBe("approved");
    if (assessment.status === "approved") expect(assessment.value.financing).toBe(financing);
  });
});
