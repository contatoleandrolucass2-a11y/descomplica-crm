import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pointGoals } from "@/db/schema";
import { loadDashboardPageData } from "../dashboard-data";
import { RankingClient, type RankingWeights } from "../RankingClient";

export const dynamic = "force-dynamic";

const defaultWeights: RankingWeights = {
  roulette: 1,
  schedule: 1,
  visit: 7,
  approvedFolder: 4,
  sale: 10,
};

async function loadWeights() {
  try {
    const [row] = await getDb().select().from(pointGoals).where(eq(pointGoals.id, "default")).limit(1);
    if (!row) return defaultWeights;
    const saved = JSON.parse(row.weightsJson) as Partial<RankingWeights>;
    return Object.fromEntries(
      Object.entries(defaultWeights).map(([key, fallback]) => {
        const value = Number(saved[key as keyof RankingWeights]);
        return [key, Number.isFinite(value) && value >= 0 ? value : fallback];
      }),
    ) as RankingWeights;
  } catch {
    return defaultWeights;
  }
}

export default async function RankingPage() {
  const [{ dashboard, dataStatus }, weights] = await Promise.all([
    loadDashboardPageData("/ranking"),
    loadWeights(),
  ]);

  return <RankingClient dashboard={dashboard} dataStatus={dataStatus} weights={weights} />;
}
