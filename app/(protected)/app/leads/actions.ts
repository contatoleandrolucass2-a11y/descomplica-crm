"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/authorization/guards";
import {
  leadActivityTypeSchema,
  leadMutationCommandSchema,
  leadSaveCommandSchema,
  type LeadMutationCommand,
  type LeadMutationResult,
  type LeadSaveCommand,
} from "@/lib/crm/leads/contracts";
import {
  getLead,
  getLeadCatalogs,
  LeadDataError,
  mutateLead,
  resolveLeadScope,
  saveLead,
} from "@/lib/crm/leads/data";

const mutationPermissions = {
  assign: "crm.leads.assign",
  move_stage: "crm.leads.stage.move",
  set_favorite: "crm.leads.edit",
  archive: "crm.leads.archive",
  rescue: "crm.leads.archive",
  close: "crm.leads.close",
  add_activity: "crm.leads.activities.manage",
  update_activity: "crm.leads.activities.manage",
  delete_activity: "crm.leads.activities.manage",
  add_message: "crm.leads.messages.manage",
  delete_message: "crm.leads.messages.manage",
  set_tags: "crm.leads.tags.manage",
} as const;

function revalidateLeadViews(leadId?: string) {
  revalidatePath("/app/leads");
  revalidatePath("/app/leads/lista");
  revalidatePath("/app/leads/atividades");
  revalidatePath("/app/leads/funil");
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
}

export async function saveLeadAction(command: LeadSaveCommand): Promise<LeadMutationResult> {
  const parsed = leadSaveCommandSchema.parse(command);
  await requirePermission(parsed.leadId === null ? "crm.leads.create" : "crm.leads.edit");
  const result = await saveLead(parsed);
  revalidateLeadViews(result.id);
  return result;
}

export async function mutateLeadAction(command: LeadMutationCommand): Promise<LeadMutationResult> {
  const parsed = leadMutationCommandSchema.parse(command);
  await requirePermission(mutationPermissions[parsed.operation]);
  const result = await mutateLead(parsed);
  revalidateLeadViews(result.id);
  return result;
}

export type LeadFormActionResult =
  | { status: "success"; leadId: string; version: number; message: string }
  | {
      status: "validation_error" | "conflict" | "forbidden" | "not_found" | "error";
      message: string;
    };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function idempotencyKey(formData: FormData, operation: string): string {
  const provided = text(formData, "idempotencyKey");
  return provided.length >= 8 ? provided : `${operation}-${crypto.randomUUID()}`;
}

function formFailure(error: unknown): LeadFormActionResult {
  if (error instanceof LeadDataError) {
    const status =
      error.kind === "validation"
        ? "validation_error"
        : error.kind === "unavailable" || error.kind === "unauthorized"
          ? "error"
          : error.kind;
    return { status, message: error.message };
  }
  return { status: "error", message: "Não foi possível concluir a operação do lead." };
}

async function formLead(formData: FormData) {
  const leadId = text(formData, "leadId");
  if (!leadId) throw new LeadDataError("validation", "O lead não foi informado.");
  return getLead(leadId);
}

export async function saveLeadFormAction(formData: FormData): Promise<LeadFormActionResult> {
  try {
    const leadId = text(formData, "leadId");
    const current = leadId ? await getLead(leadId) : null;
    const requestedScopeId = text(formData, "organizationId") || undefined;
    const scopeResolution = current
      ? ({ status: "ready", scope: { id: current.lead.organizationId } } as const)
      : await resolveLeadScope(requestedScopeId);
    if (scopeResolution.status !== "ready") {
      throw new LeadDataError(
        "validation",
        scopeResolution.status === "scope_required"
          ? "Selecione a organização do lead."
          : "Nenhuma organização está configurada para leads.",
      );
    }
    const organizationId = scopeResolution.scope.id;
    const catalogs = await getLeadCatalogs(organizationId);
    const stageId = current?.lead.stageId ?? catalogs.stages.find(({ key }) => key === "new")?.id;
    if (!stageId)
      throw new LeadDataError("unavailable", "A etapa inicial de leads não está configurada.");
    const sourceId =
      text(formData, "sourceId") ||
      current?.lead.sourceId ||
      catalogs.sources.find(({ key }) => key === "manual")?.id ||
      null;
    const interestTitle = text(formData, "interest");
    const result = await saveLeadAction({
      leadId: current?.lead.id ?? null,
      expectedVersion: current?.lead.version ?? null,
      idempotencyKey: idempotencyKey(formData, "save"),
      input: {
        organizationId,
        stageId,
        sourceId,
        channelId: text(formData, "channelId") || current?.lead.channelId || null,
        responsibleUserId:
          text(formData, "responsibleId") || current?.lead.responsibleUserId || null,
        priority: current?.lead.priority ?? "normal",
        favorite: current?.lead.favorite ?? false,
        summary: text(formData, "message") || current?.lead.summary || null,
        sourceSystem: "native",
        sourceRecordId: null,
        customer: {
          name: text(formData, "customerName") || current?.customer.name || "",
          email: text(formData, "email") || current?.customer.email || null,
          phone: text(formData, "phone") || current?.customer.phone || null,
          secondaryPhone: current?.customer.secondaryPhone ?? null,
          city: current?.customer.city ?? null,
          stateCode: current?.customer.stateCode ?? null,
        },
        interest: interestTitle
          ? {
              title: interestTitle,
              referenceCode: current?.interest?.referenceCode ?? null,
              transactionKind: current?.interest?.transactionKind ?? null,
              propertyKind: current?.interest?.propertyKind ?? null,
              city: current?.interest?.city ?? null,
              neighborhood: current?.interest?.neighborhood ?? null,
              budgetMin: current?.interest?.budgetMin ?? null,
              budgetMax: current?.interest?.budgetMax ?? null,
              notes: current?.interest?.notes ?? null,
            }
          : (current?.interest ?? null),
      },
    });
    return {
      status: "success",
      leadId: result.id,
      version: result.version,
      message: "Lead salvo.",
    };
  } catch (error) {
    return formFailure(error);
  }
}

export async function addLeadMessageFormAction(formData: FormData): Promise<LeadFormActionResult> {
  try {
    const current = await formLead(formData);
    const result = await mutateLeadAction({
      leadId: current.lead.id,
      operation: "add_message",
      expectedVersion: null,
      idempotencyKey: idempotencyKey(formData, "message"),
      payload: {
        direction: "internal",
        channelId: null,
        body: text(formData, "message"),
        occurredAt: new Date().toISOString(),
      },
    });
    return {
      status: "success",
      leadId: result.id,
      version: result.version,
      message: "Mensagem registrada.",
    };
  } catch (error) {
    return formFailure(error);
  }
}

export async function addLeadActivityFormAction(formData: FormData): Promise<LeadFormActionResult> {
  try {
    const current = await formLead(formData);
    const dueValue = text(formData, "dueAt");
    const dueAt = dueValue ? new Date(dueValue) : null;
    if (dueAt && Number.isNaN(dueAt.valueOf())) {
      throw new LeadDataError("validation", "A data da atividade é inválida.");
    }
    const activityType = leadActivityTypeSchema.safeParse(text(formData, "type") || "task");
    if (!activityType.success) {
      throw new LeadDataError("validation", "O tipo da atividade é inválido.");
    }
    const result = await mutateLeadAction({
      leadId: current.lead.id,
      operation: "add_activity",
      expectedVersion: null,
      idempotencyKey: idempotencyKey(formData, "activity"),
      payload: {
        type: activityType.data,
        title: text(formData, "title"),
        description: null,
        dueAt: dueAt?.toISOString() ?? null,
        completedAt: null,
      },
    });
    return {
      status: "success",
      leadId: result.id,
      version: result.version,
      message: "Atividade registrada.",
    };
  } catch (error) {
    return formFailure(error);
  }
}

async function runVersionedFormMutation(
  formData: FormData,
  operation: "set_favorite" | "archive" | "rescue" | "close",
): Promise<LeadFormActionResult> {
  try {
    const current = await formLead(formData);
    const catalogs =
      operation === "close" ? await getLeadCatalogs(current.lead.organizationId) : null;
    const wonStage = catalogs?.stages.find(({ won }) => won);
    if (operation === "close" && !wonStage) {
      throw new LeadDataError("unavailable", "A etapa de fechamento não está configurada.");
    }
    const payload =
      operation === "set_favorite"
        ? { favorite: !current.lead.favorite }
        : operation === "close"
          ? { stageId: wonStage!.id, lostReasonId: null, reason: "Fechado pela interface" }
          : {};
    const result = await mutateLeadAction({
      leadId: current.lead.id,
      operation,
      expectedVersion: current.lead.version,
      idempotencyKey: idempotencyKey(formData, operation),
      payload,
    } as LeadMutationCommand);
    return {
      status: "success",
      leadId: result.id,
      version: result.version,
      message: "Lead atualizado.",
    };
  } catch (error) {
    return formFailure(error);
  }
}

export async function toggleLeadFavoriteFormAction(formData: FormData) {
  return runVersionedFormMutation(formData, "set_favorite");
}

export async function archiveLeadFormAction(formData: FormData) {
  return runVersionedFormMutation(formData, "archive");
}

export async function rescueLeadFormAction(formData: FormData) {
  return runVersionedFormMutation(formData, "rescue");
}

export async function closeLeadFormAction(formData: FormData) {
  return runVersionedFormMutation(formData, "close");
}
