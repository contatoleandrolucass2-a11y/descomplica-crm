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
  it("uses the official regional in both groups despite inconsistent historical observations", () => {
    const input = slice({
      appointments: [
        appointment(),
        { ...appointment("Ana", "2026-11-03"), regionalManager: "Regional Histórico" },
      ],
      facts: [fact(4)],
    });
    const result = analyzeProductiveTeam(input, {
      brokerRoster: [
        { ...roster[0]!, regionalManager: "Regional Oficial" },
        { ...roster[1]!, regionalManager: "Regional Oficial" },
      ],
    });
    expect(result.cards[3]?.productiveMembers?.[0]?.regionalManager).toBe("Regional Oficial");
    expect(result.cards[3]?.unproductiveMembers?.[0]?.regionalManager).toBe("Regional Oficial");
    expect(result.summaryRows?.map((row) => row.regionalManagers)).toEqual([
      ["Regional Oficial"],
      ["Regional Oficial"],
    ]);
    const unknown = analyzeProductiveTeam(input, {
      brokerRoster: roster.map((member) => ({ ...member, regionalManager: null })),
    });
    expect(
      unknown.summaryRows?.every(
        (row) => row.regionalManagers.length === 0 && row.regionalUnknownBrokerCount === 1,
      ),
    ).toBe(true);
  });

  it("derives summary counts from the same unique membership as the cards", () => {
    const result = analyzeProductiveTeam(slice(), { brokerRoster: [...roster, roster[0]!] });
    expect(result.summaryRows?.reduce((sum, row) => sum + row.brokerCount, 0)).toBe(
      result.brokerCount,
    );
    for (const card of result.cards) {
      expect(result.summaryRows?.reduce((sum, row) => sum + (row[card.stage] ?? 0), 0)).toBe(
        card.productiveBrokers,
      );
    }
    const filtered = analyzeProductiveTeam(slice(), {
      brokerRoster: roster,
      filters: { owner: "Ana", createdDate: "2026-11-02" },
    });
    expect(filtered.summaryRows).toHaveLength(1);
    expect(filtered.summaryRows?.[0]).toMatchObject({
      manager: "Gerente A",
      brokerCount: 1,
      appointments: 1,
      visits: 1,
      folders: 1,
      sales: 0,
    });
  });

  it("distinguishes an unknown base, an empty base and unavailable stages", () => {
    expect(analyzeProductiveTeam(slice()).summaryRows).toBeNull();
    expect(
      analyzeProductiveTeam(slice({ brokerCount: 1 }), { brokerRoster: roster }).summaryRows,
    ).toBeNull();
    expect(
      analyzeProductiveTeam(slice(), { brokerRoster: roster, filters: { company: "Empresa A" } })
        .summaryRows,
    ).toBeNull();
    expect(
      analyzeProductiveTeam(slice({ brokerCount: 0, facts: [], appointments: [] }), {
        brokerRoster: [],
      }).summaryRows,
    ).toEqual([]);
    const unavailable = analyzeProductiveTeam(slice(), {
      brokerRoster: roster,
      availableStages: ["appointments"],
    });
    expect(unavailable.summaryRows).toHaveLength(2);
    expect(
      unavailable.summaryRows?.every(
        (row) => row.visits === null && row.folders === null && row.sales === null,
      ),
    ).toBe(true);
  });

  it("sorts full identities by regional, manager and owner without merging similar names", () => {
    const result = analyzeProductiveTeam(slice({ appointments: [], facts: [] }), {
      brokerRoster: [
        {
          key: "one",
          owner: "Ana Maria Silva",
          manager: "Gerente B",
          regionalManager: "Regional B",
        },
        {
          key: "two",
          owner: "Ana Paula Silva",
          manager: "Gerente A",
          regionalManager: "Regional A",
        },
      ],
    });
    expect(result.summaryRows?.map((row) => row.manager)).toEqual(["Gerente A", "Gerente B"]);
  });

  it("groups dynamically by full manager identity, with weighted unique broker counts", () => {
    const brokerRoster = [
      { ...roster[0]!, manager: "Gerente Ana Maria Silva", regionalManager: "Regional A" },
      { ...roster[1]!, manager: "Gerente Ana Maria Silva", regionalManager: "Regional A" },
      ...["Gerente Ana Paula Silva", "Gerente C", "Gerente D", "Gerente E"].map(
        (manager, index) => ({
          key: `extra${index}`,
          owner: `Pessoa ${index}`,
          manager,
          regionalManager: "Regional B",
        }),
      ),
    ];
    const result = analyzeProductiveTeam(slice({ brokerCount: 6 }), {
      brokerRoster: [...brokerRoster, brokerRoster[0]!],
    });
    expect(result.summaryRows).toHaveLength(5);
    const group = result.summaryRows?.find((row) => row.manager === "Gerente Ana Maria Silva");
    expect(group).toMatchObject({
      brokerCount: 2,
      appointments: 1,
      visits: 2,
      folders: 1,
      sales: 0,
    });
    for (const card of result.cards)
      expect(result.summaryRows?.reduce((sum, row) => sum + (row[card.stage] ?? 0), 0)).toBe(
        card.productiveBrokers,
      );
    const ownerFiltered = analyzeProductiveTeam(slice({ brokerCount: 6 }), {
      brokerRoster,
      filters: { owner: "Ana" },
    });
    expect(ownerFiltered.summaryRows).toHaveLength(1);
    expect(ownerFiltered.summaryRows?.[0]?.brokerCount).toBe(1);
    const managerFiltered = analyzeProductiveTeam(slice({ brokerCount: 6 }), {
      brokerRoster,
      filters: { manager: "Gerente Ana Maria Silva" },
    });
    expect(managerFiltered.summaryRows).toHaveLength(1);
    expect(managerFiltered.summaryRows?.[0]?.brokerCount).toBe(2);
  });

  it("keeps all known official regions and separately counts unknown links within one manager", () => {
    const result = analyzeProductiveTeam(slice({ brokerCount: 4 }), {
      brokerRoster: [
        { ...roster[0]!, manager: "Gerente Único", regionalManager: "Regional B" },
        { ...roster[1]!, manager: "Gerente Único", regionalManager: "Regional A" },
        { key: "extra1", owner: "Pessoa C", manager: "Gerente Único", regionalManager: null },
        {
          key: "extra2",
          owner: "Pessoa D",
          manager: "Gerente Único",
          regionalManager: "Regional A",
        },
      ],
    });
    expect(result.summaryRows).toHaveLength(1);
    expect(result.summaryRows?.[0]).toMatchObject({
      manager: "Gerente Único",
      regionalManagers: ["Regional A", "Regional B"],
      regionalUnknownBrokerCount: 1,
      brokerCount: 4,
      appointments: 1,
      visits: 2,
      folders: 1,
      sales: 0,
    });
  });
  it.each(["appointments", "visits", "folders", "sales"] as const)(
    "intersects %s activity with the current filtered roster after a manager change",
    (stage) => {
      const stages = ["appointments", "visits", "folders", "sales"] as const;
      const stageIndex = stages.indexOf(stage);
      const historical = slice({
        appointments: [{ ...appointment(), salesManager: "Gerente B" }],
        facts: [fact(stageIndex + 1, 0, "2026-11-02", 1, 1)],
      });
      const otherManager = analyzeProductiveTeam(historical, {
        brokerRoster: roster,
        filters: { manager: "Gerente B" },
      }).cards[stageIndex];
      expect(otherManager).toMatchObject({
        productiveBrokers: 0,
        brokerCount: 1,
        percent: 0,
        unavailableReason: null,
      });
      expect(
        analyzeProductiveTeam(historical, { brokerRoster: roster }).cards[stageIndex],
      ).toMatchObject({ productiveBrokers: 1, brokerCount: 2, percent: 50 });

      const current = slice({ appointments: [appointment()], facts: [fact(stageIndex + 1)] });
      expect(
        analyzeProductiveTeam(current, { brokerRoster: roster, filters: { manager: "Gerente A" } })
          .cards[stageIndex],
      ).toMatchObject({ productiveBrokers: 1, brokerCount: 1, percent: 100 });

      const mixed = slice({
        appointments: [
          ...historical.appointments!,
          { ...appointment("Bia"), salesManager: "Gerente B" },
        ],
        facts: [...historical.facts, fact(stageIndex + 1, 1, "2026-11-02", 1, 1)],
      });
      expect(
        analyzeProductiveTeam(mixed, { brokerRoster: roster, filters: { manager: "Gerente B" } })
          .cards[stageIndex],
      ).toMatchObject({
        productiveBrokers: 1,
        brokerCount: 1,
        percent: 100,
        unavailableReason: null,
      });
    },
  );

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
    expect(missing.cards[0]).toMatchObject({
      productiveBrokers: 1,
      brokerCount: 2,
      percent: 50,
      unavailableReason: null,
    });
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

  it("partitions the same deduplicated roster as every indicator and sorts both tables in pt-BR", () => {
    const members = [
      { key: "zelia", owner: "Zélia", manager: "Gerente Ágata" },
      { key: "alvaro", owner: "Álvaro", manager: "Gerente Ágata" },
      { key: "bia", owner: "bia", manager: "Gerente B" },
      { key: "ana", owner: "Ana", manager: "Gerente Aline" },
      { key: "bruno", owner: "Bruno", manager: "Gerente C" },
      { key: "carlos", owner: "Carlos", manager: "Gerente X" },
    ];
    const input = slice({
      brokerCount: members.length,
      dimensions: {
        ...slice().dimensions,
        managers: members.map((member) => member.manager),
        owners: members.map((member) => member.owner),
      },
      appointments: members.slice(0, 5).map((member, index) => ({
        ...appointment(member.owner, "2026-11-01"),
        salesManager: member.manager,
        regionalManager: index < 3 ? "Regional Á" : "Regional B",
      })),
      facts: [
        ...members.map((_, index) => fact(2, index, "2026-11-02", 1, index)),
        fact(2, 0, "2026-11-03", 20),
      ],
    });
    const result = analyzeProductiveTeam(input, {
      brokerRoster: [...members, members[0]!],
    });
    const order = ["alvaro", "zelia", "bia", "ana", "bruno", "carlos"];
    expect(result.cards[1]?.productiveMembers?.map((member) => member.key)).toEqual(order);
    expect(result.cards[1]?.unproductiveMembers).toEqual([]);
    expect(result.cards[2]?.productiveMembers).toEqual([]);
    expect(result.cards[2]?.unproductiveMembers?.map((member) => member.key)).toEqual(order);
    expect(result.cards[1]?.productiveMembers?.at(-1)).toEqual({
      ...members[5],
      regionalManager: null,
    });
    for (const card of result.cards) {
      expect(card.productiveMembers).toHaveLength(card.productiveBrokers!);
      expect(card.productiveMembers!.length + card.unproductiveMembers!.length).toBe(
        card.brokerCount,
      );
      const keys = [...card.productiveMembers!, ...card.unproductiveMembers!].map(
        (member) => member.key,
      );
      expect(new Set(keys).size).toBe(card.brokerCount);
    }
  });

  it("limits both tables to the current filtered denominator and the card's selected dates", () => {
    const input = slice({
      appointments: [
        appointment("Ana", "2026-11-01"),
        { ...appointment("Bia", "2026-11-01"), salesManager: "Gerente B" },
      ],
      facts: [fact(2, 0, "2026-11-02"), fact(2, 1, "2026-11-03", 1, 1)],
    });
    const result = analyzeProductiveTeam(input, {
      brokerRoster: roster,
      filters: {
        channel: 1,
        regionalManager: "Regional A",
        manager: "Gerente A",
        owner: "Ana",
        createdDates: ["2026-11-03"],
      },
    });
    expect(result.cards[1]).toMatchObject({
      productiveBrokers: 0,
      brokerCount: 1,
      productiveMembers: [],
      unproductiveMembers: [
        { key: "ana", owner: "Ana", manager: "Gerente A", regionalManager: "Regional A" },
      ],
    });
    const selected = analyzeProductiveTeam(input, {
      brokerRoster: roster,
      filters: { owner: "Ana", createdDate: "2026-11-02" },
    });
    expect(selected.cards[1]?.productiveMembers?.map((member) => member.key)).toEqual(["ana"]);
    expect(selected.cards[1]?.unproductiveMembers).toEqual([]);
  });

  it("does not invent a regional link when it changes, conflicts, is future-only or is absent", () => {
    for (const observations of [
      [],
      [appointment("Ana", "2026-11-11")],
      [
        appointment("Ana", "2026-11-01"),
        { ...appointment("Ana", "2026-11-06"), regionalManager: "Regional B" },
      ],
      [
        appointment("Ana", "2026-11-01"),
        { ...appointment("Ana", "2026-11-01"), regionalManager: "Regional B" },
      ],
    ]) {
      const card = analyzeProductiveTeam(slice({ appointments: observations, facts: [fact(4)] }), {
        brokerRoster: roster,
      }).cards[3]!;
      expect(card.productiveBrokers).toBe(1);
      expect(card.productiveMembers?.[0]).toMatchObject({
        owner: "Ana",
        regionalManager: null,
      });
      expect(card.unproductiveMembers?.[0]).toMatchObject({
        owner: "Bia",
        regionalManager: null,
      });
    }
    const changed = slice({
      appointments: [
        appointment("Ana", "2026-11-01"),
        { ...appointment("Ana", "2026-11-06"), regionalManager: "Regional B" },
      ],
      facts: [fact(4)],
    });
    const early = analyzeProductiveTeam(changed, {
      brokerRoster: roster,
      filters: { periodStart: "2026-11-01", periodEnd: "2026-11-05" },
    });
    expect(early.cards[3]?.productiveMembers?.[0]?.regionalManager).toBe("Regional A");
    const selected = analyzeProductiveTeam(changed, {
      brokerRoster: roster,
      filters: { createdDates: ["2026-11-02", "2026-11-03"] },
    });
    expect(selected.cards[3]?.productiveMembers?.[0]?.regionalManager).toBe("Regional A");
  });

  it("shows the current registered manager instead of the historical activity manager", () => {
    const card = analyzeProductiveTeam(
      slice({
        appointments: [{ ...appointment("Ana", "2026-11-01"), salesManager: "Gerente B" }],
        facts: [fact(4, 0, "2026-11-02", 1, 1)],
      }),
      { brokerRoster: roster },
    ).cards[3]!;
    expect(card.productiveMembers).toEqual([
      { key: "ana", owner: "Ana", manager: "Gerente A", regionalManager: null },
    ]);
    expect(card.unproductiveMembers).toEqual([
      { key: "bia", owner: "Bia", manager: "Gerente B", regionalManager: "Regional A" },
    ]);
  });

  it("keeps detail unavailable rather than inventing rows without a reconciled roster", () => {
    const missing = analyzeProductiveTeam(slice()).cards[0]!;
    expect(missing).toMatchObject({
      productiveBrokers: 1,
      percent: 50,
      productiveMembers: null,
      unproductiveMembers: null,
    });
    for (const brokerCount of [1, 3]) {
      const card = analyzeProductiveTeam(slice({ brokerCount }), { brokerRoster: roster })
        .cards[0]!;
      expect(card.productiveBrokers).toBe(1);
      expect(card.productiveMembers).toBeNull();
      expect(card.unproductiveMembers).toBeNull();
    }
    for (const options of [
      { brokerRoster: roster, availableStages: [] },
      { brokerRoster: roster, filters: { company: "Empresa A" } },
      { brokerRoster: roster, filters: { regionalManager: "Desconhecido" } },
    ])
      for (const card of analyzeProductiveTeam(slice(), options).cards) {
        expect(card.productiveMembers).toBeNull();
        expect(card.unproductiveMembers).toBeNull();
      }
    const empty = analyzeProductiveTeam(slice({ brokerCount: 0, facts: [], appointments: [] }), {
      brokerRoster: [],
    });
    for (const card of empty.cards) {
      expect(card.productiveMembers).toEqual([]);
      expect(card.unproductiveMembers).toEqual([]);
    }
  });
});
