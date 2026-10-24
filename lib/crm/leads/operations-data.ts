import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/auth/supabase/server";
import {
  assignmentResultSchema,
  distributionDocumentSchema,
  distributionSnapshotSchema,
  exportResultSchema,
  importApplySchema,
  importHistorySchema,
  importPreviewSchema,
  importRowSchema,
  leadOperationsSettingsDocumentSchema,
  leadOperationsSettingsSchema,
  leadReportSchema,
  operationsAuditSchema,
  reportKeySchema,
  type DistributionDocument,
  type DistributionSnapshot,
  type ImportRow,
  type LeadExportResult,
  type LeadOperationsSettingsDocument,
  type LeadReport,
} from "./operations-contracts";

const uuid = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new Error("Identificador inválido.");
  return value;
};
async function rpc(name: string, args: Record<string, unknown>) {
  const client = await createClient();
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(result.error.code ?? "lead_operations_unavailable");
  return result.data;
}
export async function getLeadDistribution(organizationId: string): Promise<DistributionSnapshot> {
  return distributionSnapshotSchema.parse(
    await rpc("get_crm_lead_distribution_v1", { p_organization_id: uuid(organizationId) }),
  );
}
export async function saveLeadDistribution(
  organizationId: string,
  expectedRevision: number,
  document: DistributionDocument,
  reason: string,
) {
  return rpc("save_crm_lead_distribution_v1", {
    p_organization_id: uuid(organizationId),
    p_expected_revision: expectedRevision,
    p_document: distributionDocumentSchema.parse(document),
    p_reason: reason,
  });
}
export async function setLeadPresence(
  organizationId: string,
  available: boolean,
  capacity: number,
) {
  return rpc("set_crm_lead_presence_v1", {
    p_organization_id: uuid(organizationId),
    p_available: available,
    p_capacity: capacity,
  });
}
export async function assignLead(leadId: string, queueId: string | null, idempotencyKey: string) {
  return assignmentResultSchema.parse(
    await rpc("assign_crm_lead_v1", {
      p_lead_id: uuid(leadId),
      p_queue_id: queueId ? uuid(queueId) : null,
      p_idempotency_key: idempotencyKey,
    }),
  );
}
export async function getLeadReport(
  organizationId: string,
  report: string,
  from: string,
  to: string,
  filters: Record<string, unknown> = {},
): Promise<LeadReport> {
  return leadReportSchema.parse(
    await rpc("get_crm_lead_report_v1", {
      p_organization_id: uuid(organizationId),
      p_report: reportKeySchema.parse(report),
      p_from: from,
      p_to: to,
      p_filters: filters,
    }),
  );
}
export async function exportLeads(
  organizationId: string,
  filters: Record<string, unknown> = {},
  limit = 5000,
): Promise<LeadExportResult> {
  return exportResultSchema.parse(
    await rpc("export_crm_leads_v1", {
      p_organization_id: uuid(organizationId),
      p_filters: filters,
      p_limit: limit,
    }),
  );
}
export async function getLeadOperationsSettings(organizationId: string) {
  return leadOperationsSettingsSchema.parse(
    await rpc("get_crm_lead_settings_v1", { p_organization_id: uuid(organizationId) }),
  );
}
export async function saveLeadOperationsSettings(
  organizationId: string,
  expectedRevision: number,
  document: LeadOperationsSettingsDocument,
  reason: string,
) {
  return rpc("save_crm_lead_settings_v1", {
    p_organization_id: uuid(organizationId),
    p_expected_revision: expectedRevision,
    p_document: leadOperationsSettingsDocumentSchema.parse(document),
    p_reason: reason,
  });
}
export async function previewLeadImport(
  organizationId: string,
  fileBytes: Uint8Array,
  mapping: Record<string, string>,
  rows: ImportRow[],
) {
  const parsed = importRowSchema.array().min(1).max(5000).parse(rows);
  const fileHash = createHash("sha256").update(fileBytes).digest("hex");
  return importPreviewSchema.parse(
    await rpc("preview_crm_lead_import_v1", {
      p_organization_id: uuid(organizationId),
      p_file_hash: fileHash,
      p_mapping: mapping,
      p_rows: parsed,
    }),
  );
}
export async function applyLeadImport(batchId: string, expectedPlanHash: string) {
  return importApplySchema.parse(
    await rpc("apply_crm_lead_import_v1", {
      p_batch_id: uuid(batchId),
      p_expected_plan_hash: expectedPlanHash,
    }),
  );
}
export async function purgeLeadImportStaging(organizationId: string) {
  return rpc("purge_crm_lead_import_staging_v1", { p_organization_id: uuid(organizationId) });
}
export async function listLeadImports(organizationId: string, limit = 50, offset = 0) {
  return importHistorySchema.parse(
    await rpc("list_crm_lead_imports_v1", {
      p_organization_id: uuid(organizationId),
      p_limit: limit,
      p_offset: offset,
    }),
  );
}
export async function listLeadOperationsAudit(
  organizationId: string,
  filters: Record<string, unknown> = {},
  limit = 50,
  offset = 0,
) {
  return operationsAuditSchema.parse(
    await rpc("list_crm_lead_operations_audit_v1", {
      p_organization_id: uuid(organizationId),
      p_filters: filters,
      p_limit: limit,
      p_offset: offset,
    }),
  );
}
