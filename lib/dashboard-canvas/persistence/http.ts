import { noStoreHeaders } from "@/lib/security/api";
import { DASHBOARD_PROFILE_MAX_BYTES } from "./schema";

const REQUEST_TIMEOUT_MS = 10_000;

export function dashboardProfileFailure(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: noStoreHeaders() });
}

export function dashboardProfileSuccess(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: noStoreHeaders() });
}

export async function readDashboardProfileJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { ok: false, response: dashboardProfileFailure("invalid_content_type", 415) };
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    return { ok: false, response: dashboardProfileFailure("invalid_content_length", 400) };
  }
  if (declaredLength > DASHBOARD_PROFILE_MAX_BYTES) {
    return { ok: false, response: dashboardProfileFailure("body_too_large", 413) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, response: dashboardProfileFailure("invalid_profile", 400) };
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => undefined);
  }, REQUEST_TIMEOUT_MS);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > DASHBOARD_PROFILE_MAX_BYTES) {
        await reader.cancel();
        return { ok: false, response: dashboardProfileFailure("body_too_large", 413) };
      }
      chunks.push(value);
    }
    if (timedOut) return { ok: false, response: dashboardProfileFailure("request_timeout", 408) };
    try {
      return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
    } catch {
      return { ok: false, response: dashboardProfileFailure("invalid_profile", 400) };
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export function dashboardProfileRpcFailure(error: { code?: string | null } | null): Response {
  switch (error?.code) {
    case "28000":
      return dashboardProfileFailure("unauthenticated", 401);
    case "42501":
      return dashboardProfileFailure("forbidden", 403);
    case "P0002":
      return dashboardProfileFailure("profile_not_found", 404);
    case "40001":
    case "23505":
      return dashboardProfileFailure("version_conflict", 409);
    case "22008":
    case "22023":
    case "22P02":
    case "23503":
    case "23514":
      return dashboardProfileFailure("invalid_profile", 400);
    default:
      return dashboardProfileFailure("dashboard_profiles_unavailable", 503);
  }
}
