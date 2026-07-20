import { env } from "cloudflare:workers";
import type { DashboardPayload } from "../../../types";

type RuntimeEnv = {
  INGEST_SECRET?: string;
  SALESFORCE_INGEST_URL?: string;
};

type IngestPayload = {
  workflow?: string;
  generatedAt?: string;
  collaborators?: DashboardPayload[];
};

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const runtime = env as unknown as RuntimeEnv;
  const expected = runtime.INGEST_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";

  if (!expected || authorization !== `Bearer ${expected}`) {
    return unauthorized();
  }

  let body: IngestPayload;
  try {
    body = (await request.json()) as IngestPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const collaborators = Array.isArray(body.collaborators)
    ? body.collaborators
    : [];

  if (!collaborators.length || collaborators.length > 500) {
    return Response.json(
      { error: "collaborators_must_contain_1_to_500_items" },
      { status: 400 },
    );
  }

  for (const dashboard of collaborators) {
    if (
      !dashboard?.collaborator?.email ||
      !dashboard?.collaborator?.name ||
      !dashboard?.views?.all ||
      !dashboard?.views?.with_canal_imob ||
      !dashboard?.views?.without_canal_imob
    ) {
      return Response.json(
        { error: "invalid_collaborator_payload" },
        { status: 400 },
      );
    }
  }

  const persistUrl = runtime.SALESFORCE_INGEST_URL?.trim() ||
    "https://n8n.descomplicapro.com.br/webhook/persistir-funil-salesforce";
  const response = await fetch(persistUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${expected}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return Response.json({ error: "persistence_rejected" }, { status: 502 });
  return Response.json({ ok: true, collaborators: collaborators.length, receivedAt: new Date().toISOString() });
}
