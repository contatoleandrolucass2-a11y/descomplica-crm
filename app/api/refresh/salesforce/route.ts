import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type RuntimeEnv = {
  INGEST_SECRET?: string;
  SALESFORCE_REFRESH_URL?: string;
};

const DEFAULT_REFRESH_URL =
  "https://n8n.descomplicapro.com.br/webhook/atualizar-funil-salesforce";

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const runtime = env as unknown as RuntimeEnv;
  const secret = runtime.INGEST_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "refresh_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch(
      runtime.SALESFORCE_REFRESH_URL?.trim() || DEFAULT_REFRESH_URL,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ requestedAt: new Date().toISOString() }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok && response.status !== 409) {
      return Response.json(
        { error: "refresh_rejected" },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    return Response.json(
      { ok: true, status: response.status === 409 ? "already_running" : "started" },
      { status: response.status === 409 ? 409 : 202 },
    );
  } catch {
    return Response.json({ error: "refresh_unreachable" }, { status: 502 });
  }
}
