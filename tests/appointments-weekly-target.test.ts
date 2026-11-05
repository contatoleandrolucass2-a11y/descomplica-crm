import { describe, expect, it } from "vitest";
import { analyzeAppointments } from "@/lib/crm/stages/appointments";
import { appointmentModel } from "./fixtures/appointments-summary";

function monthlyInput(count = 17) {
  const model = appointmentModel(1).analysis;
  return {
    ...model,
    viewKey: "without_canal_imob" as const,
    coverageStart: "2026-11-01",
    referenceDate: "2026-11-05",
    brokerCount: 34,
    facts: [],
    appointments: Array.from({ length: count }, () => ({
      ...model.appointments[0]!,
      createdAt: "2026-11-04T15:00:00Z",
      owner: "Corretor A",
      salesManager: "Gerente A",
      regionalManager: "Regional A",
      channel: 1 as const,
    })),
  };
}
const roster = [
  { key: "a", owner: "Corretor A", manager: "Gerente A" },
  { key: "b", owner: "Corretor B", manager: "Gerente A" },
  { key: "c", owner: "Corretor C", manager: "Gerente B" },
];

describe("weekly appointment calendar target", () => {
  it("uses the full intersecting week's valid days instead of the largest actual sum", () => {
    // Nov 2 is a national holiday: Tue1 + Wed1 + Thu2 + Fri1 =5 per broker.
    for (const count of [0, 17, 300]) {
      const result = analyzeAppointments(monthlyInput(count));
      expect(result.weeklyTarget).toBe(170);
      expect(result.weekly.map(({ key, goal }) => [key, goal])).toEqual([
        ["1", 0],
        ["2", 170],
      ]);
      expect(result.weekly.find(({ key }) => key === "2")?.total).toBe(count);
      expect(result.daily.find(({ key }) => key === "2026-11-02")?.goal).toBe(0);
      expect(result.daily.find(({ key }) => key === "2026-11-05")?.goal).toBe(68);
      expect(result.todayGoal).toBe(68);
    }
  });

  it("keeps date/week intersections and derives filtered team targets from registered brokers", () => {
    const input = monthlyInput();
    const read = (
      filters: NonNullable<NonNullable<Parameters<typeof analyzeAppointments>[1]>["filters"]>,
    ) => analyzeAppointments(input, { brokerRoster: [...roster, roster[0]!], filters });
    expect(read({ week: 2, manager: "Gerente A" }).weeklyTarget).toBe(10);
    expect(read({ owner: "Corretor A", createdDates: ["2026-11-05"] }).weeklyTarget).toBe(2);
    expect(read({ periodStart: "2026-11-02", periodEnd: "2026-11-05" }).weeklyTarget).toBe(12);
    expect(read({ week: 1 }).weeklyTarget).toBe(0);
    expect(read({ week: 3 }).weeklyTarget).toBeNull();
  });

  it("does not infer a missing or unmappable denominator from activity", () => {
    const input = monthlyInput();
    for (const filters of [
      { owner: "Corretor A" },
      { company: "Empresa sintética" },
      { accountRanking: "Prata" },
      { channel: 0 as const },
    ])
      expect(analyzeAppointments(input, { filters }).weeklyTarget).toBeNull();
    expect(analyzeAppointments(input, { month: "2026-12" }).weeklyTarget).toBeNull();
    expect(analyzeAppointments({ ...input, brokerCount: undefined }).weeklyTarget).toBeNull();
  });
});
