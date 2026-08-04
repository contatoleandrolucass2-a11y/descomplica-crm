"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import { GOAL_PROFILES, getEffectiveMonth, type GoalProfileKey } from "@/lib/crm/goals/catalog";

const requiredNumber = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN),
    z.number().finite().min(0).max(maximum),
  );

const goalsInputSchema = z.object({
  sales: requiredNumber(10_000_000).pipe(z.number().int()),
  opportunitiesRate: requiredNumber(10_000),
  appointmentsRate: requiredNumber(10_000),
  visitsRate: requiredNumber(10_000),
  foldersRate: requiredNumber(10_000),
  approvedFoldersRate: requiredNumber(10_000),
  brokerMinimumMonth1: requiredNumber(100_000).pipe(z.number().int()),
  brokerMinimumMonth2: requiredNumber(100_000).pipe(z.number().int()),
  brokerMinimumMonth3: requiredNumber(100_000).pipe(z.number().int()),
  brokerMinimumMonth4Plus: requiredNumber(100_000).pipe(z.number().int()),
  brokerWeeklyAppointments: requiredNumber(100_000).pipe(z.number().int()),
  brokerWeeklyVisits: requiredNumber(100_000).pipe(z.number().int()),
  brokerWeeklyFolders: requiredNumber(100_000).pipe(z.number().int()),
  productiveTeamAppointments: requiredNumber(100).pipe(z.number().int()),
  productiveTeamVisits: requiredNumber(100).pipe(z.number().int()),
  productiveTeamFolders: requiredNumber(100).pipe(z.number().int()),
  productiveTeamSales: requiredNumber(100).pipe(z.number().int()),
});

function isGoalProfile(value: string): value is GoalProfileKey {
  return Object.prototype.hasOwnProperty.call(GOAL_PROFILES, value);
}

function formValues(formData: FormData) {
  return Object.fromEntries(
    [
      "sales",
      "opportunitiesRate",
      "appointmentsRate",
      "visitsRate",
      "foldersRate",
      "approvedFoldersRate",
      "brokerMinimumMonth1",
      "brokerMinimumMonth2",
      "brokerMinimumMonth3",
      "brokerMinimumMonth4Plus",
      "brokerWeeklyAppointments",
      "brokerWeeklyVisits",
      "brokerWeeklyFolders",
      "productiveTeamAppointments",
      "productiveTeamVisits",
      "productiveTeamFolders",
      "productiveTeamSales",
    ].map((key) => [key, formData.get(key)]),
  );
}

export async function saveFunnelGoalsAction(
  profileInput: string,
  formData: FormData,
): Promise<void> {
  await requirePermission("crm.settings.manage");

  if (!isGoalProfile(profileInput)) throw new Error("Perfil de metas inválido.");
  const profile = profileInput;
  const path = GOAL_PROFILES[profile].href;
  const parsed = goalsInputSchema.safeParse(formValues(formData));

  if (!parsed.success) redirect(`${path}?error=validation`);

  const values = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_crm_funnel_goals", {
    p_profile_key: profile,
    p_effective_month: getEffectiveMonth(),
    p_sales: values.sales,
    p_opportunities_rate: values.opportunitiesRate,
    p_appointments_rate: values.appointmentsRate,
    p_visits_rate: values.visitsRate,
    p_folders_rate: values.foldersRate,
    p_approved_folders_rate: values.approvedFoldersRate,
    p_broker_minimum_month_1: values.brokerMinimumMonth1,
    p_broker_minimum_month_2: values.brokerMinimumMonth2,
    p_broker_minimum_month_3: values.brokerMinimumMonth3,
    p_broker_minimum_month_4_plus: values.brokerMinimumMonth4Plus,
    p_broker_weekly_appointments: values.brokerWeeklyAppointments,
    p_broker_weekly_visits: values.brokerWeeklyVisits,
    p_broker_weekly_folders: values.brokerWeeklyFolders,
    p_productive_team_appointments: values.productiveTeamAppointments,
    p_productive_team_visits: values.productiveTeamVisits,
    p_productive_team_folders: values.productiveTeamFolders,
    p_productive_team_sales: values.productiveTeamSales,
  });

  if (error) redirect(`${path}?error=save`);

  revalidatePath(path);
  revalidatePath("/app");
  redirect(`${path}?saved=1`);
}
