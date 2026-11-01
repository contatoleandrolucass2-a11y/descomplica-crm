"use server";

import { requirePermission } from "@/lib/authorization/guards";
import type {
  LeadMutationCommand,
  LeadMutationResult,
  LeadSaveCommand,
} from "@/lib/crm/leads/contracts";

export type LeadFormActionResult =
  | { status: "success"; leadId: string; version: number; message: string }
  | {
      status: "validation_error" | "conflict" | "forbidden" | "not_found" | "error";
      message: string;
    };

const retiredMessage = "A operação antiga de Lead foi desativada. Utilize o DESCOMPLICA LEAD.";

// Old browser tabs may still invoke these action IDs. Never read or mutate the legacy database.
export async function saveLeadAction(_command: LeadSaveCommand): Promise<LeadMutationResult> {
  void _command;
  await requirePermission("crm.leads.view");
  throw Object.assign(new Error(retiredMessage), { status: 410 });
}

export async function mutateLeadAction(_command: LeadMutationCommand): Promise<LeadMutationResult> {
  void _command;
  await requirePermission("crm.leads.view");
  throw Object.assign(new Error(retiredMessage), { status: 410 });
}

async function retiredForm(): Promise<LeadFormActionResult> {
  await requirePermission("crm.leads.view");
  return { status: "error", message: retiredMessage };
}

export async function saveLeadFormAction(_formData: FormData): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function addLeadMessageFormAction(_formData: FormData): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function addLeadActivityFormAction(
  _formData: FormData,
): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function toggleLeadFavoriteFormAction(
  _formData: FormData,
): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function archiveLeadFormAction(_formData: FormData): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function rescueLeadFormAction(_formData: FormData): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}

export async function closeLeadFormAction(_formData: FormData): Promise<LeadFormActionResult> {
  void _formData;
  return retiredForm();
}
