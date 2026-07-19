import { env } from "cloudflare:workers";
import type { DashboardPayload } from "../../../types";

type RuntimeEnv = {
  DB?: D1Database;
  INGEST_SECRET?: string;
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

  if (!runtime.DB) {
    return Response.json({ error: "database_unavailable" }, { status: 503 });
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

  const statements = collaborators.map((dashboard) =>
    runtime.DB!.prepare(
      `INSERT INTO collaborator_dashboards
        (email, name, manager, role, generated_at, reference_date, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         manager = excluded.manager,
         role = excluded.role,
         generated_at = excluded.generated_at,
         reference_date = excluded.reference_date,
         payload_json = excluded.payload_json,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      dashboard.collaborator.email.toLowerCase().trim(),
      dashboard.collaborator.name.trim(),
      dashboard.collaborator.manager?.trim() ?? "",
      dashboard.collaborator.role?.trim() ?? "Colaborador",
      dashboard.generatedAt,
      dashboard.referenceDate,
      JSON.stringify(dashboard),
    ),
  );

  const currentEmails = collaborators.map((dashboard) =>
    dashboard.collaborator.email.toLowerCase().trim(),
  );
  const emailPlaceholders = currentEmails.map(() => "?").join(", ");
  statements.push(
    runtime.DB.prepare(
      `DELETE FROM collaborator_dashboards
       WHERE email NOT IN (${emailPlaceholders})`,
    ).bind(...currentEmails),
  );

  statements.push(
    runtime.DB.prepare(
      `INSERT INTO ingestion_runs
        (workflow, generated_at, collaborator_count, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    ).bind(
      body.workflow?.trim() || "Funil de Vendas",
      body.generatedAt || new Date().toISOString(),
      collaborators.length,
    ),
  );

  await runtime.DB.batch(statements);

  return Response.json({
    ok: true,
    collaborators: collaborators.length,
    receivedAt: new Date().toISOString(),
  });
}
