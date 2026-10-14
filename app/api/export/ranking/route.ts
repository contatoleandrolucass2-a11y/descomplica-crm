import { getRankingExportConfiguration, loadRankingExportPayload } from "@/lib/crm/ranking/export";
import { noStoreHeaders, secretsMatch } from "@/lib/security/api";
import { applySecurityHeaders } from "@/lib/security/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function responseHeaders(request: Request): Headers {
  const headers = noStoreHeaders();
  applySecurityHeaders(headers, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
    noIndex: true,
    suppressReferrer: true,
  });
  return headers;
}

export async function GET(request: Request) {
  const configuration = getRankingExportConfiguration();
  const headers = responseHeaders(request);
  if (!configuration.available) {
    return Response.json({ error: "export_unavailable" }, { status: 404, headers });
  }

  if (!secretsMatch(bearerToken(request), configuration.exportSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  try {
    return Response.json(await loadRankingExportPayload(), { headers });
  } catch {
    return Response.json({ error: "export_unavailable" }, { status: 503, headers });
  }
}
