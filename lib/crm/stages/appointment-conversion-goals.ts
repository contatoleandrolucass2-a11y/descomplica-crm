import {
  appointmentWeekOfMonth,
  normalizeAppointmentCreatedDates,
  type AppointmentFilters,
} from "./appointments";
import type { AppointmentConversionGoals, AppointmentConversionGoalsByMonth } from "./data";

type ConversionGoal = NonNullable<AppointmentConversionGoals["dv"]>;
export type AppointmentExpectedFunnel = ConversionGoal["monthlyFunnel"];
export type AppointmentPeriodConversionGoals = Omit<ConversionGoal, "monthlyFunnel">;

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Compose only the policies effective on the covered, selected calendar days. */
export function resolveAppointmentConversionPeriod({
  month,
  coverageStart,
  referenceDate,
  filters = {},
  goalsByMonth,
  profile,
}: {
  month: string;
  coverageStart: string;
  referenceDate: string;
  filters?: AppointmentFilters;
  goalsByMonth: AppointmentConversionGoalsByMonth;
  profile: keyof AppointmentConversionGoals | null;
}): {
  funnelPerParticipant: AppointmentExpectedFunnel;
  conversionGoals: AppointmentPeriodConversionGoals;
} | null {
  if (!profile || !validDate(`${month}-01`)) return null;
  const hasExplicitPeriod = filters.periodStart !== undefined || filters.periodEnd !== undefined;
  if (
    (filters.periodStart && !validDate(filters.periodStart)) ||
    (filters.periodEnd && !validDate(filters.periodEnd)) ||
    (filters.periodStart && filters.periodEnd && filters.periodStart > filters.periodEnd)
  )
    return null;
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const requestedStart = hasExplicitPeriod ? filters.periodStart || coverageStart : `${month}-01`;
  const requestedEnd = hasExplicitPeriod
    ? filters.periodEnd || referenceDate
    : monthEnd.toISOString().slice(0, 10);
  const start = requestedStart < coverageStart ? coverageStart : requestedStart;
  const end = requestedEnd > referenceDate ? referenceDate : requestedEnd;
  if (start > end) return null;

  const selectedDates = new Set(
    normalizeAppointmentCreatedDates(
      filters.createdDates?.length
        ? filters.createdDates
        : filters.createdDate
          ? [filters.createdDate]
          : undefined,
      coverageStart,
      referenceDate,
    ),
  );
  const selectedDaysByMonth = new Map<string, number>();
  for (
    const cursor = new Date(`${start}T12:00:00Z`);
    cursor.toISOString().slice(0, 10) <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const day = cursor.toISOString().slice(0, 10);
    if (
      (selectedDates.size > 0 && !selectedDates.has(day)) ||
      (filters.week && appointmentWeekOfMonth(day) !== filters.week)
    )
      continue;
    const selectedMonth = day.slice(0, 7);
    selectedDaysByMonth.set(selectedMonth, (selectedDaysByMonth.get(selectedMonth) ?? 0) + 1);
  }
  if (selectedDaysByMonth.size === 0) return null;

  const funnelPerParticipant: AppointmentExpectedFunnel = {
    opportunities: 0,
    appointments: 0,
    visits: 0,
    folders: 0,
    approvedFolders: 0,
    sales: 0,
  };
  for (const [selectedMonth, days] of selectedDaysByMonth) {
    // The map comes from the permission-checked RPC. A missing month/profile is
    // unknown; today's policy must never substitute for a historical policy.
    const goal = goalsByMonth[selectedMonth]?.[profile];
    if (!goal) return null;
    const lastDay = new Date(`${selectedMonth}-01T12:00:00Z`);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
    const fraction = days / lastDay.getUTCDate();
    for (const key of Object.keys(funnelPerParticipant) as (keyof AppointmentExpectedFunnel)[])
      funnelPerParticipant[key] += goal.monthlyFunnel[key] * fraction;
  }
  const ratio = (source: number, target: number) =>
    source > 0 && target > 0 ? source / target : null;
  return {
    funnelPerParticipant,
    conversionGoals: {
      opportunityAppointment: ratio(
        funnelPerParticipant.opportunities,
        funnelPerParticipant.appointments,
      ),
      appointmentVisit: ratio(funnelPerParticipant.appointments, funnelPerParticipant.visits),
      appointmentFolder: ratio(funnelPerParticipant.appointments, funnelPerParticipant.folders),
      appointmentApprovedFolder: ratio(
        funnelPerParticipant.appointments,
        funnelPerParticipant.approvedFolders,
      ),
      appointmentSale: ratio(funnelPerParticipant.appointments, funnelPerParticipant.sales),
    },
  };
}
