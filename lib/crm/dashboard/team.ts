import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import type { AuthorizationContext } from "@/lib/authorization/types";

import type { DashboardViewKey } from "./catalog";
import type { DashboardReadModel } from "./data";

const MAX_ROWS = 1_000;
const HEADER_COLUMNS = "id,snapshot_key,reference_date,generated_at,timezone,source,updated_at";
const UNKNOWN_MANAGER = "Sem gerente informado";

const timestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)))
  .transform((value) => {
    // Date normalizes offsets but loses PostgreSQL's sub-millisecond precision.
    const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "";
    return `${Date.parse(value)}:${fraction.slice(3).replace(/0+$/, "")}`;
  });

const metadataSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  snapshot_key: z.literal("global"),
  reference_date: z.string().date(),
  generated_at: timestamp,
  timezone: z.string().trim().min(1),
  source: z.string().trim().min(1),
});
const headerSchema = metadataSchema.extend({ updated_at: timestamp });
const participantsSchema = z.array(
  z
    .object({
      broker_key: z
        .string()
        .max(100)
        .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/),
      manager_name: z
        .string()
        .trim()
        .max(200)
        .nullish()
        .transform((value) => value || UNKNOWN_MANAGER),
    })
    .strict(),
);

type Metadata = z.infer<typeof metadataSchema>;
type Header = z.infer<typeof headerSchema>;

export interface DashboardTeam {
  brokers: number;
  managers: Array<{ name: string; total: number }>;
}

export type DashboardTeamResult =
  | { status: "ready"; team: DashboardTeam }
  | { status: "unavailable"; reason: string };

function unavailable(reason: string): DashboardTeamResult {
  return { status: "unavailable", reason };
}

function sameMetadata(left: Metadata, right: Metadata): boolean {
  return (
    left.snapshot_key === right.snapshot_key &&
    left.reference_date === right.reference_date &&
    left.generated_at === right.generated_at &&
    left.timezone === right.timezone &&
    left.source === right.source
  );
}

function unchanged(before: Header, after: Header): boolean {
  return (
    before.id === after.id && before.updated_at === after.updated_at && sameMetadata(before, after)
  );
}

export async function loadDashboardTeam(
  dashboard: DashboardReadModel,
  authorization: AuthorizationContext,
  view: DashboardViewKey,
): Promise<DashboardTeamResult> {
  if (
    !authorization.permissions.includes("crm.ranking.view") ||
    !authorization.permissions.includes("crm.dashboard.all.view")
  ) {
    return unavailable("Sem acesso aos dados da equipe.");
  }
  if (view !== "all") return unavailable("Equipe indisponivel nesta visao.");

  const expected = headerSchema.safeParse({
    id: dashboard.id,
    snapshot_key: dashboard.snapshotKey,
    reference_date: dashboard.referenceDate,
    generated_at: dashboard.generatedAt,
    updated_at: dashboard.updatedAt,
    timezone: dashboard.timezone,
    source: dashboard.source,
  });
  if (!expected.success) return unavailable("Snapshot do dashboard inconsistente.");

  try {
    const supabase = await createClient();
    async function readHeader(
      table: "crm_ranking_snapshots" | "crm_dashboard_snapshots",
    ): Promise<Header | null> {
      const result = await supabase
        .from(table)
        .select(HEADER_COLUMNS)
        .eq("snapshot_key", "global")
        .maybeSingle();
      if (result.error) return null;
      const parsed = headerSchema.safeParse(result.data);
      return parsed.success ? parsed.data : null;
    }

    const [ranking, initialDashboard] = await Promise.all([
      readHeader("crm_ranking_snapshots"),
      readHeader("crm_dashboard_snapshots"),
    ]);
    if (!ranking || !initialDashboard) return unavailable("Snapshot da equipe indisponivel.");
    if (
      !unchanged(expected.data, initialDashboard) ||
      !sameMetadata(ranking, expected.data) ||
      ranking.updated_at !== expected.data.updated_at
    ) {
      return unavailable("Snapshots divergentes.");
    }

    const result = await supabase
      .from("crm_ranking_participants")
      .select("broker_key,manager_name", { count: "exact" })
      .eq("snapshot_id", ranking.id)
      .eq("period_key", "month")
      .order("broker_key")
      .range(0, MAX_ROWS - 1);
    if (result.error) return unavailable("Nao foi possivel consultar a equipe.");

    const count = z.number().int().min(1).max(MAX_ROWS).safeParse(result.count);
    const participants = participantsSchema.safeParse(result.data);
    if (!count.success || !participants.success || participants.data.length !== count.data) {
      return unavailable("Dados da equipe incompletos.");
    }

    const brokers = new Map<string, string>();
    for (const participant of participants.data) {
      const manager = brokers.get(participant.broker_key);
      if (manager !== undefined && manager !== participant.manager_name) {
        return unavailable("Equipe com dados inconsistentes.");
      }
      brokers.set(participant.broker_key, participant.manager_name);
    }
    const managers = new Map<string, number>();
    for (const manager of brokers.values()) {
      managers.set(manager, (managers.get(manager) ?? 0) + 1);
    }

    const [finalRanking, finalDashboard] = await Promise.all([
      readHeader("crm_ranking_snapshots"),
      readHeader("crm_dashboard_snapshots"),
    ]);
    if (!finalRanking || !finalDashboard) return unavailable("Snapshot da equipe indisponivel.");
    if (!unchanged(ranking, finalRanking) || !unchanged(initialDashboard, finalDashboard)) {
      return unavailable("Snapshot alterado durante a leitura.");
    }

    return {
      status: "ready",
      team: {
        brokers: brokers.size,
        managers: [...managers]
          .map(([name, total]) => ({ name, total }))
          .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      },
    };
  } catch {
    return unavailable("Nao foi possivel consultar a equipe.");
  }
}
