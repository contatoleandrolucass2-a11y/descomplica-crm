import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { loadPointSettings } from "@/lib/crm/points/data";
import { RANKING_PERIODS, type RankingPeriodKey } from "./catalog";
import type { RankingActivity } from "./presentation";

const snapshotSchema = z.object({
  id: z.coerce.number().int().positive(),
  reference_date: z.string(),
  generated_at: z.string(),
  timezone: z.string().min(1),
  source: z.string().min(1),
  roulette_available: z.boolean(),
});
const participantSchema = z.object({
  period_key: z.string(),
  broker_key: z.string(),
  broker_name: z.string(),
  manager_name: z.string(),
  roulette: z.coerce.number().int().nonnegative(),
  roulette_saturday: z.coerce.number().int().nonnegative(),
  roulette_sunday: z.coerce.number().int().nonnegative(),
  schedule: z.coerce.number().int().nonnegative(),
  visit: z.coerce.number().int().nonnegative(),
  approved_folder: z.coerce.number().int().nonnegative(),
  sale: z.coerce.number().int().nonnegative(),
});

function isPeriod(value: string): value is RankingPeriodKey {
  return Object.prototype.hasOwnProperty.call(RANKING_PERIODS, value);
}

export type RankingLoadResult =
  | { status: "empty" }
  | { status: "unconfigured" }
  | {
      status: "ready";
      referenceDate: string;
      generatedAt: string;
      timezone: string;
      source: string;
      rouletteAvailable: boolean;
      activities: RankingActivity[];
      weights: Awaited<ReturnType<typeof loadPointSettings>> & { status: "ready" };
    };

export async function loadRankingReadModel(): Promise<RankingLoadResult> {
  const supabase = await createClient();
  const snapshotResult = await supabase
    .from("crm_ranking_snapshots")
    .select("id,reference_date,generated_at,timezone,source,roulette_available")
    .eq("snapshot_key", "global")
    .maybeSingle();

  if (snapshotResult.error) throw new Error("Não foi possível carregar o ranking.");
  if (!snapshotResult.data) return { status: "empty" };

  const snapshot = snapshotSchema.parse(snapshotResult.data);
  const [participantsResult, pointSettings] = await Promise.all([
    supabase
      .from("crm_ranking_participants")
      .select(
        "period_key,broker_key,broker_name,manager_name,roulette,roulette_saturday,roulette_sunday,schedule,visit,approved_folder,sale",
      )
      .eq("snapshot_id", snapshot.id),
    loadPointSettings(),
  ]);

  if (participantsResult.error) throw new Error("Não foi possível carregar os participantes.");
  if (pointSettings.status === "empty") return { status: "unconfigured" };

  const rows = z.array(participantSchema).parse(participantsResult.data ?? []);
  const activities = rows.map((row) => {
    if (!isPeriod(row.period_key)) throw new Error("Período desconhecido no ranking.");
    return {
      periodKey: row.period_key,
      brokerKey: row.broker_key,
      brokerName: row.broker_name,
      managerName: row.manager_name,
      roulette: row.roulette,
      rouletteSaturday: row.roulette_saturday,
      rouletteSunday: row.roulette_sunday,
      schedule: row.schedule,
      visit: row.visit,
      approvedFolder: row.approved_folder,
      sale: row.sale,
    };
  });

  return {
    status: "ready",
    referenceDate: snapshot.reference_date,
    generatedAt: snapshot.generated_at,
    timezone: snapshot.timezone,
    source: snapshot.source,
    rouletteAvailable: snapshot.roulette_available,
    activities,
    weights: pointSettings,
  };
}
