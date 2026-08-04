import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { getEffectiveMonth, type GoalProfileKey } from "./catalog";

const goalRowSchema = z.object({
  profile_key: z.enum(["dv", "partnerships"]),
  effective_month: z.string(),
  opportunities: z.coerce.number().int().nonnegative(),
  appointments: z.coerce.number().int().nonnegative(),
  visits: z.coerce.number().int().nonnegative(),
  folders: z.coerce.number().int().nonnegative(),
  approved_folders: z.coerce.number().int().nonnegative(),
  sales: z.coerce.number().int().nonnegative(),
  opportunities_rate: z.coerce.number().nonnegative(),
  appointments_rate: z.coerce.number().nonnegative(),
  visits_rate: z.coerce.number().nonnegative(),
  folders_rate: z.coerce.number().nonnegative(),
  approved_folders_rate: z.coerce.number().nonnegative(),
  broker_minimum_month_1: z.coerce.number().int().nonnegative(),
  broker_minimum_month_2: z.coerce.number().int().nonnegative(),
  broker_minimum_month_3: z.coerce.number().int().nonnegative(),
  broker_minimum_month_4_plus: z.coerce.number().int().nonnegative(),
  broker_weekly_appointments: z.coerce.number().int().nonnegative(),
  broker_weekly_visits: z.coerce.number().int().nonnegative(),
  broker_weekly_folders: z.coerce.number().int().nonnegative(),
  productive_team_appointments: z.coerce.number().int().nonnegative(),
  productive_team_visits: z.coerce.number().int().nonnegative(),
  productive_team_folders: z.coerce.number().int().nonnegative(),
  productive_team_sales: z.coerce.number().int().nonnegative(),
  updated_at: z.string(),
});

export type FunnelGoals = {
  profileKey: GoalProfileKey;
  effectiveMonth: string;
  opportunities: number;
  appointments: number;
  visits: number;
  folders: number;
  approvedFolders: number;
  sales: number;
  opportunitiesRate: number;
  appointmentsRate: number;
  visitsRate: number;
  foldersRate: number;
  approvedFoldersRate: number;
  brokerMinimumMonth1: number;
  brokerMinimumMonth2: number;
  brokerMinimumMonth3: number;
  brokerMinimumMonth4Plus: number;
  brokerWeeklyAppointments: number;
  brokerWeeklyVisits: number;
  brokerWeeklyFolders: number;
  productiveTeamAppointments: number;
  productiveTeamVisits: number;
  productiveTeamFolders: number;
  productiveTeamSales: number;
  updatedAt: string;
};

export type FunnelGoalsLoadResult =
  | { status: "empty"; effectiveMonth: string }
  | { status: "ready"; goals: FunnelGoals };

export async function loadFunnelGoals(profile: GoalProfileKey): Promise<FunnelGoalsLoadResult> {
  const effectiveMonth = getEffectiveMonth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_funnel_goals")
    .select(
      "profile_key,effective_month,opportunities,appointments,visits,folders,approved_folders,sales,opportunities_rate,appointments_rate,visits_rate,folders_rate,approved_folders_rate,broker_minimum_month_1,broker_minimum_month_2,broker_minimum_month_3,broker_minimum_month_4_plus,broker_weekly_appointments,broker_weekly_visits,broker_weekly_folders,productive_team_appointments,productive_team_visits,productive_team_folders,productive_team_sales,updated_at",
    )
    .eq("profile_key", profile)
    .eq("effective_month", effectiveMonth)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar as metas do funil.");
  if (!data) return { status: "empty", effectiveMonth };

  const row = goalRowSchema.parse(data);
  return {
    status: "ready",
    goals: {
      profileKey: row.profile_key,
      effectiveMonth: row.effective_month,
      opportunities: row.opportunities,
      appointments: row.appointments,
      visits: row.visits,
      folders: row.folders,
      approvedFolders: row.approved_folders,
      sales: row.sales,
      opportunitiesRate: row.opportunities_rate,
      appointmentsRate: row.appointments_rate,
      visitsRate: row.visits_rate,
      foldersRate: row.folders_rate,
      approvedFoldersRate: row.approved_folders_rate,
      brokerMinimumMonth1: row.broker_minimum_month_1,
      brokerMinimumMonth2: row.broker_minimum_month_2,
      brokerMinimumMonth3: row.broker_minimum_month_3,
      brokerMinimumMonth4Plus: row.broker_minimum_month_4_plus,
      brokerWeeklyAppointments: row.broker_weekly_appointments,
      brokerWeeklyVisits: row.broker_weekly_visits,
      brokerWeeklyFolders: row.broker_weekly_folders,
      productiveTeamAppointments: row.productive_team_appointments,
      productiveTeamVisits: row.productive_team_visits,
      productiveTeamFolders: row.productive_team_folders,
      productiveTeamSales: row.productive_team_sales,
      updatedAt: row.updated_at,
    },
  };
}
