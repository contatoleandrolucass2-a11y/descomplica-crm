import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import {
  dashboardAnalysisSliceSchema,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

import type { AppointmentBrokerRosterEntry, AppointmentGoalsByMonth } from "./appointments";

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

const conversionGoalSchema = z
  .object({
    opportunityAppointment: z.number().finite().nonnegative().nullable(),
    appointmentVisit: z.number().finite().nonnegative().nullable(),
    appointmentFolder: z.number().finite().nonnegative().nullable(),
    appointmentApprovedFolder: z.number().finite().nonnegative().nullable(),
    appointmentSale: z.number().finite().nonnegative().nullable(),
    monthlyFunnel: z
      .object({
        opportunities: z.number().int().nonnegative(),
        appointments: z.number().int().nonnegative(),
        visits: z.number().int().nonnegative(),
        folders: z.number().int().nonnegative(),
        approvedFolders: z.number().int().nonnegative(),
        sales: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const appointmentConversionGoalsSchema = z
  .object({
    dv: conversionGoalSchema.nullable(),
    partnerships: conversionGoalSchema.nullable(),
  })
  .strict();

export type AppointmentConversionGoals = z.infer<typeof appointmentConversionGoalsSchema>;
export type AppointmentConversionGoalsByMonth = Record<string, AppointmentConversionGoals | null>;

export interface AppointmentsReadModel {
  analysis: DashboardAnalysisSlice | null;
  brokerRoster: AppointmentBrokerRosterEntry[] | null;
  generatedAt?: string;
  individualGoal: number | null;
  goalsByMonth: AppointmentGoalsByMonth;
  conversionGoals: AppointmentConversionGoals | null;
  conversionGoalsByMonth: AppointmentConversionGoalsByMonth;
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
    if (!before)
      return {
        analysis: null,
        brokerRoster: null,
        individualGoal: null,
        goalsByMonth: {},
        conversionGoals: null,
        conversionGoalsByMonth: {},
      };
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
        return {
          analysis: null,
          brokerRoster: null,
          individualGoal: null,
          goalsByMonth: {},
          conversionGoals: null,
          conversionGoalsByMonth: {},
        };
      throw new Error("Não foi possível carregar os gráficos de agendamentos.");
    }
    const rows = z
      .array(z.object({ view_key: z.string(), payload: z.unknown() }))
      .parse(response.data);
    if (rows.length === 0)
      return {
        analysis: null,
        brokerRoster: null,
        individualGoal: null,
        goalsByMonth: {},
        conversionGoals: null,
        conversionGoalsByMonth: {},
      };
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
    async function readGoal(referenceDate: string): Promise<number | null> {
      const response = await supabase.rpc("read_crm_appointments_goal", {
        p_reference_date: referenceDate,
      });
      if (response.error) {
        if (["PGRST202", "42883"].includes(response.error.code)) return null;
        throw new Error("Não foi possível carregar a meta de agendamentos.");
      }
      const parsed = z.number().int().nonnegative().safeParse(response.data);
      return parsed.success ? parsed.data : null;
    }
    async function readConversionGoals(
      referenceDate: string,
    ): Promise<AppointmentConversionGoals | null> {
      const response = await supabase.rpc("read_crm_appointments_conversion_goals", {
        p_reference_date: referenceDate,
      });
      if (response.error) {
        if (["PGRST202", "42883"].includes(response.error.code)) return null;
        throw new Error("Não foi possível carregar as metas de conversão dos agendamentos.");
      }
      const parsed = appointmentConversionGoalsSchema.safeParse(response.data);
      return parsed.success ? parsed.data : null;
    }
    const individualGoal = await readGoal(before.reference_date);
    const conversionGoals = await readConversionGoals(before.reference_date);
    const referenceMonth = before.reference_date.slice(0, 7);
    const goalsByMonth: AppointmentGoalsByMonth = { [referenceMonth]: individualGoal };
    const conversionGoalsByMonth: AppointmentConversionGoalsByMonth = {
      [referenceMonth]: conversionGoals,
    };
    // Resolve each historical month through the same permission-checked RPC.
    // Never copy today's policy backwards or query the private policy table.
    const historicalMonths: string[] = [];
    const cursor = new Date(`${analysis.coverageStart.slice(0, 7)}-01T12:00:00Z`);
    while (cursor.toISOString().slice(0, 7) < referenceMonth) {
      historicalMonths.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (let offset = 0; offset < historicalMonths.length; offset += 6) {
      await Promise.all(
        historicalMonths.slice(offset, offset + 6).map(async (month) => {
          goalsByMonth[month] = await readGoal(`${month}-01`);
          conversionGoalsByMonth[month] = await readConversionGoals(`${month}-01`);
        }),
      );
    }
    return {
      analysis,
      brokerRoster: roster,
      generatedAt: before.generated_at,
      individualGoal,
      goalsByMonth,
      conversionGoals,
      conversionGoalsByMonth,
    };
  }
  throw new Error("Os agendamentos foram atualizados durante a leitura. Tente novamente.");
}
