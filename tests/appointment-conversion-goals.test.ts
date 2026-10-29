import { describe, expect, it } from "vitest";

import { resolveAppointmentConversionPeriod } from "@/lib/crm/stages/appointment-conversion-goals";
import type {
  AppointmentConversionGoals,
  AppointmentConversionGoalsByMonth,
} from "@/lib/crm/stages/data";

const september: NonNullable<AppointmentConversionGoals["dv"]> = {
  opportunityAppointment: 5,
  appointmentVisit: 2,
  appointmentFolder: 4,
  appointmentApprovedFolder: 10,
  appointmentSale: 20,
  monthlyFunnel: {
    opportunities: 300,
    appointments: 60,
    visits: 30,
    folders: 15,
    approvedFolders: 6,
    sales: 3,
  },
};
const october: NonNullable<AppointmentConversionGoals["dv"]> = {
  opportunityAppointment: 10,
  appointmentVisit: 2,
  appointmentFolder: 2,
  appointmentApprovedFolder: 2,
  appointmentSale: 2,
  monthlyFunnel: {
    opportunities: 620,
    appointments: 62,
    visits: 31,
    folders: 31,
    approvedFolders: 31,
    sales: 31,
  },
};
const goalsByMonth: AppointmentConversionGoalsByMonth = {
  "2026-09": { dv: september, partnerships: october },
  "2026-10": { dv: october, partnerships: september },
};
const options = {
  month: "2026-09",
  coverageStart: "2026-09-01",
  referenceDate: "2026-10-19",
  profile: "dv" as const,
  goalsByMonth,
};

describe("appointment period conversion goals", () => {
  it("uses September's effective policy for September and October's for October", () => {
    expect(resolveAppointmentConversionPeriod(options)).toEqual({
      funnelPerParticipant: september.monthlyFunnel,
      conversionGoals: {
        opportunityAppointment: 5,
        appointmentVisit: 2,
        appointmentFolder: 4,
        appointmentApprovedFolder: 10,
        appointmentSale: 20,
      },
    });
    const actual = resolveAppointmentConversionPeriod({ ...options, month: "2026-10" });
    expect(actual?.funnelPerParticipant.appointments).toBeCloseTo(38);
    expect(actual?.conversionGoals.opportunityAppointment).toBeCloseTo(10);
  });

  it("composes a range across policies by selected days and derives ratios from the sum", () => {
    const actual = resolveAppointmentConversionPeriod({
      ...options,
      filters: { periodStart: "2026-09-28", periodEnd: "2026-10-03" },
    });
    expect(actual?.funnelPerParticipant).toEqual({
      opportunities: 90,
      appointments: 12,
      visits: 6,
      folders: 4.5,
      approvedFolders: 3.6,
      sales: 3.3,
    });
    expect(actual?.conversionGoals.opportunityAppointment).toBeCloseTo(7.5);
    expect(actual?.conversionGoals.appointmentVisit).toBeCloseTo(2);
    expect(actual?.conversionGoals.appointmentFolder).toBeCloseTo(12 / 4.5);
    expect(actual?.conversionGoals.appointmentApprovedFolder).toBeCloseTo(12 / 3.6);
    expect(actual?.conversionGoals.appointmentSale).toBeCloseTo(12 / 3.3);
  });

  it("uses only distinct selected days inside the range, coverage and selected week", () => {
    const actual = resolveAppointmentConversionPeriod({
      ...options,
      filters: {
        periodStart: "2026-09-28",
        periodEnd: "2026-10-31",
        createdDates: [
          "2026-09-30",
          "2026-10-01",
          "2026-10-01",
          "2026-10-02",
          "2026-10-05",
          "2026-10-20",
          "2026-10-32",
        ],
        week: 1,
      },
    });
    expect(actual?.funnelPerParticipant.opportunities).toBe(40);
    expect(actual?.funnelPerParticipant.appointments).toBe(4);
    expect(actual?.conversionGoals.opportunityAppointment).toBe(10);
  });

  it("supports a single selected day and clips partial source coverage", () => {
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        month: "2026-10",
        filters: { createdDate: "2026-10-02" },
      })?.funnelPerParticipant.opportunities,
    ).toBe(20);
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        coverageStart: "2026-09-16",
      })?.funnelPerParticipant.opportunities,
    ).toBe(150);
  });

  it("selects Imob independently from House", () => {
    expect(
      resolveAppointmentConversionPeriod({ ...options, profile: "partnerships" })?.conversionGoals
        .opportunityAppointment,
    ).toBe(10);
  });

  it("requires only the policies of months with selected days", () => {
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        goalsByMonth: { "2026-10": goalsByMonth["2026-10"]! },
        filters: {
          periodStart: "2026-09-28",
          periodEnd: "2026-10-03",
          createdDates: ["2026-10-02"],
        },
      })?.conversionGoals.opportunityAppointment,
    ).toBe(10);
  });

  it.each([undefined, null, { dv: null, partnerships: september }])(
    "marks a mixed period unavailable if any relevant month/profile is absent: %s",
    (missing) => {
      expect(
        resolveAppointmentConversionPeriod({
          ...options,
          goalsByMonth: { ...goalsByMonth, "2026-09": missing ?? null },
          filters: { periodStart: "2026-09-28", periodEnd: "2026-10-03" },
        }),
      ).toBeNull();
    },
  );

  it("does not fabricate a policy for a mixed channel, invalid range or uncovered day", () => {
    expect(resolveAppointmentConversionPeriod({ ...options, profile: null })).toBeNull();
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        filters: { periodStart: "2026-10-03", periodEnd: "2026-09-28" },
      }),
    ).toBeNull();
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        filters: { periodStart: "2026-09-31" },
      }),
    ).toBeNull();
    expect(resolveAppointmentConversionPeriod({ ...options, month: "2026-11" })).toBeNull();
  });

  it("preserves known zero funnels without inventing ratios", () => {
    const zero = {
      opportunities: 0,
      appointments: 0,
      visits: 0,
      folders: 0,
      approvedFolders: 0,
      sales: 0,
    };
    expect(
      resolveAppointmentConversionPeriod({
        ...options,
        goalsByMonth: {
          "2026-09": { dv: { ...september, monthlyFunnel: zero }, partnerships: null },
        },
      }),
    ).toEqual({
      funnelPerParticipant: zero,
      conversionGoals: {
        opportunityAppointment: null,
        appointmentVisit: null,
        appointmentFolder: null,
        appointmentApprovedFolder: null,
        appointmentSale: null,
      },
    });
  });
});
