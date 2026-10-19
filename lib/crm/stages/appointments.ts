import type { DashboardAnalysisSlice } from "../dashboard/analysis-contract";

export interface AppointmentBucket {
  key: string;
  label: string;
  total: number;
}

export const APPOINTMENT_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export function appointmentWeekOfMonth(date: string): number {
  const firstWeekday = new Date(`${date.slice(0, 7)}-01T12:00:00Z`).getUTCDay();
  return Math.floor((Number(date.slice(8, 10)) - 1 + ((firstWeekday + 6) % 7)) / 7) + 1;
}

export function appointmentYears(slice: DashboardAnalysisSlice): string[] {
  const years: string[] = [];
  for (
    let year = Number(slice.referenceDate.slice(0, 4));
    year >= Number(slice.coverageStart.slice(0, 4));
    year--
  )
    years.push(String(year));
  return years;
}

export function analyzeAppointments(
  slice: DashboardAnalysisSlice,
  { month = slice.referenceDate.slice(0, 7), year = slice.referenceDate.slice(0, 4) } = {},
) {
  const daily = new Map<string, number>();
  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();
  const managers = new Map<string, number>();
  const owners = new Map<string, number>();
  const stores = new Map<string, number>();
  const developments = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, count: number) =>
    map.set(key, (map.get(key) ?? 0) + count);
  let total = 0;
  for (const fact of slice.facts) {
    if (fact[0] !== 1) continue;
    const date = fact[1];
    if (date < slice.coverageStart || date > slice.referenceDate) continue;
    // The annual chart intentionally ignores the selected month.
    if (date.slice(0, 4) === year) add(monthly, date.slice(5, 7), fact[7]);
    if (date.slice(0, 7) !== month) continue;
    const count = fact[7];
    total += count;
    add(daily, date, count);
    add(weekly, String(appointmentWeekOfMonth(date)), count);
    add(managers, slice.dimensions.managers[fact[2]] ?? "Gerente não informado", count);
    add(owners, slice.dimensions.owners[fact[3]] ?? "Responsável não informado", count);
    // Legacy appointment dimension 6 contains PDV, never the development name.
    add(
      stores,
      slice.version === 2
        ? (slice.dimensions.stores?.[fact[10] ?? -1] ?? "Loja não informada")
        : (slice.dimensions.developments[fact[6]] ?? "Loja não informada"),
      count,
    );
    if (slice.version === 2)
      add(
        developments,
        slice.dimensions.developments[fact[6]] ?? "Empreendimento não informado",
        count,
      );
  }
  const chronological = (
    map: Map<string, number>,
    label: (key: string) => string,
  ): AppointmentBucket[] =>
    [...map]
      .filter(([, total]) => total > 0)
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
      .map(([key, total]) => ({ key, label: label(key), total }));
  const ranking = (map: Map<string, number>): AppointmentBucket[] =>
    [...map]
      .filter(([, total]) => total > 0)
      .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "pt-BR"))
      .map(([label, total]) => ({ key: label, label, total }));
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const end = monthEnd.toISOString().slice(0, 10);
  const coverage =
    end < slice.coverageStart || `${month}-01` > slice.referenceDate
      ? ("unavailable" as const)
      : `${month}-01` < slice.coverageStart || end > slice.referenceDate
        ? ("partial" as const)
        : ("complete" as const);
  return {
    total,
    coverage,
    daily: chronological(daily, (date) => date.slice(8, 10)),
    weekly: chronological(weekly, (week) => `${week}ª semana`),
    monthly: chronological(monthly, (month) => APPOINTMENT_MONTHS[Number(month) - 1]!),
    managers: ranking(managers),
    owners: ranking(owners),
    stores: ranking(stores),
    developments: slice.version === 2 ? ranking(developments) : null,
  };
}
