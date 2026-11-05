import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import type { AppointmentFilters } from "@/lib/crm/stages/appointments";
import {
  analyzeDailyAppointmentTeam,
  appointmentTeamShortName,
} from "@/lib/crm/stages/appointments-daily-team";
import { ProductiveTeamDetails } from "@/app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDetails";
import { DailyAppointmentsTeamDetails } from "@/app/(protected)/app/etapas/_components/DailyAppointmentsTeamDetails";

const roster = [
  { key: "ana", owner: "Ana Maria Silva", manager: "Gerente João Souza" },
  { key: "bia", owner: "Bia Costa", manager: "Gerente João Souza" },
  { key: "carla", owner: "Carla de Lima", manager: "Gerente Maria Lopes" },
];
const appointment = (
  owner = roster[0]!.owner,
  createdAt = "2026-10-05T12:00:00Z",
  manager = roster[0]!.manager,
  registeredBroker = true,
) => ({
  createdAt,
  scheduledAt: null,
  attendedAt: null,
  visitPerformed: false,
  regionalManager: "Regional Carlos Santos",
  salesManager: manager,
  owner,
  accountName: "",
  accountRanking: "A",
  channel: 1 as const,
  company: "Empresa A",
  registeredBroker,
});
const analysis = (override: Partial<DashboardAnalysisSlice> = {}): DashboardAnalysisSlice => ({
  version: 4,
  viewKey: "without_canal_imob",
  coverageStart: "2026-10-01",
  referenceDate: "2026-10-31",
  brokerCount: 3,
  brokerManagerCount: 2,
  dimensions: {
    owners: roster.map((member) => member.owner),
    managers: [roster[0]!.manager, roster[2]!.manager],
    companies: ["Empresa A"],
    developments: [],
    stores: [],
  },
  facts: [],
  appointments: [
    appointment(),
    appointment(),
    appointment(roster[1]!.owner, "2026-10-06T12:00:00Z"),
    appointment(roster[2]!.owner, "2026-10-05T12:00:00Z", roster[2]!.manager),
    appointment("Sem cadastro", "2026-10-05T12:00:00Z", roster[0]!.manager, false),
  ],
  ...override,
});
const options = { date: "2026-10-05", month: "2026-10", brokerRoster: roster };

describe("daily appointment roster partition", () => {
  it("retains official broker regions in the daily team, including inactive members", () => {
    const result = analyzeDailyAppointmentTeam(analysis(), {
      ...options,
      brokerRoster: roster.map((broker, index) => ({
        ...broker,
        regionalManager: index === 1 ? "Regional distinto" : null,
      })),
    });
    expect(result.withoutAppointments?.find(({ key }) => key === "bia")?.regionalManager).toBe(
      "Regional distinto",
    );
    expect(result.withAppointments?.find(({ key }) => key === "ana")?.regionalManager).toBeNull();
  });

  it("counts distinct official identities for the selected day and preserves full names", () => {
    const result = analyzeDailyAppointmentTeam(analysis(), options);
    expect(result.unavailableReason).toBeNull();
    expect(result.withAppointments?.map((member) => member.key).sort()).toEqual(["ana", "carla"]);
    expect(result.withoutAppointments?.map((member) => member.key)).toEqual(["bia"]);
    expect(result.withAppointments?.find((member) => member.key === "ana")?.owner).toBe(
      "Ana Maria Silva",
    );
    expect(result.withAppointments?.length).toBe(2);
  });

  it("applies the same manager, owner and regional filters as the registered denominator", () => {
    const result = analyzeDailyAppointmentTeam(analysis(), {
      ...options,
      filters: {
        channel: 1,
        manager: roster[0]!.manager,
        regionalManager: "Regional Carlos Santos",
      },
    });
    expect(result.withAppointments?.map((member) => member.key)).toEqual(["ana"]);
    expect(result.withoutAppointments?.map((member) => member.key)).toEqual(["bia"]);
    const owner = analyzeDailyAppointmentTeam(analysis(), {
      ...options,
      filters: { channel: 1, owner: roster[1]!.owner },
    });
    expect(owner.withAppointments).toEqual([]);
    expect(owner.withoutAppointments?.map((member) => member.key)).toEqual(["bia"]);
  });

  it("does not replace a missing roster or unsupported dimensional roster with activity", () => {
    expect(
      analyzeDailyAppointmentTeam(analysis(), { ...options, brokerRoster: null }),
    ).toMatchObject({
      unavailableReason: "missing-roster",
      withAppointments: null,
      withoutAppointments: null,
    });
    for (const filters of [
      { company: "Empresa A" },
      { accountRanking: "A" },
      { channel: 0 as const },
    ])
      expect(analyzeDailyAppointmentTeam(analysis(), { ...options, filters })).toMatchObject({
        unavailableReason: "unsupported-dimensions",
        withAppointments: null,
        withoutAppointments: null,
      });
  });

  it("does not escape the selected month, interval, day selection, week or source coverage", () => {
    const cases: Array<[string, AppointmentFilters]> = [
      ["2026-09-30", {}],
      ["2026-10-05", { periodStart: "2026-10-06", periodEnd: "2026-10-20" }],
      ["2026-10-05", { createdDates: ["2026-10-06"] }],
      ["2026-10-05", { week: 3 }],
      ["2026-10-32", {}],
    ];
    for (const [date, filters] of cases)
      expect(
        analyzeDailyAppointmentTeam(analysis(), {
          ...options,
          date,
          filters,
        }).unavailableReason,
      ).toBe("outside-selected-period");
    expect(
      analyzeDailyAppointmentTeam(analysis({ coverageStart: "2026-10-06" }), options)
        .unavailableReason,
    ).toBe("unavailable-period");
  });

  it("uses the São Paulo creation date and distinguishes confirmed no activity from unavailable", () => {
    const source = analysis({
      appointments: [appointment(roster[0]!.owner, "2026-10-06T01:00:00Z")],
    });
    expect(analyzeDailyAppointmentTeam(source, options).withAppointments?.length).toBe(1);
    const next = analyzeDailyAppointmentTeam(source, { ...options, date: "2026-10-06" });
    expect(next.withAppointments).toEqual([]);
    expect(next.withoutAppointments).toHaveLength(3);
  });

  it("keeps conflicting identities unavailable instead of classifying a guessed broker", () => {
    const ambiguousRoster = [...roster, { ...roster[0]!, key: "another-ana" }];
    expect(
      analyzeDailyAppointmentTeam(analysis(), { ...options, brokerRoster: ambiguousRoster })
        .unavailableReason,
    ).toBe("ambiguous-broker");
  });
});

describe("appointment team presentation", () => {
  it("shortens only visible names and preserves unknown labels", () => {
    expect(appointmentTeamShortName("  Ana   Maria da Silva ")).toBe("Ana Silva");
    expect(appointmentTeamShortName("João")).toBe("João");
    expect(appointmentTeamShortName(null)).toBe("Não informado");
    expect(appointmentTeamShortName("Sem gerente informado")).toBe("Sem gerente informado");
    const result = analyzeDailyAppointmentTeam(analysis(), options);
    const markup = renderToStaticMarkup(
      <ProductiveTeamDetails
        productiveMembers={result.withAppointments}
        unproductiveMembers={result.withoutAppointments}
        unavailableDetail="Indisponível"
        appointmentLabels
        shortNames
      />,
    );
    expect(markup).toContain("Equipe com agendamento");
    expect(markup).toContain("Equipe sem agendamento");
    expect(markup).toContain("Ana Silva");
    expect(markup).not.toContain("Ana Maria Silva");
    expect(markup).not.toContain("Equipe Produtiva");
    expect(result.withAppointments?.find((member) => member.key === "ana")?.owner).toBe(
      "Ana Maria Silva",
    );
  });

  it("does not change labels or full names in existing default callers", () => {
    const result = analyzeDailyAppointmentTeam(analysis(), options);
    const markup = renderToStaticMarkup(
      <ProductiveTeamDetails
        productiveMembers={result.withAppointments}
        unproductiveMembers={result.withoutAppointments}
        unavailableDetail="Indisponível"
      />,
    );
    expect(markup).toContain("Equipe Produtiva");
    expect(markup).toContain("Equipe não Produtiva");
    expect(markup).toContain("Ana Maria Silva");
  });

  it("provides an explicit accessible daily detail control without server-rendering a popup", () => {
    const markup = renderToStaticMarkup(
      <DailyAppointmentsTeamDetails
        analysis={analysis()}
        brokerRoster={roster}
        filters={{ channel: 1 }}
        month="2026-10"
        buckets={[{ key: "2026-10-05", label: "05", total: 4 }]}
      >
        <button data-appointments-day="2026-10-05">05</button>
      </DailyAppointmentsTeamDetails>,
    );
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Ver equipe por dia");
    expect(markup).not.toContain('role="dialog"');
  });
});
