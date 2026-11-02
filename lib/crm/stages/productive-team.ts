import type { DashboardAnalysisSlice } from "../dashboard/analysis-contract";
import {
  analyzeAppointments,
  normalizeAppointmentCreatedDates,
  saoPauloDate,
  type AppointmentBrokerRosterEntry,
  type AppointmentFilters,
} from "./appointments";

export const PRODUCTIVE_TEAM_STAGES = ["appointments", "visits", "folders", "sales"] as const;
export type ProductiveTeamStage = (typeof PRODUCTIVE_TEAM_STAGES)[number];
export type ProductiveTeamFilters = Pick<
  AppointmentFilters,
  | "channel"
  | "regionalManager"
  | "manager"
  | "owner"
  | "company"
  | "periodStart"
  | "periodEnd"
  | "createdDate"
  | "createdDates"
>;
export type ProductiveTeamUnavailableReason =
  | "stage-unavailable"
  | "unsupported-version"
  | "unsupported-dimensions"
  | "unknown-regional-link"
  | "missing-roster"
  | "unavailable-period"
  | "ambiguous-broker"
  | "inconsistent-roster";

export interface ProductiveTeamCard {
  stage: ProductiveTeamStage;
  productiveBrokers: number | null;
  brokerCount: number | null;
  percent: number | null;
  unavailableReason: ProductiveTeamUnavailableReason | null;
}

const identity = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

/** Analyze only an already authorized snapshot. Stage availability must reflect
 * the server's permissions and source status, never the existence of fact rows.
 * The official registered roster is the denominator, not observed activity.
 */
export function analyzeProductiveTeam(
  slice: DashboardAnalysisSlice,
  {
    filters = {},
    month = slice.referenceDate.slice(0, 7),
    brokerRoster = null,
    availableStages = PRODUCTIVE_TEAM_STAGES,
  }: {
    filters?: ProductiveTeamFilters;
    month?: string;
    brokerRoster?: AppointmentBrokerRosterEntry[] | null;
    availableStages?: readonly ProductiveTeamStage[];
  } = {},
) {
  const appointments = analyzeAppointments(slice, { filters, month, brokerRoster });
  const brokerCount = appointments.brokerCount;
  const rosterKeys = new Map<string, Set<string>>();
  for (const broker of brokerRoster ?? []) {
    const pair = identity(broker.owner);
    const keys = rosterKeys.get(pair) ?? new Set<string>();
    keys.add(broker.key);
    rosterKeys.set(pair, keys);
  }

  // Match the existing appointment contract: only an observation at or before
  // the fact date can establish the manager's regional link. A conflicting day
  // makes that link unknown until a later unambiguous observation.
  const regions = new Map<string, Map<string, Set<string>>>();
  for (const appointment of slice.appointments ?? []) {
    const manager = identity(appointment.salesManager);
    const region = appointment.regionalManager.trim();
    if (!manager || !region) continue;
    const date = saoPauloDate(appointment.createdAt);
    const history = regions.get(manager) ?? new Map<string, Set<string>>();
    const names = history.get(date) ?? new Set<string>();
    names.add(region);
    history.set(date, names);
    regions.set(manager, history);
  }
  const timelines = new Map(
    [...regions].map(([manager, history]) => [
      manager,
      [...history]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, names]) => ({
          date,
          region: names.size === 1 ? [...names][0]! : null,
        })),
    ]),
  );
  const regionFor = (manager: string, date: string) => {
    const history = timelines.get(identity(manager));
    if (!history) return null;
    let low = 0,
      high = history.length - 1;
    let found: string | null = null;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const observation = history[middle]!;
      if (observation.date <= date) {
        found = observation.region;
        low = middle + 1;
      } else high = middle - 1;
    }
    return found;
  };
  const selectedDates = new Set(
    normalizeAppointmentCreatedDates(
      filters.createdDates?.length
        ? filters.createdDates
        : filters.createdDate
          ? [filters.createdDate]
          : undefined,
      slice.coverageStart,
      slice.referenceDate,
    ),
  );
  const inPeriod = (date: string) => {
    if (date < slice.coverageStart || date > slice.referenceDate) return false;
    if (selectedDates.size && !selectedDates.has(date)) return false;
    if (filters.periodStart !== undefined || filters.periodEnd !== undefined)
      return (
        (!filters.periodStart || date >= filters.periodStart) &&
        (!filters.periodEnd || date <= filters.periodEnd)
      );
    return date.slice(0, 7) === month;
  };
  const stageNumbers = { appointments: 1, visits: 2, folders: 3, sales: 4 } as const;
  const cards: ProductiveTeamCard[] = PRODUCTIVE_TEAM_STAGES.map((stage) => {
    const unavailable = (reason: ProductiveTeamUnavailableReason): ProductiveTeamCard => ({
      stage,
      productiveBrokers: null,
      brokerCount,
      percent: null,
      unavailableReason: reason,
    });
    if (!availableStages.includes(stage)) return unavailable("stage-unavailable");
    if (slice.version !== 4) return unavailable("unsupported-version");
    if (appointments.coverage === "unavailable") return unavailable("unavailable-period");
    if (appointments.rosterUnavailableReason)
      return unavailable(appointments.rosterUnavailableReason);
    if (brokerCount === null) return unavailable("missing-roster");

    let productiveBrokers: number;
    if (stage === "appointments") {
      // Preserve the exact registeredBroker and detail-date rule of the card
      // already shown on Agendamentos.
      if (appointments.productiveBrokers === null) return unavailable("unsupported-version");
      productiveBrokers = appointments.productiveBrokers;
    } else {
      if (brokerRoster === null) return unavailable("missing-roster");
      if (filters.regionalManager && !appointments.regionalFactsAvailable)
        return unavailable("unknown-regional-link");
      const productive = new Set<string>();
      for (const fact of slice.facts) {
        if (fact[0] !== stageNumbers[stage] || !inPeriod(fact[1])) continue;
        const manager = slice.dimensions.managers[fact[2]] ?? "";
        const owner = slice.dimensions.owners[fact[3]] ?? "";
        if (
          (filters.channel !== undefined && fact[5] !== filters.channel) ||
          (filters.manager && manager !== filters.manager) ||
          (filters.owner && owner !== filters.owner) ||
          (filters.company && slice.dimensions.companies[fact[4]] !== filters.company) ||
          (filters.regionalManager && regionFor(manager, fact[1]) !== filters.regionalManager)
        )
          continue;
        const keys = rosterKeys.get(identity(owner));
        if (keys && keys.size > 1) return unavailable("ambiguous-broker");
        if (keys?.size === 1) productive.add([...keys][0]!);
      }
      productiveBrokers = productive.size;
    }
    if (productiveBrokers > brokerCount) return unavailable("inconsistent-roster");
    return {
      stage,
      productiveBrokers,
      brokerCount,
      percent: brokerCount === 0 ? 0 : (productiveBrokers / brokerCount) * 100,
      unavailableReason: null,
    };
  });
  return {
    cards,
    brokerCount,
    coverage: appointments.coverage,
    filterOptions: appointments.filterOptions,
  };
}
