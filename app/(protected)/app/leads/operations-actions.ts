"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/authorization/guards";
import {
  applyLeadImport,
  assignLead,
  previewLeadImport,
  saveLeadDistribution,
  saveLeadOperationsSettings,
  setLeadPresence,
} from "@/lib/crm/leads/operations-data";
import {
  distributionDocumentSchema,
  leadOperationsSettingsDocumentSchema,
} from "@/lib/crm/leads/operations-contracts";

export type LeadOperationActionResult =
  | { status: "success"; message: string; data?: unknown }
  | { status: "validation_error" | "error"; message: string };
const uuid = z.string().uuid();
const value = (data: FormData, key: string) =>
  typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const failure = (error: unknown): LeadOperationActionResult => ({
  status: error instanceof z.ZodError ? "validation_error" : "error",
  message:
    error instanceof z.ZodError
      ? "Revise os campos informados."
      : "Não foi possível concluir a operação.",
});
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((entry) => entry !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new z.ZodError([]);
  row.push(cell);
  if (row.some((entry) => entry !== "")) rows.push(row);
  const headers = rows.shift()?.map((entry) => entry.trim()) ?? [];
  return { headers, rows };
}
export async function saveLeadDistributionFormAction(
  data: FormData,
): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.distribution.manage");
    const organizationId = uuid.parse(value(data, "organizationId"));
    const document = distributionDocumentSchema.parse(JSON.parse(value(data, "document")));
    const result = await saveLeadDistribution(
      organizationId,
      z.coerce.number().int().nonnegative().parse(value(data, "expectedRevision")),
      document,
      z.string().min(8).max(500).parse(value(data, "reason")),
    );
    revalidatePath("/app/leads/distribuicao");
    return { status: "success", message: "Distribuição salva.", data: result };
  } catch (error) {
    return failure(error);
  }
}
export async function setLeadPresenceFormAction(
  data: FormData,
): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.distribution.assign");
    const result = await setLeadPresence(
      uuid.parse(value(data, "organizationId")),
      value(data, "available") === "true",
      z.coerce.number().int().min(1).max(10000).parse(value(data, "capacity")),
    );
    revalidatePath("/app/leads/distribuicao");
    return { status: "success", message: "Presença atualizada.", data: result };
  } catch (error) {
    return failure(error);
  }
}
export async function assignLeadFormAction(data: FormData): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.distribution.assign");
    const result = await assignLead(
      uuid.parse(value(data, "leadId")),
      value(data, "queueId") || null,
      value(data, "idempotencyKey") || `assign-${crypto.randomUUID()}`,
    );
    revalidatePath("/app/leads");
    return { status: "success", message: "Distribuição processada.", data: result };
  } catch (error) {
    return failure(error);
  }
}
export async function previewLeadImportFormAction(
  data: FormData,
): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.import.manage");
    const organizationId = uuid.parse(value(data, "organizationId"));
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 5_000_000 ||
      !file.name.toLowerCase().endsWith(".csv")
    )
      throw new z.ZodError([]);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    const parsed = parseCsv(decoded);
    if (parsed.rows.length > 5000) throw new z.ZodError([]);
    const mapping = JSON.parse(value(data, "mapping") || "{}");
    const rows = parsed.rows.map((cells) =>
      Object.fromEntries(
        Object.entries(mapping as Record<string, string>).map(([target, source]) => [
          target,
          cells[parsed.headers.indexOf(source)] ?? "",
        ]),
      ),
    );
    const result = await previewLeadImport(organizationId, bytes, mapping, rows);
    return {
      status: "success",
      message: "Prévia criada sem armazenar o arquivo bruto.",
      data: result,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function applyLeadImportFormAction(
  data: FormData,
): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.import.manage");
    const result = await applyLeadImport(
      uuid.parse(value(data, "batchId")),
      z.string().length(64).parse(value(data, "planHash")),
    );
    if (result.status === "expired") {
      return { status: "error", message: "A prévia expirou e o staging foi removido." };
    }
    revalidatePath("/app/leads");
    return { status: "success", message: "Importação aplicada.", data: result };
  } catch (error) {
    return failure(error);
  }
}
export async function saveLeadSettingsFormAction(
  data: FormData,
): Promise<LeadOperationActionResult> {
  try {
    await requirePermission("crm.leads.settings.manage");
    const organizationId = uuid.parse(value(data, "organizationId"));
    const document = leadOperationsSettingsDocumentSchema.parse(
      JSON.parse(value(data, "document")),
    );
    const result = await saveLeadOperationsSettings(
      organizationId,
      z.coerce.number().int().nonnegative().parse(value(data, "expectedRevision")),
      document,
      z.string().min(8).max(500).parse(value(data, "reason")),
    );
    revalidatePath("/app/leads/configuracoes");
    return { status: "success", message: "Configurações salvas.", data: result };
  } catch (error) {
    return failure(error);
  }
}
