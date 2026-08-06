import type { PointMetricValues } from "@/lib/crm/points/catalog";
import type { RankingPeriodKey, RankingScopeKey } from "./catalog";

export type RankingActivity = {
  periodKey: RankingPeriodKey;
  brokerKey: string;
  brokerName: string;
  managerName: string;
  roulette: number;
  rouletteSaturday: number;
  rouletteSunday: number;
  schedule: number;
  visit: number;
  approvedFolder: number;
  sale: number;
};

export type RankingLine = Omit<RankingActivity, "periodKey" | "brokerKey" | "brokerName"> & {
  name: string;
  memberCount: number;
  baseScore: number;
  bonus: number;
  total: number;
  conversion: number;
};

function score(
  activity: Omit<RankingActivity, "periodKey" | "brokerKey" | "brokerName">,
  weights: PointMetricValues,
  rouletteAvailable: boolean,
) {
  const baseScore =
    (rouletteAvailable ? activity.roulette * weights.roulette : 0) +
    (rouletteAvailable ? activity.rouletteSaturday * weights.roulette_saturday : 0) +
    (rouletteAvailable ? activity.rouletteSunday * weights.roulette_sunday : 0) +
    activity.schedule * weights.schedule +
    activity.visit * weights.visit +
    activity.approvedFolder * weights.approved_folder +
    activity.sale * weights.sale;
  const conversion = activity.schedule > 0 ? activity.visit / activity.schedule : 0;
  const bonus = Math.floor(baseScore * conversion);
  return { baseScore, bonus, total: baseScore + bonus, conversion };
}

function compareLines(left: RankingLine, right: RankingLine) {
  return (
    right.total - left.total ||
    right.visit - left.visit ||
    right.conversion - left.conversion ||
    right.approvedFolder - left.approvedFolder ||
    right.sale - left.sale ||
    left.name.localeCompare(right.name, "pt-BR")
  );
}

export function buildRanking(
  activities: RankingActivity[],
  period: RankingPeriodKey,
  scope: RankingScopeKey,
  weights: PointMetricValues,
  rouletteAvailable = true,
): RankingLine[] {
  const selected = activities.filter((activity) => activity.periodKey === period);

  if (scope === "brokers") {
    return selected
      .map((activity) => ({
        name: activity.brokerName,
        managerName: activity.managerName,
        memberCount: 1,
        roulette: activity.roulette,
        rouletteSaturday: activity.rouletteSaturday,
        rouletteSunday: activity.rouletteSunday,
        schedule: activity.schedule,
        visit: activity.visit,
        approvedFolder: activity.approvedFolder,
        sale: activity.sale,
        ...score(activity, weights, rouletteAvailable),
      }))
      .sort(compareLines);
  }

  const managers = new Map<
    string,
    Omit<RankingLine, "baseScore" | "bonus" | "total" | "conversion">
  >();

  for (const activity of selected) {
    const current = managers.get(activity.managerName) ?? {
      name: activity.managerName,
      managerName: activity.managerName,
      memberCount: 0,
      roulette: 0,
      rouletteSaturday: 0,
      rouletteSunday: 0,
      schedule: 0,
      visit: 0,
      approvedFolder: 0,
      sale: 0,
    };
    current.memberCount += 1;
    current.roulette += activity.roulette;
    current.rouletteSaturday += activity.rouletteSaturday;
    current.rouletteSunday += activity.rouletteSunday;
    current.schedule += activity.schedule;
    current.visit += activity.visit;
    current.approvedFolder += activity.approvedFolder;
    current.sale += activity.sale;
    managers.set(activity.managerName, current);
  }

  return [...managers.values()]
    .map((manager) => ({ ...manager, ...score(manager, weights, rouletteAvailable) }))
    .sort(compareLines);
}
