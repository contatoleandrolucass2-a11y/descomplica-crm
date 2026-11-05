import { describe, expect, it } from "vitest";
import { buildCaixaProposalAnnuals } from "../lib/crm/simulators/caixa-unit-proposal-view";

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
