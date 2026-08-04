"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import { POINT_METRICS, type PointMetricValues } from "@/lib/crm/points/catalog";

const pointValueSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN),
  z.number().int().min(0).max(100_000),
);

function readMetricValues(formData: FormData, prefix: "weight" | "target") {
  const values = {} as PointMetricValues;

  for (const metric of POINT_METRICS) {
    const parsed = pointValueSchema.safeParse(formData.get(`${prefix}.${metric.formKey}`));
    if (!parsed.success) return null;
    values[metric.key] = parsed.data;
  }

  return values;
}

export async function savePointSettingsAction(formData: FormData): Promise<void> {
  await requirePermission("crm.settings.manage");

  const weights = readMetricValues(formData, "weight");
  const targets = readMetricValues(formData, "target");

  if (!weights || !targets) redirect("/app/configuracoes/metas/pontos?error=validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_crm_point_settings", {
    p_weights: weights,
    p_targets: targets,
  });

  if (error) redirect("/app/configuracoes/metas/pontos?error=save");

  revalidatePath("/app/configuracoes/metas/pontos");
  revalidatePath("/app/ranking");
  redirect("/app/configuracoes/metas/pontos?saved=1");
}
