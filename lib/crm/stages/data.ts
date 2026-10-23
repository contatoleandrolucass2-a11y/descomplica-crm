import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import {
  dashboardAnalysisSliceSchema,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

import type { AppointmentBrokerRosterEntry } from "./appointments";

const MAX_BROKER_ROSTER = 1_000;

const headerSchema = z.object({
  id: z.number().int().positive(),
  reference_date: z.iso.date(),
  generated_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
const rosterSchema = z.array(
  z
    .object({
      broker_key: z
        .string()
        .max(100)
        .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/),
      broker_name: z.string().trim().min(1).max(200),
      manager_name: z.string().trim().min(1).max(200),
    })
    .strict(),
);

export interface AppointmentsReadModel {
  analysis: DashboardAnalysisSlice | null;
  brokerRoster: AppointmentBrokerRosterEntry[] | null;
  generatedAt?: string;
  individualGoal: number | null;
}

/** Read only the authorized stage. A concurrent ingestion invalidates the whole read. */
export async function loadAppointmentsReadModel(
  view: DashboardViewKey,
): Promise<AppointmentsReadModel> {
  const supabase = await createClient();
  async function header() {
    const response = await supabase
      .from("crm_dashboard_snapshots")
      .select("id,reference_date,generated_at,updated_at")
      .eq("snapshot_key", "global")
      .maybeSingle();
    if (response.error) throw new Error("Não foi possível carregar os agendamentos.");
    return response.data ? headerSchema.parse(response.data) : null;
  }

  async function brokerRoster(
    dashboardHeader: z.infer<typeof headerSchema>,
  ): Promise<AppointmentBrokerRosterEntry[] | null> {
    async function rankingHeader() {
      const response = await supabase
        .from("crm_ranking_snapshots")
        .select("id,reference_date,generated_at,updated_at")
        .eq("snapshot_key", "global")
        .maybeSingle();
      if (response.error) return null;
      const parsed = headerSchema.safeParse(response.data);
      return parsed.success ? parsed.data : null;
    }
    const before = await rankingHeader();
    if (
      !before ||
      before.reference_date !== dashboardHeader.reference_date ||
      before.generated_at !== dashboardHeader.generated_at ||
      before.updated_at !== dashboardHeader.updated_at
    )
      return null;
    const response = await supabase
      .from("crm_ranking_participants")
      .select("broker_key,broker_name,manager_name", { count: "exact" })
      .eq("snapshot_id", before.id)
      .eq("period_key", "month")
      .order("broker_name")
      .range(0, MAX_BROKER_ROSTER - 1);
    const after = await rankingHeader();
    const parsed = rosterSchema.safeParse(response.data);
    if (
      response.error ||
      !parsed.success ||
      response.count !== parsed.data.length ||
      parsed.data.length > MAX_BROKER_ROSTER ||
      !after ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      return null;
    const brokerKeys = new Set<string>();
    const roster: AppointmentBrokerRosterEntry[] = [];
    for (const row of parsed.data) {
      const owner = row.broker_name.normalize("NFKC").trim().replace(/\s+/g, " ");
      const manager = row.manager_name.normalize("NFKC").trim().replace(/\s+/g, " ");
      if (brokerKeys.has(row.broker_key)) return null;
      brokerKeys.add(row.broker_key);
      roster.push({ key: row.broker_key, owner, manager });
    }
    return roster;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = await header();
    if (!before) return { analysis: null, brokerRoster: null, individualGoal: null };
    const response = await supabase.rpc("read_crm_appointments_analysis", {
      p_snapshot_id: before.id,
      p_view_keys: [view],
    });
    const roster = await brokerRoster(before);
    const after = await header();
    if (!after || JSON.stringify(before) !== JSON.stringify(after)) continue;
    // Additive rollout: the page can precede the migration without fabricating data.
    if (response.error) {
      if (["PGRST202", "42883"].includes(response.error.code))
        return { analysis: null, brokerRoster: null, individualGoal: null };
      throw new Error("Não foi possível carregar os gráficos de agendamentos.");
    }
    const rows = z
      .array(z.object({ view_key: z.string(), payload: z.unknown() }))
      .parse(response.data);
    if (rows.length === 0) return { analysis: null, brokerRoster: null, individualGoal: null };
    if (rows.length !== 1 || rows[0]!.view_key !== view) {
      throw new Error("A análise não corresponde à visão autorizada.");
    }
    const analysis = dashboardAnalysisSliceSchema.parse(rows[0]!.payload);
    if (
      analysis.viewKey !== view ||
      analysis.referenceDate !== before.reference_date ||
      (analysis.version < 4 && analysis.facts.some((fact) => fact[0] !== 1))
    ) {
      throw new Error("A análise não corresponde ao snapshot de agendamentos.");
    }
    const goalResponse = await supabase.rpc("read_crm_appointments_goal", {
      p_reference_date: before.reference_date,
    });
    let individualGoal: number | null = null;
    if (!goalResponse.error) {
      const parsedGoal = z.number().int().nonnegative().safeParse(goalResponse.data);
      individualGoal = parsedGoal.success ? parsedGoal.data : null;
    } else if (!["PGRST202", "42883"].includes(goalResponse.error.code)) {
      throw new Error("Não foi possível carregar a meta de agendamentos.");
    }
    return { analysis, brokerRoster: roster, generatedAt: before.generated_at, individualGoal };
  }
  throw new Error("Os agendamentos foram atualizados durante a leitura. Tente novamente.");
}
