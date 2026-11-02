import { describe, expect, it } from "vitest";

import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import { analyzeAppointments } from "@/lib/crm/stages/appointments";
import { analyzeProductiveTeam } from "@/lib/crm/stages/productive-team";

const roster = [
  { key: "ana", owner: "Ana", manager: "Gerente A" },
  { key: "bia", owner: "Bia", manager: "Gerente B" },
];
const appointment = (owner = "Ana", date = "2026-11-02", registeredBroker = true) => ({
  createdAt: `${date}T12:00:00Z`,
  scheduledAt: null,
  attendedAt: null,
  visitPerformed: false,
  regionalManager: "Regional A",
  salesManager: "Gerente A",
  owner,
  accountName: "Conta sintética",
  accountRanking: "A",
  channel: 1 as const,
  company: "Empresa A",
  registeredBroker,
});
const fact = (
  stage: number,
  owner = 0,
  date = "2026-11-02",
  count = 1,
  manager = 0,
): DashboardAnalysisFact => [stage, date, manager, owner, 0, 1, -1, count, 0, 0, -1];
const slice = (overrides: Partial<DashboardAnalysisSlice> = {}): DashboardAnalysisSlice => ({
  version: 4,
  viewKey: "without_canal_imob",
  coverageStart: "2026-10-01",
  referenceDate: "2026-11-10",
  brokerCount: 2,
  brokerManagerCount: 2,
  dimensions: {
    managers: ["Gerente A", "Gerente B"],
    owners: ["Ana", "Bia", "Não cadastrado"],
    companies: ["Empresa A"],
    developments: [],
    stores: [],
  },
  appointments: [
    appointment(),
    appointment("Ana", "2026-11-03"),
    appointment("Não cadastrado", "2026-11-02", false),
  ],
  facts: [
    fact(2, 0, "2026-11-02", 20),
    fact(2, 0, "2026-11-03"),
    fact(2, 1, "2026-11-02", 1, 1),
    fact(3),
    fact(4, 2),
    fact(4, 0, "2026-10-31"),
  ],
  ...overrides,
});

describe("productive team analysis", () => {
  it("counts unique registered brokers instead of operations and preserves the appointment rule", () => {
    const input = slice();
    const result = analyzeProductiveTeam(input, { brokerRoster: roster });
    expect(result.cards.map(({ productiveBrokers }) => productiveBrokers)).toEqual([1, 2, 1, 0]);
    expect(result.cards.map(({ percent }) => percent)).toEqual([50, 100, 50, 0]);
    const existing = analyzeAppointments(input, { brokerRoster: roster });
    expect(result.cards[0]).toMatchObject({
      productiveBrokers: existing.productiveBrokers,
      percent: existing.productivePercent,
      brokerCount: existing.brokerCount,
    });
  });

  it("intersects dimensional filters with the registered denominator", () => {
    const result = analyzeProductiveTeam(slice(), {
      brokerRoster: roster,
      filters: { channel: 1, manager: "Gerente A", owner: "Ana" },
    });
    expect(result.brokerCount).toBe(1);
    expect(result.cards.map(({ productiveBrokers }) => productiveBrokers)).toEqual([1, 1, 1, 0]);
    expect(result.cards[1]?.percent).toBe(100);
  });

  it("uses inclusive cross-month periods without shrinking the current registered roster", () => {
    const result = analyzeProductiveTeam(
      slice({
        facts: [fact(4, 0, "2026-10-31"), fact(4, 1, "2026-11-01", 1, 1), fact(4, 0, "2026-11-02")],
      }),
      { brokerRoster: roster, filters: { periodStart: "2026-10-31", periodEnd: "2026-11-01" } },
    );
    expect(result.cards[3]).toMatchObject({ productiveBrokers: 2, brokerCount: 2, percent: 100 });
    expect(result.cards[0]?.productiveBrokers).toBe(0);
    expect(result.coverage).toBe("complete");
  });

  it("distinguishes a confirmed zero from unavailable roster and denied stages", () => {
    const known = analyzeProductiveTeam(slice({ facts: [], appointments: [] }), {
      brokerRoster: roster,
    });
    expect(known.cards.every((card) => card.productiveBrokers === 0 && card.percent === 0)).toBe(
      true,
    );
    const missing = analyzeProductiveTeam(slice());
    expect(missing.cards[1]).toMatchObject({
      productiveBrokers: null,
      percent: null,
      unavailableReason: "missing-roster",
    });
    const denied = analyzeProductiveTeam(slice(), {
      brokerRoster: roster,
      availableStages: ["appointments"],
    });
    expect(
      denied.cards
        .slice(1)
        .every((card) => card.unavailableReason === "stage-unavailable" && card.percent === null),
    ).toBe(true);
  });

  it("intersects non-contiguous calendar dates with the reporting period", () => {
    const input = slice({
      facts: [
        fact(2, 0, "2026-11-01"),
        fact(2, 1, "2026-11-02", 1, 1),
        fact(2, 0, "2026-11-03"),
        fact(4, 1, "2026-10-31", 1, 1),
      ],
    });
    const result = analyzeProductiveTeam(input, {
      brokerRoster: roster,
      filters: {
        createdDates: ["2026-11-01", "2026-11-03", "2026-11-03", "2026-10-31"],
        periodStart: "2026-11-01",
        periodEnd: "2026-11-10",
      },
    });
    expect(result.cards[1]).toMatchObject({ productiveBrokers: 1, percent: 50 });
    expect(result.cards[3]?.productiveBrokers).toBe(0);
    expect(
      analyzeProductiveTeam(input, { brokerRoster: roster, filters: { createdDate: "2026-11-02" } })
        .cards[1]?.productiveBrokers,
    ).toBe(1);
  });

  it("does not fabricate a denominator for Imob or company filters", () => {
    for (const filters of [{ channel: 0 as const }, { company: "Empresa A" }]) {
      const result = analyzeProductiveTeam(slice(), { brokerRoster: roster, filters });
      expect(
        result.cards.every(
          (card) =>
            card.unavailableReason === "unsupported-dimensions" && card.brokerCount === null,
        ),
      ).toBe(true);
    }
  });

  it("handles empty rosters, missing versions and invalid or uncovered periods", () => {
    const empty = analyzeProductiveTeam(slice({ brokerCount: 0, facts: [], appointments: [] }), {
      brokerRoster: [],
    });
    expect(empty.cards.every((card) => card.brokerCount === 0 && card.percent === 0)).toBe(true);
    expect(
      analyzeProductiveTeam(slice({ version: 3 }), { brokerRoster: roster }).cards.every(
        (card) => card.unavailableReason === "unsupported-version",
      ),
    ).toBe(true);
    for (const filters of [
      { periodStart: "2026-11-05", periodEnd: "2026-11-01" },
      { periodStart: "2026-11-20", periodEnd: "2026-11-30" },
      { periodStart: "2026-02-30" },
    ])
      expect(
        analyzeProductiveTeam(slice(), { brokerRoster: roster, filters }).cards.every(
          (card) => card.unavailableReason === "unavailable-period" && card.percent === null,
        ),
      ).toBe(true);
  });

  it("normalizes roster names, deduplicates keys and fails closed on ambiguous identities", () => {
    const input = slice({
      dimensions: { ...slice().dimensions, owners: ["  Ána  "] },
      facts: [fact(2)],
      appointments: [],
    });
    const result = analyzeProductiveTeam(input, { brokerRoster: [...roster, roster[0]!] });
    expect(result.cards[1]).toMatchObject({ productiveBrokers: 1, percent: 50 });
    const ambiguous = analyzeProductiveTeam(input, {
      brokerRoster: [...roster, { key: "ana-2", owner: "Ana", manager: "Gerente A" }],
    });
    expect(ambiguous.cards[1]).toMatchObject({
      productiveBrokers: null,
      unavailableReason: "ambiguous-broker",
    });
  });

  it("requires a known regional link for the whole selected roster period", () => {
    const options = {
      brokerRoster: [roster[0]!],
      filters: {
        regionalManager: "Regional A",
        manager: "Gerente A",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-10",
      },
    };
    const known = analyzeProductiveTeam(
      slice({ appointments: [appointment("Ana", "2026-11-01")] }),
      options,
    );
    expect(known.cards[1]).toMatchObject({ productiveBrokers: 1, brokerCount: 1, percent: 100 });
    const unknown = analyzeProductiveTeam(slice({ appointments: [] }), options);
    expect(unknown.cards.every((card) => card.unavailableReason === "unknown-regional-link")).toBe(
      true,
    );
  });

  it("does not report more productive brokers than the registered denominator", () => {
    const result = analyzeProductiveTeam(slice({ brokerCount: 1 }), { brokerRoster: roster });
    expect(result.cards[1]).toMatchObject({
      productiveBrokers: null,
      percent: null,
      unavailableReason: "inconsistent-roster",
    });
  });

  it("recognizes the registered broker after a historical manager change", () => {
    const result = analyzeProductiveTeam(slice({ facts: [fact(4, 0, "2026-11-02", 1, 1)] }), {
      brokerRoster: roster,
    });
    expect(result.cards[3]).toMatchObject({ productiveBrokers: 1, percent: 50 });
  });
});
