import type { AppointmentsReadModel } from "@/lib/crm/stages/data";

export function appointmentModel(count = 123) {
  return {
    generatedAt: "2026-10-31T12:00:00.123456Z",
    individualGoal: 24,
    goalsByMonth: { "2026-09": 0, "2026-10": 24 },
    conversionGoals: null,
    conversionGoalsByMonth: {},
    brokerRoster: [
      { key: "broker-a", owner: "Corretor A", manager: "Gerente A" },
      { key: "broker-b", owner: "Corretor B", manager: "Gerente B" },
    ],
    analysis: {
      version: 4,
      viewKey: "all",
      coverageStart: "2026-01-01",
      referenceDate: "2026-10-31",
      brokerCount: 2,
      brokerManagerCount: 2,
      dimensions: {
        managers: ["Gerente A", "Gerente B"],
        owners: ["Corretor A", "Corretor B"],
        companies: ["Empresa sintética"],
        developments: ["Empreendimento sintético"],
        stores: [],
      },
      facts: [
        [0, "2026-10-19", 0, 0, 0, 1, 0, 100, 0, 0, -1],
        [1, "2026-10-19", 0, 0, 0, 1, 0, count, 0, 0, -1],
        [1, "2026-10-19", 1, 1, 0, 0, 0, Math.ceil(count / 2), 0, 0, -1],
        [2, "2026-10-19", 0, 0, 0, 1, 0, 8, 0, 0, -1],
        [3, "2026-10-19", 0, 0, 0, 1, 0, 4, 0, 2, -1],
        [4, "2026-10-19", 0, 0, 0, 1, 0, 2, 300000, 0, -1],
      ],
      appointments: Array.from({ length: count }, (_, index) => ({
        createdAt: "2026-10-19T15:00:00Z",
        scheduledAt: "2026-10-20T15:30:00Z",
        attendedAt: index % 2 ? "2026-10-20T15:40:00Z" : null,
        visitPerformed: index % 2 === 1,
        regionalManager: `Regional ${index % 2 ? "B" : "A"}`,
        salesManager: `Gerente ${index % 2 ? "B" : "A"}`,
        owner: `Corretor ${index % 2 ? "B" : "A"}`,
        accountName: `Conta sintética ${String(index).padStart(5, "0")}`,
        accountRanking: index % 3 ? "Ouro" : "Prata",
        channel: index % 2,
        company: "Empresa sintética",
        registeredBroker: index % 3 !== 0,
      })),
    },
  } satisfies AppointmentsReadModel;
}
