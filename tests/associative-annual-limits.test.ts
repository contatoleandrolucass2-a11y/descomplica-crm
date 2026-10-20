import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  floorMoney,
  getAssociativeAnnualEligibility,
  getAssociativeAnnualLimit,
} from "@/lib/archive-investor/associative-annual-rules.mjs";
import { eligibleIntermediaryIndexes } from "@/lib/archive-investor/intermediary-fields";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateAssociativeLinear } from "@/lib/archive-investor/associative-linear-calculator-rules.mjs";

const calendar = {
  baseDate: "2026-10-20",
  entryDate: "2026-10-20",
  completionDate: "2029-12-31",
};
const flowInput = {
  ...calendar,
  selectedUnitId: "synthetic-annual-limits",
  annualMode: true,
  salePrice: 300000,
  financing: 240000,
  income: 5000.01,
  entryValue: 10000,
  signals: [0, 0, 0],
  intermediaries: [1000, 1234.56, 0, 0, 0],
  installments: 84,
  approvalTierId: "bronze",
};
const linearInput = {
  development: "Synthetic annual limits",
  product: "SYN-ANNUAL",
  stockMatch: true,
  policyConfirmed: true,
  policyLimit: 84,
  installments: 84,
  calculationDate: calendar.baseDate,
  entryDate: calendar.entryDate,
  constructionEnd: calendar.completionDate,
  salePrice: 300000,
  financing: 240000,
  entry: 10000,
  signal1: 0,
  signal2: 0,
  signal3: 0,
  annual1: 1000,
};
type Annual = { value: number; date: string; approved: boolean; eligible: boolean };
type Scenario = {
  signalLimit: number;
  linear: { annualSchedule: { amount: number; dueDate: string; valid: boolean }[] };
};

describe("Associative annual decimal limits", () => {
  it.each([
    [0.58, 0.58],
    [1.01, 1.01],
    [1.019, 1.01],
    ["1.009999999999999999999", 1],
    [5000.019999999999, 5000.01],
    ["1.01e2", 101],
    [1e-7, 0],
    ["1e-99999999", 0],
    ["0e99999999", 0],
  ])("floors money %s in decimal to %s", (value, expected) => {
    expect(floorMoney(value)).toBe(expected);
  });

  it.each([
    [5000, 2500],
    [5000.01, 2500],
    [5000.02, 2500.01],
    [4999.999999999999, 2499.99],
    ["5000.019999999999999999999", 2500],
    [1.16, 0.58],
    [0.01, 0],
    [0.02, 0.01],
    [5e-7, 0],
    ["1e-99999999", 0],
    ["0e99999999", 0],
  ])("floors half of income %s to %s without tolerance", (income, expected) => {
    expect(getAssociativeAnnualLimit(income)).toBe(expected);
  });

  it.each([undefined, null, "", "invalid", -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not create capacity from invalid income %s",
    (income) => {
      expect(getAssociativeAnnualLimit(income)).toBe(0);
    },
  );

  it.each([
    [2500, true],
    [2500.0000000001, false],
    [2500.01, false],
  ])("enforces an annual of %s against income 5000.01 in both engines", (annual, valid) => {
    const result = calculateInvestorFlow({ ...flowInput, intermediaries: [annual, 0, 0, 0, 0] });
    expect(result.custom.intermediaries[0].approved).toBe(valid);
    expect(result.custom.linear.annualSchedule[0].valid).toBe(valid);
    expect(result.custom.annualNominalTotal).toBe(valid ? annual : 0);
    expect(result.custom.linear.annualNominalTotal).toBe(valid ? annual : 0);
    expect(result.custom.installmentNominalBalance).toBe(50000 - (valid ? annual : 0));
  });

  it("keeps the legacy no-income contract and enforces explicitly supplied zero income", () => {
    const legacy = calculateAssociativeLinear(linearInput, { today: calendar.baseDate });
    expect(legacy.ok).toBe(true);
    expect(legacy.annualSchedule[0].valid).toBe(true);
    const explicit = calculateAssociativeLinear(
      { ...linearInput, income: 0 },
      { today: calendar.baseDate },
    );
    expect(explicit.ok).toBe(false);
    expect(explicit.annualSchedule[0].valid).toBe(false);
    const noIncome = calculateInvestorFlow({ ...flowInput, income: undefined });
    expect(noIncome.custom.linear.annualSchedule[0].valid).toBe(true);
    expect(noIncome.custom.intermediaries[0].approved).toBe(true);
  });
});

describe("Associative annual calendar eligibility", () => {
  it.each(["2026-12-01", "2026-12-05", "2026-12-15", "2026-12-31"])(
    "blocks the entire entry month for entry %s",
    (entryDate) => {
      const result = getAssociativeAnnualEligibility({ ...calendar, entryDate });
      expect(result[0]).toMatchObject({ index: 1, date: "2026-12-15", eligible: false });
      expect(result[1]).toMatchObject({ index: 2, date: "2027-12-15", eligible: true });
    },
  );

  it.each(["2026-12-05", "2026-12-10", "2026-12-15", "2026-12-31"])(
    "blocks the entire signal month for signal %s",
    (signalDate) => {
      expect(
        getAssociativeAnnualEligibility({ ...calendar, signalDates: [signalDate] })[0]?.eligible,
      ).toBe(false);
    },
  );

  it("does not interleave an annual in a gap before the last signal", () => {
    const result = getAssociativeAnnualEligibility({
      ...calendar,
      signalDates: ["2026-11-15", "2027-01-15"],
    });
    expect(result[0]?.eligible).toBe(false);
    expect(result[1]?.eligible).toBe(true);
  });

  it.each([
    [0, true],
    [1, true],
    [2, false],
    [3, false],
  ])("recomputes availability for %s active candidate signals", (signalCount, eligible) => {
    const result = calculateInvestorFlow({
      ...flowInput,
      signals: [1000, 1000, 1000].map((value, index) => (index < signalCount ? value : 0)),
    });
    expect(result.custom.intermediaries[0].eligible).toBe(eligible);
    expect(result.custom.intermediaries[0].approved).toBe(eligible);
    expect(result.custom.linear.annualSchedule[0].valid).toBe(eligible);
    expect(result.context.intermediaryInputLimit).toBe(eligible ? 4 : 3);
  });

  it("retains existing values in their December slots when a signal blocks an annual", () => {
    const result = calculateInvestorFlow({ ...flowInput, signals: [1000, 1000, 1000] });
    const payments: Annual[] = result.custom.intermediaries;
    expect(payments[0]).toMatchObject({
      value: 1000,
      date: "2026-12-15",
      eligible: false,
      approved: false,
    });
    expect(payments[1]).toMatchObject({
      value: 1234.56,
      date: "2027-12-15",
      eligible: true,
      approved: true,
    });
    expect(result.custom.annualNominalTotal).toBe(1234.56);
    expect(result.custom.linear.annualNominalTotal).toBe(1234.56);
    expect(
      eligibleIntermediaryIndexes({
        annualMode: true,
        payments,
        baseDate: calendar.baseDate,
        completionDate: calendar.completionDate,
        inputLimit: result.context.intermediaryInputLimit,
      }),
    ).toEqual([1, 2, 3]);
  });

  it("filters legacy payment rows when the caller supplies the initial calendar", () => {
    expect(
      eligibleIntermediaryIndexes({
        ...calendar,
        annualMode: true,
        payments: [2026, 2027, 2028, 2029, 2030].map((year) => ({ date: `${year}-12-15` })),
        signalDates: ["2026-11-15", "2026-12-15", "2027-01-15"],
        inputLimit: 3,
      }),
    ).toEqual([1, 2, 3]);
  });

  it("keeps exact construction boundaries and expired December indexes", () => {
    const eligibleDates = (baseDate: string, completionDate: string) =>
      getAssociativeAnnualEligibility({ ...calendar, baseDate, completionDate })
        .filter((annual) => annual.eligible)
        .map((annual) => annual.date);
    expect(eligibleDates("2026-12-16", "2027-12-14")).toEqual([]);
    expect(eligibleDates("2026-12-16", "2027-12-15")).toEqual(["2027-12-15"]);
    expect(eligibleDates("2026-12-15", "2027-12-15")).toEqual(["2026-12-15", "2027-12-15"]);
  });

  it.each([
    { baseDate: "" },
    { baseDate: "2026-02-30" },
    { entryDate: "" },
    { entryDate: "2026-02-30" },
    { completionDate: "2026-02-30" },
    { signalDates: ["2026-02-30"] },
  ])("does not offer dates with invalid calendar input %j", (patch) => {
    expect(
      getAssociativeAnnualEligibility({ ...calendar, ...patch }).every(
        (annual) => !annual.eligible,
      ),
    ).toBe(true);
  });

  it("excludes filled annuals from the ledger when the calculation date is invalid", () => {
    const result = calculateInvestorFlow({ ...flowInput, baseDate: "2026-02-30" });
    expect(result.ok).toBe(false);
    expect(result.custom.intermediaries[0]).toMatchObject({
      value: 1000,
      eligible: false,
      approved: false,
      correctedValue: 0,
    });
    expect(result.custom.annualNominalTotal).toBe(0);
  });

  it("applies each standard plan's own signals and floors its offered annual", () => {
    const result = calculateInvestorFlow({ ...flowInput, intermediaries: [0, 0, 0, 0, 0] });
    for (const scenario of result.standardScenarios as Scenario[]) {
      for (const annual of scenario.linear.annualSchedule) {
        expect(annual.amount).toBeLessThanOrEqual(2500);
        if (annual.amount > 0) expect(annual.valid).toBe(true);
        if (scenario.signalLimit > 1 && annual.dueDate === "2026-12-15")
          expect(annual.amount).toBe(0);
      }
    }
    const annualPlan = result.standardScenarios.find((scenario: Scenario) =>
      scenario.linear.annualSchedule.some((annual) => annual.amount > 0),
    );
    expect(annualPlan).toBeDefined();
  });

  it("keeps calendar results identical across time zones", () => {
    const moduleUrl = new URL(
      "../lib/archive-investor/associative-annual-rules.mjs",
      import.meta.url,
    );
    const source = `import { getAssociativeAnnualEligibility } from ${JSON.stringify(moduleUrl.href)};
      console.log(JSON.stringify(getAssociativeAnnualEligibility({
        baseDate: "2026-10-20", entryDate: "2026-10-20", completionDate: "2029-12-31",
        signalDates: ["2026-11-15", "2026-12-15", "2027-01-15"]
      })));`;
    const outputs = ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"].map((TZ) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: { ...process.env, TZ },
        encoding: "utf8",
      }),
    );
    expect(new Set(outputs).size).toBe(1);
  });
});
