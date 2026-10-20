"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import {
  commercialConfigurationDraftPlanSchema,
  type CommercialDraftActionState,
} from "@/lib/crm/commercial-engine/drafts";
import { GOAL_PROFILES, getEffectiveMonth, type GoalProfileKey } from "@/lib/crm/goals/catalog";

const requiredNumber = (maximum: number, integer = false) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN),
    integer
      ? z.number().finite().int().min(0).max(maximum)
      : z.number().finite().min(0).max(maximum),
  );

const goalsInputSchema = z.object({
  sales: requiredNumber(10_000_000, true),
  opportunitiesRate: requiredNumber(10_000),
  appointmentsRate: requiredNumber(10_000),
  visitsRate: requiredNumber(10_000),
  foldersRate: requiredNumber(10_000),
  approvedFoldersRate: requiredNumber(10_000),
  brokerMinimumMonth1: requiredNumber(100_000, true),
  brokerMinimumMonth2: requiredNumber(100_000, true),
  brokerMinimumMonth3: requiredNumber(100_000, true),
  brokerMinimumMonth4Plus: requiredNumber(100_000, true),
  brokerWeeklyAppointments: requiredNumber(100_000, true),
  brokerWeeklyVisits: requiredNumber(100_000, true),
  brokerWeeklyFolders: requiredNumber(100_000, true),
  productiveTeamAppointments: requiredNumber(100, true),
  productiveTeamVisits: requiredNumber(100, true),
  productiveTeamFolders: requiredNumber(100, true),
  productiveTeamSales: requiredNumber(100, true),
});

const effectiveMonthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])-01$/);

const commandSchema = z.object({
  draftIntent: z.enum(["preview", "save"]),
  draftReason: z.string().trim().min(8).max(500),
  draftRevision: z.coerce.number().int().nonnegative(),
});

function isGoalProfile(value: string): value is GoalProfileKey {
  return Object.prototype.hasOwnProperty.call(GOAL_PROFILES, value);
}

function formValues(formData: FormData) {
  return Object.fromEntries(
    Object.keys(goalsInputSchema.shape).map((key) => [key, formData.get(key)]),
  );
}

function failure(status: CommercialDraftActionState["status"], message: string) {
  return { status, message } satisfies CommercialDraftActionState;
}

export async function saveFunnelGoalsAction(
  profileInput: string,
  formData: FormData,
): Promise<void> {
  await requirePermission("crm.settings.manage");
  if (!isGoalProfile(profileInput)) redirect("/app/configuracoes/metas?error=validation");
  const profilePath = GOAL_PROFILES[profileInput].href;

  const values = goalsInputSchema.safeParse(formValues(formData));
  const effectiveMonth = effectiveMonthSchema.safeParse(formData.get("effectiveMonth"));
  if (!values.success || !effectiveMonth.success) {
    redirect(`${profilePath}?error=validation`);
  }
  if (effectiveMonth.data !== getEffectiveMonth()) {
    redirect(`${profilePath}?error=stale`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_crm_funnel_goals", {
    p_profile_key: profileInput,
    p_effective_month: effectiveMonth.data,
    p_sales: values.data.sales,
    p_opportunities_rate: values.data.opportunitiesRate,
    p_appointments_rate: values.data.appointmentsRate,
    p_visits_rate: values.data.visitsRate,
    p_folders_rate: values.data.foldersRate,
    p_approved_folders_rate: values.data.approvedFoldersRate,
    p_broker_minimum_month_1: values.data.brokerMinimumMonth1,
    p_broker_minimum_month_2: values.data.brokerMinimumMonth2,
    p_broker_minimum_month_3: values.data.brokerMinimumMonth3,
    p_broker_minimum_month_4_plus: values.data.brokerMinimumMonth4Plus,
    p_broker_weekly_appointments: values.data.brokerWeeklyAppointments,
    p_broker_weekly_visits: values.data.brokerWeeklyVisits,
    p_broker_weekly_folders: values.data.brokerWeeklyFolders,
    p_productive_team_appointments: values.data.productiveTeamAppointments,
    p_productive_team_visits: values.data.productiveTeamVisits,
    p_productive_team_folders: values.data.productiveTeamFolders,
    p_productive_team_sales: values.data.productiveTeamSales,
  });

  if (error) redirect(`${profilePath}?error=save`);
  revalidatePath(profilePath);
  redirect(`${profilePath}?saved=active`);
}

export async function prepareFunnelGoalsDraftAction(
  profileInput: string,
  _state: CommercialDraftActionState,
  formData: FormData,
): Promise<CommercialDraftActionState> {
  await requirePermission("crm.commercial_policy.manage");
  if (!isGoalProfile(profileInput)) return failure("validation_error", "Perfil inválido.");

  const command = commandSchema.safeParse({
    draftIntent: formData.get("draftIntent"),
    draftReason: formData.get("draftReason"),
    draftRevision: formData.get("draftRevision"),
  });
  const values = goalsInputSchema.safeParse(formValues(formData));
  if (!command.success || !values.success) {
    return failure("validation_error", "Revise os campos e o motivo do rascunho.");
  }

  const engineKey = profileInput === "dv" ? "goals.dv" : "goals.partnerships";
  const payload = {
    schemaVersion: 1,
    kind: "funnel-goals",
    profile: profileInput,
    effectiveMonth: getEffectiveMonth(),
    values: Object.fromEntries(
      Object.entries(values.data).map(([key, value]) => [key, String(value)]),
    ),
  };
  const supabase = await createClient();
  const previewResult = await supabase.rpc("preview_crm_commercial_configuration_draft", {
    p_engine_key: engineKey,
    p_payload: payload,
    p_expected_revision: command.data.draftRevision,
  });
  const preview = commercialConfigurationDraftPlanSchema.safeParse(previewResult.data);
  if (previewResult.error || !preview.success || !preview.data.valid) {
    return failure(
      preview.success && preview.data.reasonCode === "stale_revision" ? "conflict" : "error",
      preview.success && preview.data.reasonCode === "stale_revision"
        ? "O rascunho mudou em outra sessão. Recarregue antes de continuar."
        : "Não foi possível validar o rascunho de forma segura.",
    );
  }

  if (command.data.draftIntent === "preview") {
    return {
      status: "previewed",
      message: "Dry-run concluído. Nenhuma configuração foi aplicada ou gravada.",
      planFingerprint: preview.data.planHash.slice(0, 12),
      revision: preview.data.currentRevision,
      blockers: preview.data.blockers,
    };
  }

  const saveResult = await supabase.rpc("save_crm_commercial_configuration_draft", {
    p_engine_key: engineKey,
    p_payload: payload,
    p_expected_revision: command.data.draftRevision,
    p_expected_plan_hash: preview.data.planHash,
    p_reason: command.data.draftReason,
  });
  const saved = commercialConfigurationDraftPlanSchema.safeParse(saveResult.data);
  if (
    saveResult.error ||
    !saved.success ||
    saved.data.mode !== "save" ||
    saved.data.revision === undefined
  ) {
    return failure(
      saveResult.error?.code === "23505" ? "conflict" : "error",
      saveResult.error?.code === "23505"
        ? "O plano ficou desatualizado. Recarregue e valide novamente."
        : "Não foi possível salvar o rascunho.",
    );
  }
  const revision = saved.data.revision;

  revalidatePath(GOAL_PROFILES[profileInput].href);
  return {
    status: "saved",
    message: `Rascunho inativo salvo na revisão ${revision}.`,
    planFingerprint: saved.data.planHash.slice(0, 12),
    revision,
    blockers: saved.data.blockers,
  };
}
