import { z } from "zod";

import { syncStatusRowSchema } from "@/lib/crm/ingestion/schema";

const fields = syncStatusRowSchema.shape;
const syncStatusResponseSchema = z.object({
  generatedAt: fields.generated_at,
  ingestion: z.object({
    status: fields.last_ingest_status,
    completedAt: fields.last_ingest_at,
  }),
  refresh: z.object({
    status: fields.refresh_status,
    requestedAt: fields.refresh_requested_at,
  }),
});

export type IntegrationEvidence = {
  checkedAt: string;
  generatedAt: string | null;
  ingestion: z.infer<typeof syncStatusResponseSchema>["ingestion"];
};

export async function fetchIntegrationEvidence(
  signal: AbortSignal,
): Promise<IntegrationEvidence | null> {
  try {
    const response = await fetch("/api/dashboard/status", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) return null;
    const parsed = syncStatusResponseSchema.safeParse(await response.json());
    if (!parsed.success || signal.aborted) return null;
    const checkedAt = new Date().toISOString();
    if (
      parsed.data.ingestion.completedAt &&
      Date.parse(parsed.data.ingestion.completedAt) > Date.parse(checkedAt)
    ) {
      return null;
    }
    return {
      checkedAt,
      generatedAt: parsed.data.generatedAt,
      ingestion: parsed.data.ingestion,
    };
  } catch {
    return null;
  }
}

type ServiceStatus = {
  state: "confirmed" | "unverified" | "unavailable";
  label: string;
  timestamp: string | null;
  note: string;
};

export function getIntegrationServiceStatuses(evidence: IntegrationEvidence | null): {
  n8n: ServiceStatus;
  supabase: ServiceStatus;
} {
  const ingestion = evidence?.ingestion;
  // A durable receipt proves a past ingestion, never the current n8n service state.
  const delivered = ingestion?.status === "succeeded" && ingestion.completedAt !== null;
  const failed = ingestion?.status === "failed";
  return {
    n8n: {
      state: delivered ? "confirmed" : failed ? "unavailable" : "unverified",
      label: delivered
        ? "Ingestão confirmada"
        : failed
          ? "Última ingestão falhou"
          : "Não verificado",
      timestamp: delivered || failed ? (ingestion?.completedAt ?? null) : null,
      note: delivered
        ? "Disponibilidade atual não verificada."
        : ingestion?.status === "running"
          ? "Ingestão em andamento, sem confirmação."
          : failed
            ? "Sem entrega confirmada na última tentativa."
            : evidence
              ? "Sem recibo de ingestão confirmado."
              : "Não foi possível consultar a ingestão.",
    },
    supabase: {
      state: evidence ? "confirmed" : "unverified",
      label: evidence ? "Leitura confirmada" : "Não verificado",
      timestamp: evidence?.checkedAt ?? null,
      note: evidence ? "Consulta de status concluída." : "Consulta de status indisponível.",
    },
  };
}
