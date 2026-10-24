import "server-only";

import { LeadDataError, resolveLeadScope } from "@/lib/crm/leads/data";

import type { LeadSourceState } from "./LeadWorkspace";

export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export type LeadPageScopeResult = {
  state: LeadSourceState;
  scopes: ReadonlyArray<{ id: string; name: string }>;
  selectedScopeId?: string | undefined;
  invalid: boolean;
};

export async function resolveLeadPageScope(
  params: Record<string, string | string[] | undefined>,
  enabled: boolean,
): Promise<LeadPageScopeResult> {
  if (!enabled) return { state: "not_configured", scopes: [], invalid: false };
  try {
    const requested = firstSearchValue(params.scope) || firstSearchValue(params.escopo);
    const result = await resolveLeadScope(requested || undefined);
    if (result.status === "ready") {
      return {
        state: "ready",
        scopes: result.scopes,
        selectedScopeId: result.scope.id,
        invalid: false,
      };
    }
    if (result.status === "scope_required" || result.status === "invalid") {
      return {
        state: "scope_required",
        scopes: result.scopes,
        invalid: result.status === "invalid",
      };
    }
    return { state: "not_configured", scopes: result.scopes, invalid: false };
  } catch (error) {
    if (error instanceof LeadDataError) return { state: "error", scopes: [], invalid: false };
    throw error;
  }
}
