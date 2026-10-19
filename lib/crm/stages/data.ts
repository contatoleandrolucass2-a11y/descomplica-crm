import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import {
  dashboardAnalysisSliceSchema,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

const headerSchema = z.object({
  id: z.number().int().positive(),
  reference_date: z.iso.date(),
  generated_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export interface AppointmentsReadModel {
  analysis: DashboardAnalysisSlice | null;
  generatedAt?: string;
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = await header();
    if (!before) return { analysis: null };
    const response = await supabase.rpc("read_crm_appointments_analysis", {
      p_snapshot_id: before.id,
      p_view_keys: [view],
    });
    const after = await header();
    if (!after || JSON.stringify(before) !== JSON.stringify(after)) continue;
    // Additive rollout: the page can precede the migration without fabricating data.
    if (response.error) {
      if (["PGRST202", "42883"].includes(response.error.code)) return { analysis: null };
      throw new Error("Não foi possível carregar os gráficos de agendamentos.");
    }
    const rows = z
      .array(z.object({ view_key: z.string(), payload: z.unknown() }))
      .parse(response.data);
    if (rows.length === 0) return { analysis: null };
    if (rows.length !== 1 || rows[0]!.view_key !== view) {
      throw new Error("A análise não corresponde à visão autorizada.");
    }
    const analysis = dashboardAnalysisSliceSchema.parse(rows[0]!.payload);
    if (
      analysis.viewKey !== view ||
      analysis.referenceDate !== before.reference_date ||
      analysis.facts.some((fact) => fact[0] !== 1)
    ) {
      throw new Error("A análise não corresponde ao snapshot de agendamentos.");
    }
    return { analysis, generatedAt: before.generated_at };
  }
  throw new Error("Os agendamentos foram atualizados durante a leitura. Tente novamente.");
}
