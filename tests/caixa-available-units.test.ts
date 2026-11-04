import { describe, expect, it } from "vitest";
import { calculateHousingSimulation, type HousingInput } from "@/lib/crm/simulators/caixa";
import {
  assessCaixaAvailableUnit,
  caixaAutomaticAnnuals,
  caixaCommercialPrice,
  caixaUnitEntry,
  type CaixaUnit,
} from "@/lib/crm/simulators/caixa-available-units";

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
  id: "synthetic-caixa-1",
  businessUnit: "Incorporadora fictícia",
  project: "Projeto fictício",
  product: "Apartamento teste",
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
  plant: "2Q",
  parkingSpaces: 1,
};
function capacity(input = profile) {
  const result = calculateHousingSimulation(input);
  if (!result.ok) throw new Error(result.errors.join(";"));
  return result;
}

describe("CAIXA available units: canonical associative rules", () => {
  it.each([
    [0, 150],
    [149.99, 150],
    [150, 150],
    [150.01, 150.01],
    [10000, 10000],
  ])("keeps the fixed entry %s at %s", (value, expected) => {
    expect(caixaUnitEntry(value)).toBe(expected);
  });
  it("matches the commercial price cents and refuses incomplete kit reductions", () => {
    expect(caixaCommercialPrice(unit)).toBe(229000);
    expect(caixaCommercialPrice({ ...unit, tableSlack: null })).toBeNull();
    expect(caixaCommercialPrice({ ...unit, finalWithKit: null, finalPrice: 200000 })).toBe(200000);
  });
  it("automatically includes only legal December annuals and truncates income half", () => {
    expect(caixaAutomaticAnnuals(4000.01, "2026-11-04", "2030-04-30", 50000)).toEqual([
      { date: "2026-12-15", amount: 2000 },
      { date: "2027-12-15", amount: 2000 },
      { date: "2028-12-15", amount: 2000 },
      { date: "2029-12-15", amount: 2000 },
      { date: "2030-12-15", amount: 0 },
    ]);
    expect(
      caixaAutomaticAnnuals(4000, "2026-12-01", "2027-12-14", 50000).every((a) => a.amount === 0),
    ).toBe(true);
    expect(caixaAutomaticAnnuals(4000, "2026-12-01", "2027-12-15", 50000)[1]?.amount).toBe(2000);
  });
  it("caps automatic annual principal below the remaining balance", () => {
    const annuals = caixaAutomaticAnnuals(4000, "2026-11-04", "2030-04-30", 1500);
    expect(annuals.reduce((sum, a) => sum + a.amount, 0)).toBeLessThan(1500);
    expect(annuals[0]?.amount).toBe(374.99);
  });
  it("uses both canonical flows, 84 monthly installments and only one own-funds entry", () => {
    const result = assessCaixaAvailableUnit(
      unit,
      profile,
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    expect(result.status).toBe("approved");
    if (result.status !== "approved") return;
    expect(result.value.installments).toBe(84);
    expect(result.value.entry).toBe(150);
    expect(result.value.financing).toBeLessThanOrEqual(capacity().maximumFinancingByIncome);
    expect(result.value.linearPayment).toBeGreaterThan(0);
    expect(result.value.decreasingPayment).toBeGreaterThan(0);
    const funded = assessCaixaAvailableUnit(
      unit,
      { ...profile, ownFunds: 5000 },
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    expect(funded.status).toBe("approved");
    if (funded.status === "approved") {
      expect(funded.value.entry).toBe(5000);
      expect(funded.value.fgts).toBe(0);
      expect(funded.value.proSoluto).toBeLessThan(result.value.proSoluto);
    }
  });
  it("never treats an ineligible or unknown tier as approved", () => {
    for (const tier of ["not-eligible", "invented"])
      expect(
        assessCaixaAvailableUnit(unit, profile, capacity(), tier, "2026-11-04", true).status,
      ).toBe("rejected");
  });
  it("never offers sold, blocked, reserved or unknown availability", () => {
    for (const status of [
      "Vendido",
      "Bloqueado",
      "Mirror - Reservada",
      "Disponível,Mirror - Reservada",
      null,
    ] as const)
      expect(
        assessCaixaAvailableUnit(
          { ...unit, status },
          profile,
          capacity(),
          "diamond",
          "2026-11-04",
          true,
        ).status,
      ).toBe("unavailable");
  });
  it("excludes units missing authoritative facts rather than filling them from the simulated property", () => {
    for (const change of [
      { appraisal: null },
      { privateArea: null },
      { city: null },
      { completionDate: null },
      { progress: null },
      { unitType: "Loja", product: "Loja teste" },
    ]) {
      expect(
        assessCaixaAvailableUnit(
          { ...unit, ...change },
          profile,
          capacity(),
          "diamond",
          "2026-11-04",
          true,
        ).status,
      ).toBe("unavailable");
    }
    expect(
      assessCaixaAvailableUnit(
        { ...unit, unitType: "Vaga de Garagem" },
        profile,
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("rejected");
  });
  it("refuses unconfirmed condition on delivered units and MCMV ownership without confirmation", () => {
    expect(
      assessCaixaAvailableUnit(
        { ...unit, constructionStatus: "Usado" },
        profile,
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("unavailable");
    expect(
      assessCaixaAvailableUnit(
        { ...unit, completionDate: "2026-01-01", constructionStatus: "Pronto" },
        profile,
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("unavailable");
    expect(
      assessCaixaAvailableUnit(
        unit,
        { ...profile, product: "mcmv" },
        capacity(),
        "diamond",
        "2026-11-04",
        false,
      ).status,
    ).toBe("rejected");
  });
  it("does not carry the original property's confirmed subsidy into another unit", () => {
    const adjusted = assessCaixaAvailableUnit(
      unit,
      { ...profile, confirmedSubsidy: 50000 },
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    expect(adjusted.status).toBe("approved");
    if (adjusted.status === "approved") expect(adjusted.value.subsidy).toBe(0);
  });
  it("normalizes municipality case and accents without inventing an unknown place", () => {
    expect(
      assessCaixaAvailableUnit(
        { ...unit, city: "SAO PAULO", state: "sp" },
        profile,
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("approved");
    expect(
      assessCaixaAvailableUnit(
        { ...unit, city: "Cidade inventada" },
        profile,
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("unavailable");
  });
  it("requires real calendar dates and specific insurance when quick estimates are disabled", () => {
    for (const [date, completion] of [
      ["2026-02-31", "2030-04-30"],
      ["2026-11-04", "2030-02-31"],
    ] as const)
      expect(
        assessCaixaAvailableUnit(
          { ...unit, completionDate: completion },
          profile,
          capacity(),
          "diamond",
          date,
          true,
        ).status,
      ).toBe("unavailable");
    expect(
      assessCaixaAvailableUnit(
        unit,
        { ...profile, officialQuickEstimate: false, mipMonthly: 0, dfiMonthly: 0 },
        capacity(),
        "diamond",
        "2026-11-04",
        true,
      ).status,
    ).toBe("unavailable");
  });
  it("does not carry a public contribution confirmed for the original property", () => {
    const assessed = assessCaixaAvailableUnit(
      unit,
      { ...profile, confirmedPublicContribution: 10000 },
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    expect(assessed.status).toBe("approved");
    if (assessed.status === "approved") expect(assessed.value.publicContribution).toBe(0);
  });
  it("includes the construction phase in the oldest applicant's permitted term", () => {
    const older = { ...profile, birthDate: "1948-05-01" };
    expect(
      assessCaixaAvailableUnit(unit, older, capacity(), "diamond", "2026-11-04", true).status,
    ).toBe("unavailable");
  });
  it("lets the canonical 84-month flow decide a fully covered unit", () => {
    const funded = assessCaixaAvailableUnit(
      unit,
      { ...profile, ownFunds: 229000 },
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    // A zero balance is not falsely labelled approved if the canonical flow requires a positive principal.
    expect(funded.status).toBe("unavailable");
  });
  it("only builds the full canonical schedule for a selected unit", () => {
    const compact = assessCaixaAvailableUnit(
      unit,
      profile,
      capacity(),
      "diamond",
      "2026-11-04",
      true,
    );
    expect(compact.status).toBe("approved");
    if (compact.status === "approved") expect(compact.value.details).toBeUndefined();
    const selected = assessCaixaAvailableUnit(
      unit,
      profile,
      capacity(),
      "diamond",
      "2026-11-04",
      true,
      { includeDetails: true },
    );
    expect(selected.status).toBe("approved");
    if (selected.status !== "approved") return;
    expect(selected.value.details?.approvalRows).toHaveLength(3);
    expect(
      selected.value.details?.approvalRows.every(
        (row) => row.linear <= row.limit && row.decreasing <= row.limit,
      ),
    ).toBe(true);
    const monthly = selected.value.details?.schedule.filter((row) => row.kind === "monthly") ?? [];
    expect(monthly).toHaveLength(84);
    expect(monthly[0]?.paymentDate).toBe("2026-11-15");
    expect(monthly.at(-1)?.paymentDate).toBe("2033-10-15");
    expect(selected.value.details?.schedule.filter((row) => row.annualPayment > 0)).toHaveLength(4);
  });
});
