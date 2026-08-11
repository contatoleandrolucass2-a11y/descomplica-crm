"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import {
  commercialConfigurationDraftPlanSchema,
  type CommercialDraftActionState,
} from "@/lib/crm/commercial-engine/drafts";
import { POINT_METRICS, type PointMetricValues } from "@/lib/crm/points/catalog";

const pointValueSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN),
  z.number().int().min(0).max(100_000),
);
const commandSchema = z.object({
  draftIntent: z.enum(["preview", "save"]),
  draftReason: z.string().trim().min(8).max(500),
  draftRevision: z.coerce.number().int().nonnegative(),
});

function readMetricValues(formData: FormData, prefix: "weight" | "target") {
  const values = {} as PointMetricValues;
  for (const metric of POINT_METRICS) {
    const parsed = pointValueSchema.safeParse(formData.get(`${prefix}.${metric.formKey}`));
    if (!parsed.success) return null;
    values[metric.key] = parsed.data;
  }
  return values;
}

function failure(status: CommercialDraftActionState["status"], message: string) {
  return { status, message } satisfies CommercialDraftActionState;
}

export async function preparePointSettingsDraftAction(
  _state: CommercialDraftActionState,
  formData: FormData,
): Promise<CommercialDraftActionState> {
  await requirePermission("crm.commercial_policy.manage");
  const command = commandSchema.safeParse({
    draftIntent: formData.get("draftIntent"),
    draftReason: formData.get("draftReason"),
    draftRevision: formData.get("draftRevision"),
  });
  const weights = readMetricValues(formData, "weight");
  const targets = readMetricValues(formData, "target");
  if (!command.success || !weights || !targets) {
    return failure("validation_error", "Revise os campos e o motivo do rascunho.");
  }

  const stringify = (values: PointMetricValues) =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
  const payload = {
    schemaVersion: 1,
    kind: "point-settings",
    weights: stringify(weights),
    targets: stringify(targets),
  };
  const supabase = await createClient();
  const previewResult = await supabase.rpc("preview_crm_commercial_configuration_draft", {
    p_engine_key: "points.ranking",
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
      message: "Dry-run concluído. Nenhum peso foi aplicado ou gravado.",
      planFingerprint: preview.data.planHash.slice(0, 12),
      revision: preview.data.currentRevision,
      blockers: preview.data.blockers,
    };
  }

  const saveResult = await supabase.rpc("save_crm_commercial_configuration_draft", {
    p_engine_key: "points.ranking",
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
  revalidatePath("/app/configuracoes/metas/pontos");
  return {
    status: "saved",
    message: `Rascunho inativo salvo na revisão ${revision}.`,
    planFingerprint: saved.data.planHash.slice(0, 12),
    revision,
    blockers: saved.data.blockers,
  };
}
