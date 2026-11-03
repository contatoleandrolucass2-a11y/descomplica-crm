import { describe, expect, it } from "vitest";
import { analyzeAppointments } from "@/lib/crm/stages/appointments";
import { appointmentModel } from "./fixtures/appointments-summary";

function monthlyInput() {
  const model = appointmentModel(1).analysis;
  const template = model.appointments[0]!;
  const groups = [
    { day: "2026-10-02", count: 2, owner: "A" },
    { day: "2026-10-06", count: 5, owner: "A" },
    { day: "2026-10-07", count: 2, owner: "A" },
    { day: "2026-10-02", count: 4, owner: "B" },
    { day: "2026-10-07", count: 1, owner: "B" },
    { day: "2026-09-08", count: 10, owner: "A" },
  ];
  return {
    ...model,
    appointments: groups.flatMap(({ day, count, owner }) =>
      Array.from({ length: count }, () => ({
        ...template,
        createdAt: `${day}T15:00:00Z`,
        owner: `Corretor ${owner}`,
        salesManager: `Gerente ${owner}`,
        regionalManager: `Regional ${owner}`,
        company: `Empresa ${owner}`,
        accountRanking: owner === "A" ? "Ouro" : "Prata",
        channel: owner === "A" ? (1 as const) : (0 as const),
      })),
    ),
  };
}

describe("weekly appointment benchmark", () => {
  it("uses the greatest weekly sum in the selected month, independent of temporal drill-downs", () => {
    const input = monthlyInput();
    expect(analyzeAppointments(input).weeklyTarget).toBe(8);
    for (const filters of [
      { week: 1 },
      { createdDates: ["2026-10-02"] },
      { periodStart: "2026-10-01", periodEnd: "2026-10-03" },
    ]) {
      const reading = analyzeAppointments(input, { filters });
      expect(reading.total).toBe(6);
      expect(reading.weeklyTarget).toBe(8);
    }
    expect(analyzeAppointments(input, { month: "2026-09" }).weeklyTarget).toBe(10);
  });

  it("recomputes for the authorized team, channel, company and ranking selection", () => {
    const input = monthlyInput();
    for (const filters of [
      { owner: "Corretor A" },
      { manager: "Gerente A" },
      { regionalManager: "Regional A" },
      { channel: 1 as const },
      { accountRanking: "Ouro" },
      { company: "Empresa A" },
    ])
      expect(analyzeAppointments(input, { filters }).weeklyTarget).toBe(7);
    expect(analyzeAppointments(input, { filters: { manager: "Gerente B" } }).weeklyTarget).toBe(4);
    expect(analyzeAppointments(input, { filters: { owner: "Sem movimento" } }).weeklyTarget).toBe(
      0,
    );
    expect(analyzeAppointments(input, { month: "2026-11" }).weeklyTarget).toBeNull();
  });

  it("keeps the existing fact fallback without fabricating unsupported ranking or uncovered data", () => {
    const model = appointmentModel(0).analysis;
    const input = {
      ...model,
      version: 2 as const,
      appointments: undefined,
      facts: [
        [1, "2026-10-02", 0, 0, 0, 1, 0, 3, 0, 0, -1],
        [1, "2026-10-06", 0, 0, 0, 1, 0, 5, 0, 0, -1],
        [1, "2026-10-07", 0, 0, 0, 1, 0, 2, 0, 0, -1],
      ] as typeof model.facts,
    };
    expect(analyzeAppointments(input, { filters: { week: 1 } }).weeklyTarget).toBe(7);
    expect(
      analyzeAppointments(input, { filters: { accountRanking: "Ouro" } }).weeklyTarget,
    ).toBeNull();
    expect(
      analyzeAppointments(input, {
        filters: { periodStart: "2026-11-01", periodEnd: "2026-11-02" },
      }).weeklyTarget,
    ).toBeNull();
  });
});
