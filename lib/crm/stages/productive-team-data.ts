import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import {
  dashboardAnalysisSliceSchema,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

import type { AppointmentBrokerRosterEntry } from "./appointments";

const stageSchema = z.enum(["appointments", "visits", "folders", "sales"]);
export type ProductiveTeamStage = z.infer<typeof stageSchema>;
const stages: ProductiveTeamStage[] = ["appointments", "visits", "folders", "sales"];
const envelopeSchema = z
  .object({
    analysis: dashboardAnalysisSliceSchema,
    brokerRoster: z
      .array(
        z
          .object({
            key: z
              .string()
              .max(100)
              .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/),
            owner: z.string().trim().min(1).max(200),
            manager: z.string().trim().min(1).max(200),
            regionalManager: z.string().trim().min(1).max(200).nullable().optional(),
          })
          .strict(),
      )
      .max(1_000)
      .nullable(),
    generatedAt: z.string().datetime({ offset: true }),
    availableStages: z.array(stageSchema).max(4),
  })
  .strict();

export interface ProductiveTeamReadModel {
  analysis: DashboardAnalysisSlice | null;
  brokerRoster: AppointmentBrokerRosterEntry[] | null;
  generatedAt?: string;
  availableStages: ProductiveTeamStage[];
}

const missingRpc = (error: { code: string; message?: string }, name: string) =>
  error.code === "PGRST202" ||
  (error.code === "42883" &&
    typeof error.message === "string" &&
    error.message.includes(`${name}(`) &&
    /does not exist/i.test(error.message));

/** A single stable RPC reads one consistent snapshot and its matching roster. */
export async function loadProductiveTeamReadModel(
  view: DashboardViewKey,
): Promise<ProductiveTeamReadModel> {
  const empty: ProductiveTeamReadModel = {
    analysis: null,
    brokerRoster: null,
    availableStages: [],
  };
  const supabase = await createClient();
  let response = await supabase.rpc("read_crm_productive_team_v2", { p_view_key: view });
  if (response.error && missingRpc(response.error, "read_crm_productive_team_v2"))
    response = await supabase.rpc("read_crm_productive_team", { p_view_key: view });
  if (response.error) {
    // Code can precede additive catalog/RPC activation without inventing results.
    if (missingRpc(response.error, "read_crm_productive_team")) return empty;
    throw new Error("Não foi possível carregar a equipe produtiva.");
  }
  if (response.data === null) return empty;
  const result = envelopeSchema.parse(response.data);
  if (
    result.analysis.version !== 4 ||
    result.analysis.viewKey !== view ||
    new Set(result.availableStages).size !== result.availableStages.length ||
    new Set(result.brokerRoster?.map((broker) => broker.key)).size !==
      (result.brokerRoster?.length ?? 0) ||
    result.analysis.facts.some((fact) => !result.availableStages.includes(stages[fact[0] - 1]!))
  )
    throw new Error("A análise não corresponde à equipe produtiva autorizada.");
  return {
    ...result,
    brokerRoster:
      result.brokerRoster?.map(({ regionalManager, ...member }) =>
        regionalManager === undefined ? member : { ...member, regionalManager },
      ) ?? null,
  };
}
