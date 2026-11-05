import { describe, expect, it } from "vitest";
import {
  buildCaixaProposalAnnuals,
  reassessCaixaProposalDiscount,
} from "../lib/crm/simulators/caixa-unit-proposal-view";
import { calculateHousingSimulation, type HousingInput } from "../lib/crm/simulators/caixa";
import {
  assessCaixaAvailableUnit,
  type CaixaUnit,
} from "../lib/crm/simulators/caixa-available-units";

const base = {
  income: 6000,
  baseDate: "2026-12-04",
  completionDate: "2030-04-30",
  balanceAfterResources: 50000,
  entry: 150,
  signals: [],
};
describe("CAIXA inline proposal annual calendar", () => {
  it("preserves December's zero slot and applies values by date rather than compacted index", () => {
    const annuals = buildCaixaProposalAnnuals(base);
    expect(annuals).toHaveLength(5);
    expect(annuals.map((annual) => annual.amount)).toEqual([0, 3000, 3000, 3000, 0]);
    expect(annuals[0]?.date).toBe("2026-12-15");
    expect(annuals[1]?.date).toBe("2027-12-15");
    const edited = buildCaixaProposalAnnuals({
      ...base,
      overrides: { "2027-12-15": 2500, "2026-12-15": 1000 },
    });
    expect(edited.map((annual) => annual.amount)).toEqual([0, 2500, 3000, 3000, 0]);
  });
  it("a valid signal updates eligibility without shifting later annual values", () => {
    const scenario = {
      ...base,
      baseDate: "2026-11-04",
      signals: [{ date: "2026-12-15", value: 150, approved: true }],
    };
    const annuals = buildCaixaProposalAnnuals({ ...scenario, overrides: { "2027-12-15": 2200 } });
    expect(annuals[0]?.amount).toBe(0);
    expect(annuals[1]?.date).toBe("2027-12-15");
    expect(annuals[1]?.amount).toBe(2200);
    expect(annuals[2]?.amount).toBe(3000);
  });
  it("subtracts valid signals before auto-filling annual principal and preserves monthly cents", () => {
    const scenario = {
      ...base,
      balanceAfterResources: 5000,
      signals: [
        { date: "2027-01-15", value: 1000, approved: true },
        { date: "2027-02-15", value: 500, approved: false },
      ],
    };
    const annuals = buildCaixaProposalAnnuals(scenario);
    const total = annuals.reduce((sum, annual) => sum + annual.amount, 0);
    expect(total).toBeCloseTo(3849.99, 2);
    expect(total + 1000 + scenario.entry).toBeLessThan(scenario.balanceAfterResources);
  });
});

const profile: HousingInput = {
  income: 6000,
  propertyValue: 300000,
  birthDate: "1991-03-15",
  state: "SP",
  city: "São Paulo",
  term: 420,
  product: "sbpe",
  system: "price",
  nominalRate: 5,
  officialQuickEstimate: true,
  propertyCondition: "new",
  inConstruction: true,
  asOf: "2026-11-04",
  ownFunds: 0,
};
const unit: CaixaUnit = {
  id: "synthetic-discount",
  businessUnit: "Riva",
  project: "Projeto fictício",
  product: "Apartamento fictício",
  status: "Disponível",
  unitType: "Apartamento",
  finalWithKit: 240000,
  unitBonus: 10000,
  tableSlack: 1000,
  finalPrice: 229000,
  appraisal: 240000,
  city: "São Paulo",
  state: "SP",
  privateArea: 60,
  completionDate: "2030-04-30",
  progress: 0.2,
  constructionStatus: "Em obras",
};
function scenario(input: HousingInput = profile, property: CaixaUnit = unit) {
  const capacity = calculateHousingSimulation(input);
  if (!capacity.ok) throw Error(capacity.errors.join("; "));
  const original = assessCaixaAvailableUnit(
    property,
    input,
    capacity,
    "diamond",
    "2026-11-04",
    true,
  );
  if (original.status !== "approved") throw Error(original.reason);
  return {
    selected: original.value,
    input,
    capacity: capacity.maximumFinancingByIncome,
    ranking: "diamond",
    baseDate: "2026-11-04",
    firstProperty: true,
  };
}
describe("CAIXA commercial discount must recalculate the bank purchase basis", () => {
  it("does not deduct kit reductions again when the report only provides the final commercial price", () => {
    const fallback = { ...unit };
    delete fallback.finalWithKit;
    const initial = scenario(profile, fallback);
    expect(initial.selected.price).toBe(229000);
    expect(initial.selected.financing).toBe(183200);
    const result = reassessCaixaProposalDiscount({ ...initial, discount: 10000, authorized: true });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.value.price).toBe(219000);
    expect(result.value.financing).toBe(175200);
    expect(result.value.financing).toBeLessThanOrEqual(result.value.price * 0.8);
  });
  it.each([
    ["price", 175200],
    ["sac", 197100],
  ] as const)(
    "recalculates %s quota on219000 without applying discount twice",
    (system, financing) => {
      const initial = scenario({ ...profile, system });
      const result = reassessCaixaProposalDiscount({
        ...initial,
        discount: 10000,
        authorized: true,
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.value.price).toBe(219000);
      expect(result.value.financing).toBe(financing);
      expect(result.value.financing).toBeLessThanOrEqual(initial.capacity);
      expect(result.value.unit.finalWithKit).toBeUndefined();
      expect(initial.selected.unit.finalWithKit).toBe(240000);
    },
  );
  it("preserves identical bank funding without discount and blocks missing authorization", () => {
    const initial = scenario();
    const unchanged = reassessCaixaProposalDiscount({ ...initial, discount: 0, authorized: false });
    expect(unchanged.status).toBe("ready");
    if (unchanged.status === "ready") expect(unchanged.value).toBe(initial.selected);
    expect(
      reassessCaixaProposalDiscount({ ...initial, discount: 10000, authorized: false }),
    ).toMatchObject({ status: "blocked" });
    expect(
      reassessCaixaProposalDiscount({ ...initial, discount: 229000, authorized: true }),
    ).toMatchObject({ status: "blocked" });
    expect(
      reassessCaixaProposalDiscount({
        ...initial,
        discount: 10000,
        authorized: true,
        input: { ...profile, officialQuickEstimate: false },
      }),
    ).toMatchObject({ status: "blocked" });
  });
  it("reassesses MCMV municipal rate crossing and MFOM subsidy instead of transplanting original property values", () => {
    const { nominalRate: discarded, ...mcmvProfile } = profile;
    void discarded;
    const input: HousingInput = {
      ...mcmvProfile,
      product: "mcmv",
      income: 4000,
      propertyValue: 300000,
      ownFunds: 55000,
      hasFgts36: true,
      singlePersonFamily: false,
      propertyType: "apartment",
      propertyArea: 60,
    };
    const property: CaixaUnit = {
      ...unit,
      finalWithKit: 276000,
      unitBonus: 0,
      tableSlack: 0,
      finalPrice: 276000,
      appraisal: 300000,
    };
    const initial = scenario(input, property);
    const discounted = reassessCaixaProposalDiscount({
      ...initial,
      selected: { ...initial.selected, subsidy: 99999 },
      discount: 2000,
      authorized: true,
    });
    const oldBank = calculateHousingSimulation({
      ...input,
      propertyValue: 276000,
      appraisalValue: 300000,
    });
    const newBank = calculateHousingSimulation({
      ...input,
      propertyValue: 274000,
      appraisalValue: 300000,
    });
    expect(oldBank.ok && newBank.ok).toBe(true);
    expect(discounted.status).toBe("ready");
    if (discounted.status !== "ready" || !oldBank.ok || !newBank.ok) return;
    expect(oldBank.rate).toBe(7.66);
    expect(newBank.rate).toBe(5.5);
    expect(discounted.value.price).toBe(274000);
    expect(discounted.value.financing).toBeCloseTo(newBank.financing, 2);
    expect(discounted.value.subsidy).toBe(newBank.subsidy);
    expect(discounted.value.subsidy).toBeGreaterThan(0);
  });
});
