"use server";

import { requirePermission } from "@/lib/authorization/guards";

export type LeadOperationActionResult =
  | { status: "success"; message: string; data?: unknown }
  | { status: "validation_error" | "error"; message: string };

// Preserve exported action signatures for old tabs, without any legacy database access.
async function retiredOperation(): Promise<LeadOperationActionResult> {
  await requirePermission("crm.leads.view");
  return {
    status: "error",
    message: "A operação antiga de Lead foi desativada. Utilize o DESCOMPLICA LEAD.",
  };
}

export async function saveLeadDistributionFormAction(
  _data: FormData,
): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}

export async function setLeadPresenceFormAction(
  _data: FormData,
): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}

export async function assignLeadFormAction(_data: FormData): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}

export async function previewLeadImportFormAction(
  _data: FormData,
): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}

export async function applyLeadImportFormAction(
  _data: FormData,
): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}

export async function saveLeadSettingsFormAction(
  _data: FormData,
): Promise<LeadOperationActionResult> {
  void _data;
  return retiredOperation();
}
