import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentWeekOfMonth,
  type AppointmentBrokerRosterEntry,
  type AppointmentFilters,
  type AppointmentGoalsByMonth,
} from "@/lib/crm/stages/appointments";

export interface AppointmentComparisonSeries {
  key: "selected" | "previous" | "year-average";
  label: string;
  values: (number | null)[];
}

export interface AppointmentComparison {
  month: string;
  days: number[];
  series: [AppointmentComparisonSeries, AppointmentComparisonSeries, AppointmentComparisonSeries];
  description: string;
}

function monthDate(month: string) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/u.test(month)) {
    throw new RangeError("Mês de comparação inválido.");
  }
  return new Date(`${month}-01T12:00:00Z`);
}

function lastDay(month: string) {
  const date = monthDate(month);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

export function buildAppointmentComparison(
  slice: DashboardAnalysisSlice,
  {
    month,
    filters = {},
    brokerRoster = null,
    goalsByMonth = {},
  }: {
    month: string;
    filters?: AppointmentFilters;
    brokerRoster?: AppointmentBrokerRosterEntry[] | null;
    goalsByMonth?: AppointmentGoalsByMonth;
  },
): AppointmentComparison {
  const selectedDate = monthDate(month);
  const previousDate = new Date(selectedDate);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const year = month.slice(0, 4);
  const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const selectedDates = filters.createdDates?.length
    ? new Set(filters.createdDates)
    : filters.createdDate
      ? new Set([filters.createdDate])
      : null;
  const end = lastDay(month);
  const days = allDays.filter((day) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return (
      date <= end &&
      (!selectedDates || selectedDates.has(date)) &&
      (!filters.periodStart || date >= filters.periodStart) &&
      (!filters.periodEnd || date <= filters.periodEnd) &&
      (!filters.week || appointmentWeekOfMonth(date) === filters.week)
    );
  });
  const comparisonFilters = { ...filters };
  // Apply temporal selections to the reference month's axis. Compare those same
  // day numbers across other months without carrying reference dates into them.
  delete comparisonFilters.createdDate;
  delete comparisonFilters.createdDates;
  delete comparisonFilters.week;
  delete comparisonFilters.periodStart;
  delete comparisonFilters.periodEnd;

  const cache = new Map<string, (number | null)[]>();
  const valuesForMonth = (requestedMonth: string): (number | null)[] => {
    const cached = cache.get(requestedMonth);
    if (cached) return cached;
    if (requestedMonth.startsWith("0000-")) {
      const unavailable = allDays.map(() => null);
      cache.set(requestedMonth, unavailable);
      return unavailable;
    }
    const end = lastDay(requestedMonth);
    const hasCoverage = `${requestedMonth}-01` <= slice.referenceDate && end >= slice.coverageStart;
    const totals = hasCoverage
      ? new Map(
          analyzeAppointments(slice, {
            month: requestedMonth,
            year,
            filters: comparisonFilters,
            brokerRoster,
            goalsByMonth,
          }).daily.map((bucket) => [bucket.key, bucket.total]),
        )
      : new Map<string, number>();
    const values = allDays.map((day) => {
      const date = `${requestedMonth}-${String(day).padStart(2, "0")}`;
      return !hasCoverage || date > end || date < slice.coverageStart || date > slice.referenceDate
        ? null
        : (totals.get(date) ?? 0);
    });
    cache.set(requestedMonth, values);
    return values;
  };

  const yearMonths = Array.from({ length: 12 }, (_, index) =>
    valuesForMonth(`${year}-${String(index + 1).padStart(2, "0")}`),
  );
  const average = allDays.map((_, index) => {
    const covered = yearMonths
      .map((values) => values[index])
      .filter((value): value is number => typeof value === "number");
    return covered.length
      ? Math.ceil(covered.reduce((sum, value) => sum + value, 0) / covered.length)
      : null;
  });
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    month,
    days,
    series: [
      {
        key: "selected",
        label: `Mês de referência · ${monthLabel.format(selectedDate)}`,
        values: days.map((day) => valuesForMonth(month)[day - 1]!),
      },
      {
        key: "previous",
        label: `Mês anterior · ${monthLabel.format(previousDate)}`,
        values: days.map((day) => valuesForMonth(previousMonth)[day - 1]!),
      },
      {
        key: "year-average",
        label: `Média de ${year}`,
        values: days.map((day) => average[day - 1]!),
      },
    ],
    description:
      `Dias válidos do mês de referência e filtros de período e equipe mantidos. ` +
      `Comparação dos mesmos números de dia; média de ${year} entre datas cobertas.`,
  };
}
