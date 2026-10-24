import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";

import {
  leadDetailSchema,
  leadActivitiesFiltersSchema,
  leadActivitiesResultSchema,
  leadCatalogsSchema,
  leadFiltersSchema,
  leadListResultSchema,
  leadFunnelFiltersSchema,
  leadFunnelResultSchema,
  leadMutationCommandSchema,
  leadMutationResultSchema,
  leadSaveCommandSchema,
  leadScopesSchema,
  type LeadDetail,
  type LeadActivitiesFilters,
  type LeadActivitiesResult,
  type LeadCatalogs,
  type LeadFilters,
  type LeadListResult,
  type LeadFunnelFilters,
  type LeadFunnelResult,
  type LeadMutationCommand,
  type LeadMutationResult,
  type LeadSaveCommand,
  type LeadScope,
} from "./contracts";

export class LeadDataError extends Error {
  constructor(
    readonly kind:
      | "validation"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "LeadDataError";
  }
}

function mapRpcError(error: { code?: string; message?: string }): LeadDataError {
  if (error.code === "22023")
    return new LeadDataError("validation", "Os dados do lead são inválidos.");
  if (error.code === "28000")
    return new LeadDataError("unauthorized", "A sessão não está autorizada.");
  if (error.code === "42501")
    return new LeadDataError("forbidden", "A conta não autoriza esta operação.");
  if (error.code === "P0002") return new LeadDataError("not_found", "Lead não encontrado.");
  if (error.code === "40001" || error.code === "23505") {
    return new LeadDataError(
      "conflict",
      "O lead mudou em outra sessão. Recarregue antes de continuar.",
    );
  }
  return new LeadDataError("unavailable", "O módulo de leads está temporariamente indisponível.");
}

export type LeadScopeResolution =
  | { status: "not_configured"; scopes: [] }
  | { status: "scope_required"; scopes: LeadScope[] }
  | { status: "invalid"; scopes: LeadScope[] }
  | { status: "ready"; scope: LeadScope; scopes: LeadScope[] };

export async function resolveLeadScope(requestedScopeId?: string): Promise<LeadScopeResolution> {
  const supabase = await createClient();
  const result = await supabase.rpc("list_crm_lead_scopes_v1");
  if (result.error) throw mapRpcError(result.error);
  const parsed = leadScopesSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new LeadDataError("unavailable", "A resposta de escopos de leads é inválida.");
  }
  const scopes = parsed.data;
  if (scopes.length === 0) return { status: "not_configured", scopes: [] };
  if (requestedScopeId) {
    const scope = scopes.find(({ id }) => id === requestedScopeId);
    return scope ? { status: "ready", scope, scopes } : { status: "invalid", scopes };
  }
  if (scopes.length === 1) return { status: "ready", scope: scopes[0]!, scopes };
  return { status: "scope_required", scopes };
}

export async function getLeadCatalogs(organizationId: string): Promise<LeadCatalogs> {
  const parsedId = z.string().uuid().safeParse(organizationId);
  if (!parsedId.success) throw new LeadDataError("validation", "O escopo de leads é inválido.");
  const supabase = await createClient();
  const result = await supabase.rpc("get_crm_lead_catalogs_v1", {
    p_organization_id: parsedId.data,
  });
  if (result.error) throw mapRpcError(result.error);
  const parsed = leadCatalogsSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new LeadDataError("unavailable", "A resposta dos catálogos de leads é inválida.");
  }
  return parsed.data;
}

export async function listLeads(filters: LeadFilters): Promise<LeadListResult> {
  const parsed = leadFiltersSchema.safeParse(filters);
  if (!parsed.success) throw new LeadDataError("validation", "Os filtros de leads são inválidos.");
  const supabase = await createClient();
  const result = await supabase.rpc("list_crm_leads_v1", { p_filters: parsed.data });
  if (result.error) throw mapRpcError(result.error);
  const data = leadListResultSchema.safeParse(result.data);
  if (!data.success)
    throw new LeadDataError("unavailable", "A resposta da lista de leads é inválida.");
  return data.data;
}

export async function listLeadActivities(
  filters: LeadActivitiesFilters,
): Promise<LeadActivitiesResult> {
  const parsed = leadActivitiesFiltersSchema.safeParse(filters);
  if (!parsed.success)
    throw new LeadDataError("validation", "Os filtros de atividades são inválidos.");
  const supabase = await createClient();
  const result = await supabase.rpc("list_crm_lead_activities_v1", { p_filters: parsed.data });
  if (result.error) throw mapRpcError(result.error);
  const data = leadActivitiesResultSchema.safeParse(result.data);
  if (!data.success)
    throw new LeadDataError("unavailable", "A resposta das atividades é inválida.");
  return data.data;
}

export async function getLeadFunnel(filters: LeadFunnelFilters): Promise<LeadFunnelResult> {
  const parsed = leadFunnelFiltersSchema.safeParse(filters);
  if (!parsed.success) throw new LeadDataError("validation", "Os filtros do funil são inválidos.");
  const { organizationId, ...rpcFilters } = parsed.data;
  const supabase = await createClient();
  const result = await supabase.rpc("get_crm_lead_funnel_v1", {
    p_organization_id: organizationId,
    p_filters: rpcFilters,
  });
  if (result.error) throw mapRpcError(result.error);
  const data = leadFunnelResultSchema.safeParse(result.data);
  if (!data.success) throw new LeadDataError("unavailable", "A resposta do funil é inválida.");
  return data.data;
}

export async function getLead(leadId: string): Promise<LeadDetail> {
  const parsedId = z.string().uuid().safeParse(leadId);
  if (!parsedId.success)
    throw new LeadDataError("validation", "O identificador do lead é inválido.");
  const supabase = await createClient();
  const result = await supabase.rpc("get_crm_lead_v1", { p_lead_id: parsedId.data });
  if (result.error) throw mapRpcError(result.error);
  const data = leadDetailSchema.safeParse(result.data);
  if (!data.success) throw new LeadDataError("unavailable", "A resposta do lead é inválida.");
  return data.data;
}

export async function saveLead(command: LeadSaveCommand): Promise<LeadMutationResult> {
  const parsed = leadSaveCommandSchema.safeParse(command);
  if (!parsed.success) throw new LeadDataError("validation", "Revise os dados do lead.");
  const supabase = await createClient();
  const result = await supabase.rpc("save_crm_lead_v1", {
    p_lead_id: parsed.data.leadId,
    p_expected_version: parsed.data.expectedVersion,
    p_input: parsed.data.input,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) throw mapRpcError(result.error);
  const data = leadMutationResultSchema.safeParse(result.data);
  if (!data.success) throw new LeadDataError("unavailable", "A resposta da gravação é inválida.");
  return data.data;
}

export async function mutateLead(command: LeadMutationCommand): Promise<LeadMutationResult> {
  const parsed = leadMutationCommandSchema.safeParse(command);
  if (!parsed.success) throw new LeadDataError("validation", "Revise a operação do lead.");
  const supabase = await createClient();
  const result = await supabase.rpc("mutate_crm_lead_v1", {
    p_lead_id: parsed.data.leadId,
    p_operation: parsed.data.operation,
    p_payload: parsed.data.payload,
    p_expected_version: parsed.data.expectedVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) throw mapRpcError(result.error);
  const data = leadMutationResultSchema.safeParse(result.data);
  if (!data.success) throw new LeadDataError("unavailable", "A resposta da operação é inválida.");
  return data.data;
}
