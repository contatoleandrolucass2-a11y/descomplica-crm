"use server";

import { revalidatePath } from "next/cache";
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
