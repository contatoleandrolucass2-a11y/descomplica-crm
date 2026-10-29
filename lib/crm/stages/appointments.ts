import type {
  DashboardAnalysisSlice,
  DashboardAppointmentDetail,
} from "../dashboard/analysis-contract";

export interface AppointmentBucket {
  key: string;
  label: string;
  total: number;
}
export interface AppointmentGoalBucket extends AppointmentBucket {
  goal: number | null;
}

/** House projected individual monthly targets, resolved by the authorized RPC per month. */
export type AppointmentGoalsByMonth = Record<string, number | null>;
export interface AppointmentConversionBucket extends AppointmentBucket {
  appointments: number;
  visits: number;
  percent: number;
  ratio: number;
}
export interface AppointmentFilters {
  createdDate?: string;
  createdDates?: string[];
  periodStart?: string;
  periodEnd?: string;
  week?: number;
  channel?: 0 | 1;
  regionalManager?: string;
  manager?: string;
  owner?: string;
  company?: string;
  accountRanking?: string;
}

export interface AppointmentBrokerRecency {
  owner: string;
  manager: string;
  lastAppointmentDate: string;
  daysSinceLastAppointment: number;
}

export interface AppointmentBrokerRecencyBuckets {
  upTo7Days: AppointmentBrokerRecency[];
  from8To14Days: AppointmentBrokerRecency[];
  from15Days: AppointmentBrokerRecency[];
}

export type AppointmentDetailRow = DashboardAppointmentDetail & {
  daysSinceAppointment: number;
};

export interface AppointmentBrokerRosterEntry {
  key: string;
  owner: string;
  manager: string;
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

const validCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function normalizeAppointmentCreatedDates(
  values: readonly string[] | undefined,
  coverageStart: string,
  referenceDate: string,
): string[] {
  return [...new Set(values ?? [])]
    .filter((value) => validCalendarDate(value) && value >= coverageStart && value <= referenceDate)
    .sort();
}

const calendarDaysBetween = (start: string, end: string) =>
  Math.floor((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);

const appointmentIdentity = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

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
    brokerRoster = null,
    goalsByMonth = {},
  }: {
    month?: string;
    year?: string;
    filters?: AppointmentFilters;
    brokerRoster?: AppointmentBrokerRosterEntry[] | null;
    goalsByMonth?: AppointmentGoalsByMonth;
  } = {},
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
  const monthStart = `${month}-01`;
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const end = monthEnd.toISOString().slice(0, 10);
  const hasExplicitPeriod = filters.periodStart !== undefined || filters.periodEnd !== undefined;
  const periodStart =
    filters.periodStart && validCalendarDate(filters.periodStart) ? filters.periodStart : null;
  const periodEnd =
    filters.periodEnd && validCalendarDate(filters.periodEnd) ? filters.periodEnd : null;
  const validExplicitPeriod =
    (!filters.periodStart || periodStart !== null) &&
    (!filters.periodEnd || periodEnd !== null) &&
    (!periodStart || !periodEnd || periodStart <= periodEnd);
  const requestedStart = hasExplicitPeriod ? (periodStart ?? slice.coverageStart) : monthStart;
  const requestedEnd = hasExplicitPeriod ? (periodEnd ?? slice.referenceDate) : end;
  const coverage =
    !validExplicitPeriod ||
    requestedEnd < slice.coverageStart ||
    requestedStart > slice.referenceDate
      ? ("unavailable" as const)
      : requestedStart < slice.coverageStart || requestedEnd > slice.referenceDate
        ? ("partial" as const)
        : ("complete" as const);

  const selectedDates = normalizeAppointmentCreatedDates(
    filters.createdDates?.length
      ? filters.createdDates
      : filters.createdDate
        ? [filters.createdDate]
        : undefined,
    slice.coverageStart,
    slice.referenceDate,
  );
  const selectedDateSet = new Set(selectedDates);
  const matchesExplicitPeriod = (date: string) =>
    !hasExplicitPeriod ||
    (validExplicitPeriod &&
      (!periodStart || date >= periodStart) &&
      (!periodEnd || date <= periodEnd));
  const matchesSelectedPeriod = (date: string) =>
    matchesExplicitPeriod(date) &&
    (selectedDateSet.size === 0 || selectedDateSet.has(date)) &&
    (!filters.week || appointmentWeekOfMonth(date) === filters.week);
  const matchesReportingPeriod = (date: string) =>
    hasExplicitPeriod ? matchesExplicitPeriod(date) : date.slice(0, 7) === month;

  const coveredStart = requestedStart < slice.coverageStart ? slice.coverageStart : requestedStart;
  const coveredEnd = requestedEnd > slice.referenceDate ? slice.referenceDate : requestedEnd;
  const periodReferenceDate = selectedDates.filter(matchesExplicitPeriod).at(-1) ?? coveredEnd;
  // Facts retain a civil date but not the regional manager. Resolve only from
  // observations at or before that date; conflicting names on a day are unknown.
  const regionalHistory = new Map<string, Map<string, Set<string>>>();
  for (const appointment of slice.appointments ?? []) {
    const manager = appointmentIdentity(appointment.salesManager);
    const regionalManager = appointment.regionalManager.trim();
    if (!manager || !regionalManager) continue;
    const date = saoPauloDate(appointment.createdAt);
    const history = regionalHistory.get(manager) ?? new Map<string, Set<string>>();
    const names = history.get(date) ?? new Set<string>();
    names.add(regionalManager);
    history.set(date, names);
    regionalHistory.set(manager, history);
  }
  const regionalTimeline = new Map(
    [...regionalHistory].map(([manager, history]) => [
      manager,
      [...history]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, names]) => ({ date, name: names.size === 1 ? [...names][0]! : null })),
    ]),
  );
  const regionForManager = (manager: string, date: string): string | null => {
    const history = regionalTimeline.get(appointmentIdentity(manager));
    if (!history) return null;
    let low = 0;
    let high = history.length - 1;
    let found: string | null = null;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const observation = history[middle]!;
      if (observation.date <= date) {
        found = observation.name;
        low = middle + 1;
      } else high = middle - 1;
    }
    return found;
  };
  const matchesAppointmentDimensions = (appointment: DashboardAppointmentDetail) =>
    (filters.channel === undefined ||
      ("channel" in appointment && appointment.channel === filters.channel)) &&
    (!filters.regionalManager || appointment.regionalManager.trim() === filters.regionalManager) &&
    (!filters.manager || appointment.salesManager === filters.manager) &&
    (!filters.owner || appointment.owner === filters.owner) &&
    (!filters.company || ("company" in appointment && appointment.company === filters.company)) &&
    (!filters.accountRanking || appointment.accountRanking === filters.accountRanking);

  const matchesFilters = (appointment: DashboardAppointmentDetail) => {
    const date = saoPauloDate(appointment.createdAt);
    return matchesSelectedPeriod(date) && matchesAppointmentDimensions(appointment);
  };
  const matchesFactDimensions = (fact: DashboardAnalysisSlice["facts"][number]) =>
    (filters.channel === undefined || fact[5] === filters.channel) &&
    (!filters.regionalManager ||
      regionForManager(slice.dimensions.managers[fact[2]] ?? "", fact[1]) ===
        filters.regionalManager) &&
    (!filters.manager || slice.dimensions.managers[fact[2]] === filters.manager) &&
    (!filters.owner || slice.dimensions.owners[fact[3]] === filters.owner) &&
    (!filters.company || slice.dimensions.companies[fact[4]] === filters.company);
  const dimensionFacts = slice.facts.filter(matchesFactDimensions);
  const sharedFacts = dimensionFacts.filter((fact) => matchesSelectedPeriod(fact[1]));
  // Aggregated stage facts have no account-ranking dimension. Do not combine
  // their unfiltered conversions with ranking-filtered appointment details.
  const regionalFactsAvailable = !slice.facts.some(
    (fact) =>
      matchesSelectedPeriod(fact[1]) &&
      matchesReportingPeriod(fact[1]) &&
      (filters.channel === undefined || fact[5] === filters.channel) &&
      (!filters.manager || slice.dimensions.managers[fact[2]] === filters.manager) &&
      (!filters.owner || slice.dimensions.owners[fact[3]] === filters.owner) &&
      (!filters.company || slice.dimensions.companies[fact[4]] === filters.company) &&
      regionForManager(slice.dimensions.managers[fact[2]] ?? "", fact[1]) === null,
  );
  const conversionAvailable =
    !filters.accountRanking && (!filters.regionalManager || regionalFactsAvailable);
  const dimensionFilteredOperations: DashboardAppointmentDetail[] | null =
    slice.version >= 3 ? (slice.appointments ?? []).filter(matchesAppointmentDimensions) : null;
  const filteredOperations: DashboardAppointmentDetail[] | null =
    dimensionFilteredOperations === null
      ? null
      : dimensionFilteredOperations.filter(matchesFilters);
  const hasMappableRosterFilter =
    Boolean(filters.regionalManager) || Boolean(filters.manager) || Boolean(filters.owner);
  // The registered roster contains owner/manager, not company, ranking or Imob
  // membership. Activity must never stand in for an unavailable denominator.
  const houseOnly =
    slice.viewKey !== "with_canal_imob" &&
    (filters.channel === 1 ||
      (filters.channel === undefined && slice.viewKey === "without_canal_imob"));
  const unknownRosterRegion =
    Boolean(filters.regionalManager) &&
    (brokerRoster === null ||
      brokerRoster.some(
        (broker) =>
          (!filters.manager ||
            appointmentIdentity(broker.manager) === appointmentIdentity(filters.manager)) &&
          (!filters.owner ||
            appointmentIdentity(broker.owner) === appointmentIdentity(filters.owner)) &&
          regionForManager(broker.manager, periodReferenceDate) === null,
      ));
  const rosterUnavailableReason =
    !houseOnly || filters.company || filters.accountRanking
      ? ("unsupported-dimensions" as const)
      : unknownRosterRegion
        ? ("unknown-regional-link" as const)
        : hasMappableRosterFilter && brokerRoster === null
          ? ("missing-roster" as const)
          : null;
  const filteredRoster =
    hasMappableRosterFilter && brokerRoster !== null
      ? brokerRoster.filter(
          (broker) =>
            (!filters.regionalManager ||
              regionForManager(broker.manager, periodReferenceDate) === filters.regionalManager) &&
            (!filters.manager ||
              appointmentIdentity(broker.manager) === appointmentIdentity(filters.manager)) &&
            (!filters.owner ||
              appointmentIdentity(broker.owner) === appointmentIdentity(filters.owner)),
        )
      : brokerRoster;
  const filteredBrokerCount =
    slice.version < 3 || rosterUnavailableReason !== null
      ? null
      : hasMappableRosterFilter
        ? filteredRoster === null
          ? null
          : new Set(filteredRoster.map((broker) => broker.key)).size
        : (slice.brokerCount ?? null);
  const filteredManagerCount =
    slice.version !== 4 || rosterUnavailableReason !== null
      ? null
      : hasMappableRosterFilter
        ? filteredRoster === null
          ? null
          : new Set(
              filteredRoster.map((broker) => appointmentIdentity(broker.manager)).filter(Boolean),
            ).size
        : (slice.brokerManagerCount ?? null);
  let total = 0,
    today = 0,
    yesterday = 0;
  const funnel = {
    opportunities: 0,
    appointments: 0,
    visits: 0,
    folders: 0,
    approvedFolders: 0,
    sales: 0,
  };
  if (slice.version === 4 && conversionAvailable) {
    for (const fact of sharedFacts) {
      if (!matchesReportingPeriod(fact[1])) continue;
      if (fact[0] === 0) funnel.opportunities += fact[7];
      if (fact[0] === 1) funnel.appointments += fact[7];
      if (fact[0] === 2) funnel.visits += fact[7];
      if (fact[0] === 3) {
        funnel.folders += fact[7];
        funnel.approvedFolders += fact[9];
      }
      if (fact[0] === 4) funnel.sales += fact[7];
    }
  }

  if (dimensionFilteredOperations !== null) {
    for (const appointment of dimensionFilteredOperations) {
      const date = saoPauloDate(appointment.createdAt);
      if (date < slice.coverageStart || date > slice.referenceDate) continue;
      if (date.slice(0, 4) === year) add(monthly, date.slice(5, 7));
    }
  } else {
    for (const fact of dimensionFacts) {
      if (fact[0] !== 1) continue;
      const date = fact[1];
      if (date < slice.coverageStart || date > slice.referenceDate) continue;
      if (date.slice(0, 4) === year) add(monthly, date.slice(5, 7), fact[7]);
    }
  }

  if (filteredOperations !== null) {
    for (const appointment of filteredOperations) {
      const date = saoPauloDate(appointment.createdAt);
      if (date < slice.coverageStart || date > slice.referenceDate) continue;
      if (date === slice.referenceDate) today += 1;
      if (date === previousReferenceDate) yesterday += 1;
      if (!matchesReportingPeriod(date)) continue;
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
      if (date === slice.referenceDate) today += fact[7];
      if (date === previousReferenceDate) yesterday += fact[7];
      if (!matchesReportingPeriod(date)) continue;
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
  const coveredDays =
    coveredStart > coveredEnd
      ? 0
      : Math.floor(
          (Date.parse(`${coveredEnd}T12:00:00Z`) - Date.parse(`${coveredStart}T12:00:00Z`)) /
            86_400_000,
        ) + 1;
  const selectedCoveredDates = Array.from({ length: coveredDays }, (_, index) => {
    const date = new Date(`${coveredStart}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  }).filter(matchesSelectedPeriod);
  const selectedCoveredDays = selectedCoveredDates.length;
  const details: AppointmentDetailRow[] | null =
    filteredOperations === null
      ? null
      : filteredOperations
          .filter((appointment) => matchesReportingPeriod(saoPauloDate(appointment.createdAt)))
          .map((appointment) => {
            const appointmentDate = saoPauloDate(appointment.createdAt);
            return {
              ...appointment,
              daysSinceAppointment: calendarDaysBetween(appointmentDate, periodReferenceDate),
            };
          })
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const productiveOwners =
    slice.version === 4 && filteredOperations !== null
      ? new Set(
          filteredOperations
            .filter(
              (appointment) =>
                matchesReportingPeriod(saoPauloDate(appointment.createdAt)) &&
                "registeredBroker" in appointment &&
                appointment.registeredBroker,
            )
            .map((appointment) => appointment.owner)
            .filter(Boolean),
        ).size
      : null;
  const productivePercent =
    productiveOwners === null || filteredBrokerCount === null
      ? null
      : filteredBrokerCount === 0
        ? 0
        : (productiveOwners / filteredBrokerCount) * 100;
  const recencyBaseDate = coveredStart <= coveredEnd ? periodReferenceDate : null;
  const latestRegisteredAppointments = new Map<string, DashboardAppointmentDetail>();
  if (slice.version === 4 && recencyBaseDate) {
    for (const appointment of slice.appointments ?? []) {
      if (!("registeredBroker" in appointment) || !appointment.registeredBroker) continue;
      if (!matchesAppointmentDimensions(appointment)) continue;
      const ownerKey = appointmentIdentity(appointment.owner);
      if (!ownerKey) continue;
      const date = saoPauloDate(appointment.createdAt);
      if (date < slice.coverageStart || date > recencyBaseDate) continue;
      const current = latestRegisteredAppointments.get(ownerKey);
      if (!current || Date.parse(appointment.createdAt) > Date.parse(current.createdAt)) {
        latestRegisteredAppointments.set(ownerKey, appointment);
      }
    }
  }
  const brokerRecency: AppointmentBrokerRecencyBuckets = {
    upTo7Days: [],
    from8To14Days: [],
    from15Days: [],
  };
  for (const appointment of latestRegisteredAppointments.values()) {
    const lastAppointmentDate = saoPauloDate(appointment.createdAt);
    const item: AppointmentBrokerRecency = {
      owner: appointment.owner,
      manager: appointment.salesManager || "Gerente não informado",
      lastAppointmentDate,
      daysSinceLastAppointment: calendarDaysBetween(lastAppointmentDate, recencyBaseDate!),
    };
    if (item.daysSinceLastAppointment <= 7) brokerRecency.upTo7Days.push(item);
    else if (item.daysSinceLastAppointment <= 14) brokerRecency.from8To14Days.push(item);
    else brokerRecency.from15Days.push(item);
  }
  const sortRecency = (items: AppointmentBrokerRecency[]) =>
    items.sort(
      (left, right) =>
        right.daysSinceLastAppointment - left.daysSinceLastAppointment ||
        left.owner.localeCompare(right.owner, "pt-BR"),
    );
  sortRecency(brokerRecency.upTo7Days);
  sortRecency(brokerRecency.from8To14Days);
  sortRecency(brokerRecency.from15Days);
  const conversionGroups = {
    owners: new Map<string, { appointments: number; visits: number }>(),
    managers: new Map<string, { appointments: number; visits: number }>(),
    regionalManagers: new Map<string, { appointments: number; visits: number }>(),
  };
  const addConversion = (
    map: Map<string, { appointments: number; visits: number }>,
    key: string | null,
    stage: number,
    count: number,
  ) => {
    if (!key) return;
    const current = map.get(key) ?? { appointments: 0, visits: 0 };
    if (stage === 1) current.appointments += count;
    if (stage === 2) current.visits += count;
    map.set(key, current);
  };
  for (const fact of sharedFacts) {
    if (!conversionAvailable) continue;
    if (!matchesReportingPeriod(fact[1]) || (fact[0] !== 1 && fact[0] !== 2)) continue;
    const manager = slice.dimensions.managers[fact[2]] ?? "Gerente não informado";
    addConversion(
      conversionGroups.owners,
      slice.dimensions.owners[fact[3]] ?? "Responsável não informado",
      fact[0],
      fact[7],
    );
    addConversion(conversionGroups.managers, manager, fact[0], fact[7]);
    addConversion(
      conversionGroups.regionalManagers,
      regionForManager(manager, fact[1]),
      fact[0],
      fact[7],
    );
  }
  const conversionRanking = (
    map: Map<string, { appointments: number; visits: number }>,
  ): AppointmentConversionBucket[] =>
    [...map]
      .filter(([, value]) => value.appointments > 0 && value.visits > 0)
      .map(([label, value]) => ({
        key: label,
        label,
        total: (value.visits / value.appointments) * 100,
        appointments: value.appointments,
        visits: value.visits,
        percent: (value.visits / value.appointments) * 100,
        ratio: value.appointments / value.visits,
      }))
      .sort(
        (left, right) =>
          right.percent - left.percent ||
          right.visits - left.visits ||
          left.label.localeCompare(right.label, "pt-BR"),
      );
  const filterOptions = {
    channels: [
      { key: 1 as const, label: "House" },
      { key: 0 as const, label: "Imob" },
    ].filter(({ key }) => slice.facts.some((fact) => fact[5] === key)),
    regionalManagers: [
      ...new Set(
        [...regionalHistory.values()].flatMap((history) =>
          [...history.values()].flatMap((names) => [...names]),
        ),
      ),
    ].sort((left, right) => left.localeCompare(right, "pt-BR")),
    managers: slice.dimensions.managers,
    owners: slice.dimensions.owners,
    companies: slice.dimensions.companies,
  };

  // The registered roster is House-only. Company/ranking cannot be mapped to
  // that roster; mixed/Imob views have no configured appointment target.
  const goalBrokerCount =
    rosterUnavailableReason !== null
      ? null
      : filteredRoster !== null
        ? new Set(filteredRoster.map((broker) => broker.key)).size
        : hasMappableRosterFilter
          ? null
          : filteredBrokerCount;
  const monthlyGoalFor = (targetMonth: string) =>
    appointmentMonthlyGoal(goalsByMonth[targetMonth] ?? null, goalBrokerCount);
  // User-confirmed House daily policy: one per weekday, two on Thursdays.
  // Independent of the configured monthly funnel target, which may be absent.
  const dailyGoalFor = (date: string) => plannedAppointmentsForDate(date, goalBrokerCount);
  const dailyGoals = new Map<string, number | null>();
  const weeklyGoals = new Map<string, number | null>();
  const coveredWeeks = new Set<string>();
  if (coverage !== "unavailable") {
    const goalDates = hasExplicitPeriod
      ? selectedCoveredDates
      : Array.from(
          { length: Number(end.slice(8, 10)) },
          (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
        );
    for (const date of goalDates) {
      const week = String(appointmentWeekOfMonth(date));
      const covered = date >= coveredStart && date <= coveredEnd;
      if (covered) coveredWeeks.add(week);
      if (!matchesSelectedPeriod(date)) continue;
      const goal = dailyGoalFor(date);
      if (covered) dailyGoals.set(date, goal);
      const accumulated = weeklyGoals.get(week);
      weeklyGoals.set(
        week,
        goal === null || accumulated === null ? null : (accumulated ?? 0) + goal,
      );
    }
    // Show only weeks intersecting coverage, but retain their full target
    // within the selected month/filters, including future days of that week.
    for (const week of weeklyGoals.keys()) {
      if (!coveredWeeks.has(week)) weeklyGoals.delete(week);
    }
  }
  function withGoals(
    actual: AppointmentBucket[],
    goals: Map<string, number | null>,
    label: (key: string) => string,
  ): AppointmentGoalBucket[] {
    const buckets = new Map(
      actual.map((bucket) => [bucket.key, { ...bucket, goal: goals.get(bucket.key) ?? null }]),
    );
    // Include zero-actual periods only when their target is known. Unknown
    // targets preserve the legacy sparse series rather than inventing data.
    for (const [key, goal] of goals) {
      if (goal !== null && !buckets.has(key))
        buckets.set(key, { key, label: label(key), total: 0, goal });
    }
    return [...buckets.values()].sort((a, b) =>
      a.key.localeCompare(b.key, "pt-BR", { numeric: true }),
    );
  }
  const monthGoals = new Map<string, number | null>();
  for (let index = 1; index <= 12; index += 1) {
    const key = String(index).padStart(2, "0");
    const targetMonth = `${year}-${key}`;
    if (
      targetMonth < slice.coverageStart.slice(0, 7) ||
      targetMonth > slice.referenceDate.slice(0, 7)
    )
      continue;
    monthGoals.set(key, monthlyGoalFor(targetMonth));
  }
  const todayGoal = matchesSelectedPeriod(slice.referenceDate)
    ? dailyGoalFor(slice.referenceDate)
    : null;
  const yesterdayGoal =
    previousReferenceDate >= slice.coverageStart && matchesSelectedPeriod(previousReferenceDate)
      ? dailyGoalFor(previousReferenceDate)
      : null;
  const dailyAverageGoal =
    selectedCoveredDays === 0 || goalBrokerCount === null
      ? null
      : selectedCoveredDates.reduce((sum, date) => sum + dailyGoalFor(date)!, 0) /
        selectedCoveredDays;

  return {
    total,
    today,
    yesterday,
    dailyAverage: selectedCoveredDays > 0 ? total / selectedCoveredDays : null,
    dailyAverageGoal,
    brokerCount: filteredBrokerCount,
    plannedToday: todayGoal,
    todayGoal,
    yesterdayGoal,
    monthlyGoal: monthlyGoalFor(month),
    goalBrokerCount,
    performedToday: filteredOperations === null ? null : today,
    filterOptions,
    productiveBrokers: productiveOwners,
    productivePercent,
    registeredManagerCount: filteredManagerCount,
    funnel: slice.version === 4 && conversionAvailable ? funnel : null,
    visitsPerformed: slice.version === 4 && conversionAvailable ? funnel.visits : null,
    sales: slice.version === 4 && conversionAvailable ? funnel.sales : null,
    conversionAvailable,
    regionalFactsAvailable,
    rosterUnavailableReason,
    brokerRecency,
    conversionRankings: {
      owners: conversionRanking(conversionGroups.owners),
      managers: conversionRanking(conversionGroups.managers),
      regionalManagers: regionalFactsAvailable
        ? conversionRanking(conversionGroups.regionalManagers)
        : [],
    },
    selectedCoveredDays,
    daysInMonth: Number(end.slice(8, 10)),
    details,
    regionalManagers: filteredOperations === null ? null : ranking(regionalManagers),
    accountRankings: filteredOperations === null ? null : ranking(accountRankings),
    coverage,
    daily: withGoals(
      chronological(daily, (date) => date.slice(8, 10)),
      dailyGoals,
      (date) => date.slice(8, 10),
    ),
    weekly: withGoals(
      chronological(weekly, (week) => `${week}ª semana`),
      weeklyGoals,
      (week) => `${week}ª semana`,
    ),
    monthly: withGoals(
      chronological(monthly, (key) => APPOINTMENT_MONTHS[Number(key) - 1]!),
      monthGoals,
      (key) => APPOINTMENT_MONTHS[Number(key) - 1]!,
    ),
    managers: ranking(managers),
    owners: ranking(owners),
    stores: ranking(stores),
    developments: slice.version === 2 ? ranking(developments) : null,
  };
}
