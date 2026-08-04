import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { POINT_METRICS, type PointMetricValues } from "./catalog";

const settingSchema = z.object({ updated_at: z.string() });
const metricSchema = z.object({
  metric_key: z.string(),
  weight: z.coerce.number().int().min(0).max(100_000),
  target: z.coerce.number().int().min(0).max(100_000),
});

export type PointSettingsLoadResult =
  | { status: "empty" }
  | {
      status: "ready";
      weights: PointMetricValues;
      targets: PointMetricValues;
      updatedAt: string;
    };

export async function loadPointSettings(): Promise<PointSettingsLoadResult> {
  const supabase = await createClient();
  const settingResult = await supabase
    .from("crm_point_settings")
    .select("updated_at")
    .eq("setting_key", "default")
    .maybeSingle();

  if (settingResult.error) throw new Error("Não foi possível carregar a configuração de pontos.");
  if (!settingResult.data) return { status: "empty" };

  const metricsResult = await supabase
    .from("crm_point_metrics")
    .select("metric_key,weight,target")
    .eq("setting_key", "default");

  if (metricsResult.error) throw new Error("Não foi possível carregar as métricas de pontos.");

  const setting = settingSchema.parse(settingResult.data);
  const rows = z.array(metricSchema).parse(metricsResult.data ?? []);
  const weights = {} as PointMetricValues;
  const targets = {} as PointMetricValues;

  for (const metric of POINT_METRICS) {
    const row = rows.find((item) => item.metric_key === metric.key);
    if (!row) throw new Error("A configuração de pontos está incompleta.");
    weights[metric.key] = row.weight;
    targets[metric.key] = row.target;
  }

  return { status: "ready", weights, targets, updatedAt: setting.updated_at };
}
