import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { measureCrmPhase } from "@/lib/crm/performance";
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
  updatedAt?: string;
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
    const response = await measureCrmPhase(
      "appointments",
      "snapshot",
      async () =>
        await supabase
          .from("crm_dashboard_snapshots")
          .select("id,reference_date,generated_at,updated_at")
          .eq("snapshot_key", "global")
          .maybeSingle(),
    );
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
    const [response, roster] = await Promise.all([
      measureCrmPhase(
        "appointments",
        "analysis",
        async () =>
          await supabase.rpc("read_crm_appointments_analysis", {
            p_snapshot_id: before.id,
            p_view_keys: [view],
          }),
      ),
      measureCrmPhase("appointments", "roster", () => brokerRoster(before)),
    ]);
    // Additive rollout: the page can precede the migration without fabricating data.
    if (response.error) {
      const after = await header();
      if (!after || JSON.stringify(before) !== JSON.stringify(after)) continue;
      if (["PGRST202", "42883"].includes(response.error.code))
        return {
          analysis: null,
          brokerRoster: null,
          generatedAt: before.generated_at,
          updatedAt: before.updated_at,
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
    if (rows.length === 0) {
      const after = await header();
      if (!after || JSON.stringify(before) !== JSON.stringify(after)) continue;
      return {
        analysis: null,
        brokerRoster: null,
        generatedAt: before.generated_at,
        updatedAt: before.updated_at,
        individualGoal: null,
        goalsByMonth: {},
        conversionGoals: null,
        conversionGoalsByMonth: {},
      };
    }
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
      const response = await measureCrmPhase(
        "appointments",
        "goals",
        async () =>
          await supabase.rpc("read_crm_appointments_goal", {
            p_reference_date: referenceDate,
          }),
      );
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
      const response = await measureCrmPhase(
        "appointments",
        "goals",
        async () =>
          await supabase.rpc("read_crm_appointments_conversion_goals", {
            p_reference_date: referenceDate,
          }),
      );
      if (response.error) {
        if (["PGRST202", "42883"].includes(response.error.code)) return null;
        throw new Error("Não foi possível carregar as metas de conversão dos agendamentos.");
      }
      const parsed = appointmentConversionGoalsSchema.safeParse(response.data);
      return parsed.success ? parsed.data : null;
    }
    const referenceMonth = before.reference_date.slice(0, 7);
    const historicalMonths: string[] = [];
    const cursor = new Date(`${analysis.coverageStart.slice(0, 7)}-01T12:00:00Z`);
    while (cursor.toISOString().slice(0, 7) < referenceMonth) {
      historicalMonths.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    const months = [...historicalMonths, referenceMonth];
    const goalsByMonth: AppointmentGoalsByMonth = {};
    const conversionGoalsByMonth: AppointmentConversionGoalsByMonth = {};
    // Deployment capability only, never a permission/data cache. Leave disabled
    // until the additive migration has been approved and applied to this environment.
    const rangeEnabled = process.env.CRM_APPOINTMENTS_GOALS_RANGE_ENABLED === "true";
    const range = rangeEnabled
      ? await measureCrmPhase(
          "appointments",
          "goals",
          async () =>
            await supabase.rpc("read_crm_appointments_goals_range", {
              p_start_date: analysis.coverageStart,
              p_reference_date: before.reference_date,
            }),
        )
      : { data: null, error: { code: "PGRST202" } };
    if (range.error && !["PGRST202", "42883"].includes(range.error.code)) {
      throw new Error("N�o foi poss�vel carregar as metas hist�ricas de agendamentos.");
    }
    if (!range.error) {
      const rows = z
        .array(
          z
            .object({
              month: z.string().regex(/^\d{4}-\d{2}$/),
              individualGoal: z.number().int().nonnegative().nullable(),
              conversionGoals: appointmentConversionGoalsSchema.nullable(),
            })
            .strict(),
        )
        .parse(range.data);
      // A partial, duplicate or foreign range must never look like a complete policy read.
      if (
        rows.length !== months.length ||
        new Set(rows.map((row) => row.month)).size !== months.length ||
        rows.some((row) => !months.includes(row.month))
      ) {
        throw new Error("O intervalo de metas n�o corresponde ao snapshot de agendamentos.");
      }
      for (const row of rows) {
        goalsByMonth[row.month] = row.individualGoal;
        conversionGoalsByMonth[row.month] = row.conversionGoals;
      }
    } else {
      // During additive rollout retain the established permission-checked readers.
      // Missing range RPC is the only fallback; denied/failed reads never downgrade.
      for (let offset = 0; offset < months.length; offset += 6) {
        await Promise.all(
          months.slice(offset, offset + 6).map(async (month) => {
            const date = month === referenceMonth ? before.reference_date : `${month}-01`;
            const [goal, conversion] = await Promise.all([
              readGoal(date),
              readConversionGoals(date),
            ]);
            goalsByMonth[month] = goal;
            conversionGoalsByMonth[month] = conversion;
          }),
        );
      }
    }
    const finalHeader = await header();
    if (!finalHeader || JSON.stringify(before) !== JSON.stringify(finalHeader)) continue;
    const individualGoal = goalsByMonth[referenceMonth] ?? null;
    const conversionGoals = conversionGoalsByMonth[referenceMonth] ?? null;
    return {
      analysis,
      brokerRoster: roster,
      generatedAt: before.generated_at,
      updatedAt: before.updated_at,
      individualGoal,
      goalsByMonth,
      conversionGoals,
      conversionGoalsByMonth,
    };
  }
  throw new Error("Os agendamentos foram atualizados durante a leitura. Tente novamente.");
}
