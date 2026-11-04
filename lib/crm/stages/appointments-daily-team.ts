import type { DashboardAnalysisSlice } from "../dashboard/analysis-contract";
import {
  appointmentWeekOfMonth,
  type AppointmentBrokerRosterEntry,
  type AppointmentFilters,
} from "./appointments";
import {
  analyzeProductiveTeam,
  type ProductiveTeamMember,
  type ProductiveTeamUnavailableReason,
} from "./productive-team";

export interface DailyAppointmentTeam {
  date: string;
  withAppointments: ProductiveTeamMember[] | null;
  withoutAppointments: ProductiveTeamMember[] | null;
  unavailableReason: ProductiveTeamUnavailableReason | "outside-selected-period" | null;
}

/** Presentation only: keep the full name and official key for reconciliation. */
export function appointmentTeamShortName(value: string | null) {
  if (!value?.trim()) return "Não informado";
  if (/não informad|sem responsável|sem gerente/iu.test(value)) return value;
  const parts = value.trim().split(/\s+/u);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)}` : parts[0]!;
}

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Reuse the authorized, roster-based partition; activity never invents a roster. */
export function analyzeDailyAppointmentTeam(
  slice: DashboardAnalysisSlice,
  {
    date,
    month,
    filters = {},
    brokerRoster = null,
  }: {
    date: string;
    month: string;
    filters?: AppointmentFilters;
    brokerRoster?: AppointmentBrokerRosterEntry[] | null;
  },
): DailyAppointmentTeam {
  const unavailable = (
    unavailableReason: NonNullable<DailyAppointmentTeam["unavailableReason"]>,
  ): DailyAppointmentTeam => ({
    date,
    withAppointments: null,
    withoutAppointments: null,
    unavailableReason,
  });
  const selectedDates = filters.createdDates?.length
    ? filters.createdDates
    : filters.createdDate
      ? [filters.createdDate]
      : null;
  const explicitPeriod = filters.periodStart !== undefined || filters.periodEnd !== undefined;
  if (
    !validDate(date) ||
    (!explicitPeriod && date.slice(0, 7) !== month) ||
    (filters.periodStart && (!validDate(filters.periodStart) || date < filters.periodStart)) ||
    (filters.periodEnd && (!validDate(filters.periodEnd) || date > filters.periodEnd)) ||
    (selectedDates !== null && !selectedDates.includes(date)) ||
    (filters.week && appointmentWeekOfMonth(date) !== filters.week)
  )
    return unavailable("outside-selected-period");
  if (date < slice.coverageStart || date > slice.referenceDate)
    return unavailable("unavailable-period");
  if (brokerRoster === null) return unavailable("missing-roster");
  const result = analyzeProductiveTeam(slice, {
    month,
    filters: {
      ...filters,
      periodStart: date,
      periodEnd: date,
      createdDate: date,
      createdDates: [date],
    },
    brokerRoster,
    availableStages: ["appointments"],
  }).cards[0]!;
  if (result.unavailableReason !== null) return unavailable(result.unavailableReason);
  if (result.productiveMembers === null || result.unproductiveMembers === null)
    return unavailable("inconsistent-roster");
  return {
    date,
    withAppointments: result.productiveMembers,
    withoutAppointments: result.unproductiveMembers,
    unavailableReason: null,
  };
}
