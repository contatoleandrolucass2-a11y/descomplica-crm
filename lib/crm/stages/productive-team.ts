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
  productiveMembers: ProductiveTeamMember[] | null;
  unproductiveMembers: ProductiveTeamMember[] | null;
}

export interface ProductiveTeamMember {
  key: string;
  regionalManager: string | null;
  manager: string;
  owner: string;
}

export interface ProductiveTeamSummaryRow {
  key: string;
  regionalManagers: string[];
  regionalUnknownBrokerCount: number;
  manager: string;
  brokerCount: number;
  appointments: number | null;
  visits: number | null;
  folders: number | null;
  sales: number | null;
}

const memberCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const compareMembers = (left: ProductiveTeamMember, right: ProductiveTeamMember) =>
  (left.regionalManager === null
    ? right.regionalManager === null
      ? 0
      : 1
    : right.regionalManager === null
      ? -1
      : memberCollator.compare(left.regionalManager, right.regionalManager)) ||
  memberCollator.compare(left.manager, right.manager) ||
  memberCollator.compare(left.owner, right.owner) ||
  left.key.localeCompare(right.key);

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
  const filteredBrokerKeys = new Set(
    (appointments.filteredBrokerRoster ?? []).map((broker) => broker.key),
  );
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
  // Regional attribution describes the same current roster as the denominator,
  // not whichever historical manager happened to appear on a productive fact.
  // Missing, conflicting or changing links remain unknown rather than guessed.
  let members: ProductiveTeamMember[] | null | undefined;
  const registeredMembers = () => {
    if (members !== undefined) return members;
    const filteredRoster = appointments.filteredBrokerRoster;
    if (filteredRoster === null || brokerCount === null) return (members = null);
    const rosterByKey = new Map(filteredRoster.map((broker) => [broker.key, broker]));
    if (rosterByKey.size !== brokerCount) return (members = null);
    const explicitPeriod = filters.periodStart !== undefined || filters.periodEnd !== undefined;
    const monthEnd = new Date(`${month}-01T12:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const requestedStart = explicitPeriod
      ? filters.periodStart || slice.coverageStart
      : `${month}-01`;
    const requestedEnd = explicitPeriod
      ? filters.periodEnd || slice.referenceDate
      : monthEnd.toISOString().slice(0, 10);
    const start = requestedStart < slice.coverageStart ? slice.coverageStart : requestedStart;
    const end = requestedEnd > slice.referenceDate ? slice.referenceDate : requestedEnd;
    const days = Math.max(
      0,
      Math.floor((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) +
        1,
    );
    const dates = Array.from({ length: days }, (_, index) => {
      const date = new Date(`${start}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    }).filter(inPeriod);
    const regionalLinks = new Map<string, string | null>();
    const stableRegion = (manager: string) => {
      const managerKey = identity(manager);
      if (regionalLinks.has(managerKey)) return regionalLinks.get(managerKey)!;
      const region = dates.length ? regionFor(manager, dates[0]!) : null;
      const stable = region !== null && dates.every((date) => regionFor(manager, date) === region);
      regionalLinks.set(managerKey, stable ? region : null);
      return stable ? region : null;
    };
    members = [...rosterByKey.values()]
      .map((broker) => ({
        key: broker.key,
        owner: broker.owner,
        manager: broker.manager,
        regionalManager:
          broker.regionalManager !== undefined
            ? broker.regionalManager
            : stableRegion(broker.manager),
      }))
      .sort(compareMembers);
    return members;
  };
  const stageNumbers = { appointments: 1, visits: 2, folders: 3, sales: 4 } as const;
  const cards: ProductiveTeamCard[] = PRODUCTIVE_TEAM_STAGES.map((stage) => {
    const unavailable = (reason: ProductiveTeamUnavailableReason): ProductiveTeamCard => ({
      stage,
      productiveBrokers: null,
      brokerCount,
      percent: null,
      unavailableReason: reason,
      productiveMembers: null,
      unproductiveMembers: null,
    });
    if (!availableStages.includes(stage)) return unavailable("stage-unavailable");
    if (slice.version !== 4) return unavailable("unsupported-version");
    if (appointments.coverage === "unavailable") return unavailable("unavailable-period");
    if (appointments.rosterUnavailableReason)
      return unavailable(appointments.rosterUnavailableReason);
    if (brokerCount === null) return unavailable("missing-roster");

    let productiveBrokers: number;
    const productive = new Set<string>();
    if (stage === "appointments") {
      if (appointments.productiveBrokers === null) return unavailable("unsupported-version");
      if (brokerRoster === null) {
        // The snapshot's own registeredBroker flag and numeric denominator
        // remain usable when no dimensional roster filtering is requested.
        productiveBrokers = appointments.productiveBrokers;
      } else {
        // Activity retains its historical manager. Count only identities also
        // present in the current roster that supplies this filtered denominator.
        for (const appointment of appointments.details ?? []) {
          if (
            !("registeredBroker" in appointment) ||
            !appointment.registeredBroker ||
            !inPeriod(saoPauloDate(appointment.createdAt))
          )
            continue;
          const keys = rosterKeys.get(identity(appointment.owner));
          if (keys && keys.size > 1) return unavailable("ambiguous-broker");
          const key = keys?.size === 1 ? [...keys][0]! : null;
          if (key !== null && filteredBrokerKeys.has(key)) productive.add(key);
        }
        productiveBrokers = productive.size;
      }
    } else {
      if (brokerRoster === null) return unavailable("missing-roster");
      if (filters.regionalManager && !appointments.regionalFactsAvailable)
        return unavailable("unknown-regional-link");
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
        const key = keys?.size === 1 ? [...keys][0]! : null;
        if (key !== null && filteredBrokerKeys.has(key)) productive.add(key);
      }
      productiveBrokers = productive.size;
    }
    if (productiveBrokers > brokerCount) return unavailable("inconsistent-roster");
    const registered = registeredMembers();
    return {
      stage,
      productiveBrokers,
      brokerCount,
      percent: brokerCount === 0 ? 0 : (productiveBrokers / brokerCount) * 100,
      unavailableReason: null,
      productiveMembers: registered?.filter((member) => productive.has(member.key)) ?? null,
      unproductiveMembers: registered?.filter((member) => !productive.has(member.key)) ?? null,
    };
  });
  const productiveKeys = new Map(
    cards.map((card) => [
      card.stage,
      card.productiveMembers === null
        ? null
        : new Set(card.productiveMembers.map((member) => member.key)),
    ]),
  );
  const stageValue = (stage: ProductiveTeamStage, key: string): number | null => {
    const keys = productiveKeys.get(stage);
    return keys === null || keys === undefined ? null : keys.has(key) ? 1 : 0;
  };
  // Group by the full canonical manager identity, never its abbreviated label.
  // Each stage reuses the same broker membership as its card and pop-up.
  const registered = registeredMembers();
  const groups = new Map<string, ProductiveTeamSummaryRow>();
  for (const member of registered ?? []) {
    const key = identity(member.manager);
    const existing = groups.get(key);
    if (existing) {
      existing.brokerCount += 1;
      const regional = member.regionalManager;
      if (regional === null) existing.regionalUnknownBrokerCount += 1;
      else if (!existing.regionalManagers.some((name) => identity(name) === identity(regional)))
        existing.regionalManagers.push(regional);
      for (const stage of PRODUCTIVE_TEAM_STAGES) {
        const value = stageValue(stage, member.key);
        existing[stage] =
          existing[stage] === null || value === null ? null : existing[stage] + value;
      }
    } else {
      groups.set(key, {
        key,
        manager: member.manager,
        regionalManagers: member.regionalManager === null ? [] : [member.regionalManager],
        regionalUnknownBrokerCount: member.regionalManager === null ? 1 : 0,
        brokerCount: 1,
        appointments: stageValue("appointments", member.key),
        visits: stageValue("visits", member.key),
        folders: stageValue("folders", member.key),
        sales: stageValue("sales", member.key),
      });
    }
  }
  for (const group of groups.values()) group.regionalManagers.sort(memberCollator.compare);
  const summaryRows: ProductiveTeamSummaryRow[] | null =
    registered === null
      ? null
      : [...groups.values()].sort(
          (left, right) =>
            (left.regionalManagers.length === 0
              ? right.regionalManagers.length === 0
                ? 0
                : 1
              : right.regionalManagers.length === 0
                ? -1
                : memberCollator.compare(
                    left.regionalManagers.join(" / "),
                    right.regionalManagers.join(" / "),
                  )) || memberCollator.compare(left.manager, right.manager),
        );
  return {
    cards,
    summaryRows,
    brokerCount,
    coverage: appointments.coverage,
    filterOptions: appointments.filterOptions,
  };
}
