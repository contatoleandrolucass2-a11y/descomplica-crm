import "server-only";

import { z } from "zod";

import { createPrivilegedClient } from "@/lib/auth/supabase/privileged";

const EXPORT_SECRET_PATTERN = /^[A-Za-z0-9._~+/=-]{32,256}$/;

type RankingExportEnvironment = Readonly<
  Record<string, string | undefined> & { RANKING_EXPORT_SECRET?: string }
>;

export type RankingExportConfiguration =
  | { available: false }
  | { available: true; exportSecret: string };

const snapshotSchema = z.object({
  reference_date: z.string(),
  generated_at: z.string(),
  timezone: z.string().min(1),
  source: z.string().min(1),
  roulette_available: z.boolean(),
});

const participantSchema = z.object({
  period_key: z.enum(["month", "last_week", "week", "today"]),
  broker_key: z.string().min(1),
  broker_name: z.string().min(1),
  manager_name: z.string().min(1),
  roulette: z.coerce.number().int().nonnegative(),
  roulette_saturday: z.coerce.number().int().nonnegative(),
  roulette_sunday: z.coerce.number().int().nonnegative(),
  schedule: z.coerce.number().int().nonnegative(),
  visit: z.coerce.number().int().nonnegative(),
  approved_folder: z.coerce.number().int().nonnegative(),
  sale: z.coerce.number().int().nonnegative(),
});

export type RankingExportPayload = {
  schemaVersion: 1;
  exportedAt: string;
  snapshot: {
    referenceDate: string;
    generatedAt: string;
    timezone: string;
    source: string;
    rouletteAvailable: boolean;
  } | null;
  participants: Array<{
    periodKey: "month" | "last_week" | "week" | "today";
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
  }>;
};

export function getRankingExportConfiguration(
  environment: RankingExportEnvironment = process.env,
): RankingExportConfiguration {
  const exportSecret = environment.RANKING_EXPORT_SECRET?.trim();
  if (!exportSecret || !EXPORT_SECRET_PATTERN.test(exportSecret)) {
    return { available: false };
  }
  return { available: true, exportSecret };
}

export async function loadRankingExportPayload(now: () => Date = () => new Date()) {
  const supabase = createPrivilegedClient();
  const snapshotResult = await supabase
    .from("crm_ranking_snapshots")
    .select("id,reference_date,generated_at,timezone,source,roulette_available")
    .eq("snapshot_key", "global")
    .maybeSingle();

  if (snapshotResult.error) {
    throw new Error("ranking_export_snapshot_unavailable");
  }

  if (!snapshotResult.data) {
    return {
      schemaVersion: 1,
      exportedAt: now().toISOString(),
      snapshot: null,
      participants: [],
    } satisfies RankingExportPayload;
  }

  const snapshot = snapshotSchema.parse(snapshotResult.data);
  const snapshotId = z.coerce.number().int().positive().parse(snapshotResult.data.id);
  const participantsResult = await supabase
    .from("crm_ranking_participants")
    .select(
      "period_key,broker_key,broker_name,manager_name,roulette,roulette_saturday,roulette_sunday,schedule,visit,approved_folder,sale",
    )
    .eq("snapshot_id", snapshotId);

  if (participantsResult.error) {
    throw new Error("ranking_export_participants_unavailable");
  }

  const participants = z.array(participantSchema).parse(participantsResult.data ?? []);

  return {
    schemaVersion: 1,
    exportedAt: now().toISOString(),
    snapshot: {
      referenceDate: snapshot.reference_date,
      generatedAt: snapshot.generated_at,
      timezone: snapshot.timezone,
      source: snapshot.source,
      rouletteAvailable: snapshot.roulette_available,
    },
    participants: participants.map((participant) => ({
      periodKey: participant.period_key,
      brokerKey: participant.broker_key,
      brokerName: participant.broker_name,
      managerName: participant.manager_name,
      roulette: participant.roulette,
      rouletteSaturday: participant.roulette_saturday,
      rouletteSunday: participant.roulette_sunday,
      schedule: participant.schedule,
      visit: participant.visit,
      approvedFolder: participant.approved_folder,
      sale: participant.sale,
    })),
  } satisfies RankingExportPayload;
}
