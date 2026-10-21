import type {
  DashboardAnalysisSlice,
  DashboardAppointmentDetail,
} from "../dashboard/analysis-contract";

export interface AppointmentBucket {
  key: string;
  label: string;
  total: number;
}
export interface AppointmentFilters {
  createdDate?: string;
  week?: number;
  channel?: 0 | 1;
  regionalManager?: string;
  manager?: string;
  owner?: string;
  company?: string;
  accountRanking?: string;
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

export const saoPauloDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const previousDate = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

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

export function appointmentMonthlyGoal(individualGoal: number | null, brokerCount: number | null) {
  if (individualGoal === null || brokerCount === null) return null;
  return individualGoal * brokerCount;
}

export function plannedAppointmentsForDate(referenceDate: string, brokerCount: number | null) {
  if (brokerCount === null) return null;
  const weekday = new Date(`${referenceDate}T12:00:00Z`).getUTCDay();
  if (weekday === 4) return brokerCount * 2;
  if ([1, 2, 3, 5].includes(weekday)) return brokerCount;
  return 0;
}

const add = (map: Map<string, number>, key: string, count = 1) =>
  map.set(key, (map.get(key) ?? 0) + count);
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

export function analyzeAppointments(
  slice: DashboardAnalysisSlice,
  {
    month = slice.referenceDate.slice(0, 7),
    year = slice.referenceDate.slice(0, 4),
    filters = {},
  }: { month?: string; year?: string; filters?: AppointmentFilters } = {},
) {
  const daily = new Map<string, number>(),
    weekly = new Map<string, number>(),
    monthly = new Map<string, number>();
  const managers = new Map<string, number>(),
    owners = new Map<string, number>();
  const regionalManagers = new Map<string, number>(),
    accountRankings = new Map<string, number>();
  const stores = new Map<string, number>(),
    developments = new Map<string, number>();
  const previousReferenceDate = previousDate(slice.referenceDate);
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const end = monthEnd.toISOString().slice(0, 10);
  const coverage =
    end < slice.coverageStart || `${month}-01` > slice.referenceDate
      ? ("unavailable" as const)
      : `${month}-01` < slice.coverageStart || end > slice.referenceDate
        ? ("partial" as const)
        : ("complete" as const);

  const matchesFilters = (appointment: DashboardAppointmentDetail) => {
    const date = saoPauloDate(appointment.createdAt);
    return (
      (!filters.createdDate || date === filters.createdDate) &&
      (!filters.week || appointmentWeekOfMonth(date) === filters.week) &&
      (filters.channel === undefined ||
        ("channel" in appointment && appointment.channel === filters.channel)) &&
      (!filters.regionalManager || appointment.regionalManager === filters.regionalManager) &&
      (!filters.manager || appointment.salesManager === filters.manager) &&
      (!filters.owner || appointment.owner === filters.owner) &&
      (!filters.company || ("company" in appointment && appointment.company === filters.company)) &&
      (!filters.accountRanking || appointment.accountRanking === filters.accountRanking)
    );
  };
  const matchesSharedFactFilters = (fact: DashboardAnalysisSlice["facts"][number]) =>
    (filters.channel === undefined || fact[5] === filters.channel) &&
    (!filters.manager || slice.dimensions.managers[fact[2]] === filters.manager) &&
    (!filters.owner || slice.dimensions.owners[fact[3]] === filters.owner) &&
    (!filters.company || slice.dimensions.companies[fact[4]] === filters.company);
  const sharedFacts = slice.facts.filter(matchesSharedFactFilters);
  const filteredOperations: DashboardAppointmentDetail[] | null =
    slice.version >= 3 ? (slice.appointments ?? []).filter(matchesFilters) : null;
  const details =
    filteredOperations === null
      ? null
      : filteredOperations
          .filter((appointment) => saoPauloDate(appointment.createdAt).slice(0, 7) === month)
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  let total = 0,
    today = 0,
    yesterday = 0;
  const funnel = { opportunities: 0, appointments: 0, visits: 0, sales: 0 };
  if (slice.version === 4) {
    for (const fact of sharedFacts) {
      if (fact[1].slice(0, 7) !== month) continue;
      if (fact[0] === 0) funnel.opportunities += fact[7];
      if (fact[0] === 1) funnel.appointments += fact[7];
      if (fact[0] === 2) funnel.visits += fact[7];
      if (fact[0] === 4) funnel.sales += fact[7];
    }
  }

  if (filteredOperations !== null) {
    for (const appointment of filteredOperations) {
      const date = saoPauloDate(appointment.createdAt);
      if (date < slice.coverageStart || date > slice.referenceDate) continue;
      if (date.slice(0, 4) === year) add(monthly, date.slice(5, 7));
      if (date === slice.referenceDate) today += 1;
      if (date === previousReferenceDate) yesterday += 1;
      if (date.slice(0, 7) !== month) continue;
      total += 1;
      add(daily, date);
      add(weekly, String(appointmentWeekOfMonth(date)));
      add(managers, appointment.salesManager || "Gerente não informado");
      add(owners, appointment.owner || "Responsável não informado");
      add(regionalManagers, appointment.regionalManager || "Gerente regional não informado");
      add(accountRankings, appointment.accountRanking || "Ranking não informado");
    }
  } else {
    for (const fact of sharedFacts) {
      if (fact[0] !== 1) continue;
      const date = fact[1];
      if (date < slice.coverageStart || date > slice.referenceDate) continue;
      if (date.slice(0, 4) === year) add(monthly, date.slice(5, 7), fact[7]);
      if (date === slice.referenceDate) today += fact[7];
      if (date === previousReferenceDate) yesterday += fact[7];
      if (date.slice(0, 7) !== month) continue;
      total += fact[7];
      add(daily, date, fact[7]);
      add(weekly, String(appointmentWeekOfMonth(date)), fact[7]);
      add(managers, slice.dimensions.managers[fact[2]] ?? "Gerente não informado", fact[7]);
      add(owners, slice.dimensions.owners[fact[3]] ?? "Responsável não informado", fact[7]);
      add(
        stores,
        slice.version === 2
          ? (slice.dimensions.stores?.[fact[10] ?? -1] ?? "Loja não informada")
          : (slice.dimensions.developments[fact[6]] ?? "Loja não informada"),
        fact[7],
      );
      if (slice.version === 2)
        add(
          developments,
          slice.dimensions.developments[fact[6]] ?? "Empreendimento não informado",
          fact[7],
        );
    }
  }
  const monthStart = `${month}-01`;
  const coveredStart = monthStart < slice.coverageStart ? slice.coverageStart : monthStart;
  const coveredEnd = end > slice.referenceDate ? slice.referenceDate : end;
  const coveredDays =
    coveredStart > coveredEnd
      ? 0
      : Math.floor(
          (Date.parse(`${coveredEnd}T12:00:00Z`) - Date.parse(`${coveredStart}T12:00:00Z`)) /
            86_400_000,
        ) + 1;
  const productiveOwners =
    slice.version === 4 && filteredOperations !== null
      ? new Set(
          filteredOperations
            .filter(
              (appointment) =>
                saoPauloDate(appointment.createdAt).slice(0, 7) === month &&
                "registeredBroker" in appointment &&
                appointment.registeredBroker,
            )
            .map((appointment) => appointment.owner)
            .filter(Boolean),
        ).size
      : null;
  const productivePercent =
    productiveOwners === null || slice.brokerCount === undefined
      ? null
      : slice.brokerCount === 0
        ? 0
        : (productiveOwners / slice.brokerCount) * 100;
  const filterOptions = {
    channels: [
      { key: 1 as const, label: "House" },
      { key: 0 as const, label: "Imob" },
    ].filter(({ key }) => slice.facts.some((fact) => fact[5] === key)),
    managers: slice.dimensions.managers,
    owners: slice.dimensions.owners,
    companies: slice.dimensions.companies,
  };

  return {
    total,
    today,
    yesterday,
    dailyAverage: coveredDays > 0 ? total / coveredDays : null,
    brokerCount: slice.version >= 3 ? (slice.brokerCount ?? null) : null,
    plannedToday: plannedAppointmentsForDate(
      slice.referenceDate,
      slice.version >= 3 ? (slice.brokerCount ?? null) : null,
    ),
    performedToday: filteredOperations === null ? null : today,
    filterOptions,
    productiveBrokers: productiveOwners,
    productivePercent,
    registeredManagerCount: slice.version === 4 ? (slice.brokerManagerCount ?? null) : null,
    funnel: slice.version === 4 ? funnel : null,
    visitsPerformed: slice.version === 4 ? funnel.visits : null,
    sales: slice.version === 4 ? funnel.sales : null,
    details,
    regionalManagers: filteredOperations === null ? null : ranking(regionalManagers),
    accountRankings: filteredOperations === null ? null : ranking(accountRankings),
    coverage,
    daily: chronological(daily, (date) => date.slice(8, 10)),
    weekly: chronological(weekly, (week) => `${week}ª semana`),
    monthly: chronological(monthly, (key) => APPOINTMENT_MONTHS[Number(key) - 1]!),
    managers: ranking(managers),
    owners: ranking(owners),
    stores: ranking(stores),
    developments: slice.version === 2 ? ranking(developments) : null,
  };
}
