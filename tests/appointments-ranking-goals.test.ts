import { describe, expect, it } from "vitest";
import { analyzeAppointments } from "@/lib/crm/stages/appointments";
import { appointmentModel } from "./fixtures/appointments-summary";

const roster = [
  { key: "a", owner: "Corretor A", manager: "Gerente A" },
  { key: "b", owner: "Corretor B", manager: "Gerente A" },
  { key: "c", owner: "Corretor C", manager: "Gerente B" },
];

function input() {
  const model = appointmentModel(1).analysis;
  const row = (day: string, owner: string, salesManager: string, regionalManager: string) => ({
    ...model.appointments[0]!,
    createdAt: `${day}T15:00:00Z`,
    owner,
    salesManager,
    regionalManager,
    channel: 1 as const,
  });
  return {
    ...model,
    viewKey: "without_canal_imob" as const,
    coverageStart: "2026-11-01",
    referenceDate: "2026-11-05",
    brokerCount: 3,
    facts: [],
    appointments: [
      row("2026-11-01", "Corretor A", "Gerente A", "Regional A"),
      row("2026-11-01", "Corretor C", "Gerente B", "Regional B"),
      row("2026-11-02", "Corretor A", "Gerente A", "Regional A"),
      row("2026-11-03", "Corretor A", "Gerente A", "Regional A"),
      row("2026-11-04", "Corretor B", "Gerente A", "Regional A"),
      row("2026-11-05", "Corretor C", "Gerente B", "Regional B"),
    ],
  };
}

describe("appointment ranking calendar goals", () => {
  it("uses explicit broker regions even when one sales manager spans regions", () => {
    const explicit = roster.map((broker, index) => ({
      ...broker,
      regionalManager: index === 2 ? "Regional A" : "Regional B",
    }));
    const result = analyzeAppointments(input(), { brokerRoster: explicit });
    expect(result.regionalManagers?.map(({ key, goal }) => [key, goal])).toEqual([
      ["Regional A", 23],
      ["Regional B", 46],
    ]);
    const filtered = analyzeAppointments(input(), {
      brokerRoster: explicit,
      filters: { regionalManager: "Regional B" },
    });
    expect(filtered.todayGoal).toBe(4);
  });

  it("does not infer an explicitly unknown regional link from manager activity", () => {
    const result = analyzeAppointments(input(), {
      brokerRoster: roster.map((broker) => ({ ...broker, regionalManager: null })),
    });
    expect(result.regionalManagers?.every(({ goal }) => goal === null)).toBe(true);
    expect(result.managers[0]?.goal).toBe(46);
  });

  it("uses each registered cohort, not the highest actual rank or productive broker count", () => {
    const result = analyzeAppointments(input(), { brokerRoster: [...roster, roster[0]!] });
    // November2026:19 useful weekdays plus4 Thursday bonuses, per broker.
    expect(result.owners.map(({ key, goal }) => [key, goal])).toEqual([
      ["Corretor A", 23],
      ["Corretor C", 23],
      ["Corretor B", 23],
    ]);
    expect(result.managers.map(({ key, goal }) => [key, goal])).toEqual([
      ["Gerente A", 46],
      ["Gerente B", 23],
    ]);
    expect(result.regionalManagers?.map(({ key, goal }) => [key, goal])).toEqual([
      ["Regional A", 46],
      ["Regional B", 23],
    ]);
    expect(result.todayGoal).toBe(6);
    expect(result.weekly.find(({ key }) => key === "2")?.goal).toBe(15);
  });

  it("intersects the period and team while retaining Thursday's double target", () => {
    const result = analyzeAppointments(input(), {
      brokerRoster: roster,
      filters: { periodStart: "2026-11-02", periodEnd: "2026-11-05", manager: "Gerente A" },
    });
    expect(result.managers).toEqual([{ key: "Gerente A", label: "Gerente A", total: 3, goal: 8 }]);
    expect(result.owners.map(({ goal }) => goal)).toEqual([4, 4]);
    expect(result.regionalManagers?.[0]?.goal).toBe(8);
    expect(result.todayGoal).toBe(4);
  });

  it("retains a real zero target on a holiday rather than substituting the observed activity", () => {
    const result = analyzeAppointments(input(), {
      brokerRoster: roster,
      filters: { createdDate: "2026-11-02" },
    });
    expect(result.total).toBe(1);
    expect(result.owners[0]).toMatchObject({ total: 1, goal: 0 });
    expect(result.managers[0]?.goal).toBe(0);
    expect(result.weeklyTarget).toBe(0);
  });

  it("keeps missing cohorts and unmappable dimensions unavailable", () => {
    const withoutRoster = analyzeAppointments(input());
    expect(withoutRoster.owners.every(({ goal }) => goal === null)).toBe(true);
    expect(withoutRoster.managers.every(({ goal }) => goal === null)).toBe(true);
    for (const filters of [{ company: "Empresa sintética" }, { accountRanking: "Prata" }]) {
      const result = analyzeAppointments(input(), { brokerRoster: roster, filters });
      expect(result.owners.every(({ goal }) => goal === null)).toBe(true);
    }
  });

  it("does not assign a regional target from an unstable or absent historical link", () => {
    const model = input();
    model.appointments[4]!.regionalManager = "Regional Nova";
    const result = analyzeAppointments(model, { brokerRoster: roster });
    expect(result.regionalManagers?.every(({ goal }) => goal === null)).toBe(true);
    expect(result.managers[0]?.goal).toBe(46);
  });

  it("retains a proven regional minimum without treating an incomplete cohort as an exact target", () => {
    const result = analyzeAppointments(input(), {
      brokerRoster: [
        ...roster,
        { key: "unknown", owner: "Corretor sem vínculo", manager: "Gerente sem histórico" },
      ],
    });
    const regionalA = result.regionalManagers?.find(({ key }) => key === "Regional A");
    expect(regionalA).toMatchObject({ goal: null, goalLowerBound: 46, total: 4 });
    expect(result.regionalManagers?.find(({ key }) => key === "Regional B")).toMatchObject({
      goal: null,
      goalLowerBound: 23,
    });
    // The unknown broker can belong to either region; neither exact target is advertised.
    expect(result.regionalManagers?.every(({ goal }) => goal === null)).toBe(true);
    expect(
      analyzeAppointments(input()).regionalManagers?.every(
        (row) => row.goalLowerBound === undefined,
      ),
    ).toBe(true);
  });
});
