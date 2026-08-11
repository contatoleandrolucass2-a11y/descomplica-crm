import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";

import {
  readModelV3ResponseSchema,
  readModelV3ScopeSchema,
  type ReadModelV3Dataset,
  type ReadModelV3Response,
  type ReadModelV3Scope,
} from "./contracts";
import { toReadModelV3RpcFilters, type ReadModelV3FilterSelection } from "./filters";

export type ReadModelV3LoadResult =
  | { status: "scope_required"; scopes: ReadModelV3Scope[] }
  | { status: "invalid"; reason: "invalid_filter_parameters" | "scope_unavailable" }
  | {
      status: "loaded";
      scopes: ReadModelV3Scope[];
      selection: ReadModelV3FilterSelection;
      model: ReadModelV3Response;
    }
  | { status: "error" };

export function validateReadModelV3Response(
  value: unknown,
  expectedDataset: ReadModelV3Dataset,
  expectedScopeId: string,
): ReadModelV3Response | null {
  const parsed = readModelV3ResponseSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.datasetKey !== expectedDataset ||
    parsed.data.scopeId !== expectedScopeId
  ) {
    return null;
  }
  return parsed.data;
}

export async function loadReadModelV3(
  dataset: ReadModelV3Dataset,
  selection: ReadModelV3FilterSelection,
): Promise<ReadModelV3LoadResult> {
  const supabase = await createClient();
  const scopesResult = await supabase.rpc("list_crm_read_model_v3_scopes");
  if (scopesResult.error) return { status: "error" };

  const scopes = z.array(readModelV3ScopeSchema).safeParse(scopesResult.data ?? []);
  if (!scopes.success) return { status: "error" };

  let scopeId = selection.scopeId;
  if (!scopeId) {
    if (scopes.data.length !== 1) return { status: "scope_required", scopes: scopes.data };
    scopeId = scopes.data[0]!.scope_id;
  }
  if (!scopes.data.some((scope) => scope.scope_id === scopeId)) {
    return { status: "invalid", reason: "scope_unavailable" };
  }

  const resolvedSelection = { ...selection, scopeId };
  const modelResult = await supabase.rpc("get_crm_read_model_v3", {
    p_dataset_key: dataset,
    p_reporting_scope_id: scopeId,
    p_filters: toReadModelV3RpcFilters(resolvedSelection),
  });
  if (modelResult.error) {
    return modelResult.error.code === "22023"
      ? { status: "invalid", reason: "invalid_filter_parameters" }
      : { status: "error" };
  }

  const model = validateReadModelV3Response(modelResult.data, dataset, scopeId);
  if (!model) return { status: "error" };
  return {
    status: "loaded",
    scopes: scopes.data,
    selection: resolvedSelection,
    model,
  };
}
