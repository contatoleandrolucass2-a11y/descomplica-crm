import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { getSalesforceRefreshConfiguration } from "@/lib/crm/salesforce/config";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const beginResultSchema = z.object({
  ok: z.boolean(),
  status: z.string(),
  runId: z.string().uuid().optional(),
  retryAfter: z.number().int().positive().optional(),
});

async function finishRefresh(
  runId: string,
  status: "succeeded" | "failed",
  httpStatus: number | null,
  errorCode: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_crm_salesforce_refresh", {
    p_run_id: runId,
    p_status: status,
    p_http_status: httpStatus,
    p_error_code: errorCode,
  });
  return !error;
}

export async function POST(request: Request) {
  const configuration = getSalesforceRefreshConfiguration();
  if (!configuration.available) {
    return Response.json(
      { error: "refresh_unavailable" },
      { status: configuration.enabled ? 503 : 404, headers: noStoreHeaders() },
    );
  }

  const authorization = await authorizeRoute("crm.salesforce.refresh");
  if (!authorization.ok) return authorization.response;
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers: noStoreHeaders() });
  }

  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("begin_crm_salesforce_refresh", {
    p_request_key: `refresh:${requestId}`,
  });
  const begin = beginResultSchema.safeParse(data);
  if (error || !begin.success) {
    return Response.json(
      { error: "refresh_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }
  if (!begin.data.ok && begin.data.status === "rate_limited") {
    return Response.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: noStoreHeaders({ "retry-after": String(begin.data.retryAfter ?? 60) }),
      },
    );
  }
  if (!begin.data.ok || !begin.data.runId) {
    return Response.json({ error: "already_running" }, { status: 409, headers: noStoreHeaders() });
  }

  try {
    const response = await fetch(configuration.refreshUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${configuration.refreshSecret}`,
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ requestId, requestedAt: new Date().toISOString() }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    const accepted = response.ok || response.status === 409;
    const finished = await finishRefresh(
      begin.data.runId,
      accepted ? "succeeded" : "failed",
      response.status,
      accepted ? null : "upstream_rejected",
    );
    if (!finished) {
      return Response.json(
        { error: "refresh_unavailable" },
        { status: 503, headers: noStoreHeaders() },
      );
    }
    if (!accepted) {
      return Response.json(
        { error: "refresh_rejected" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return Response.json(
      { ok: true, status: response.status === 409 ? "already_running" : "started", requestId },
      { status: response.status === 409 ? 200 : 202, headers: noStoreHeaders() },
    );
  } catch {
    await finishRefresh(begin.data.runId, "failed", null, "upstream_unreachable");
    return Response.json(
      { error: "refresh_unreachable" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
