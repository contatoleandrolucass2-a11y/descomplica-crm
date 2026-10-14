import { createClient } from "@/lib/auth/supabase/server";
import {
  routineCompletionSaveSchema,
  routineCompletionSnapshotSchema,
} from "@/lib/crm/routine-completions";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const MAX_BYTES = 32_768;
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStoreHeaders() });

function rpcFailure(code: string | undefined) {
  switch (code) {
    case "28000":
      return failure("unauthenticated", 401);
    case "42501":
      return failure("forbidden", 403);
    case "22023":
      return failure("invalid_completion", 400);
    case "RC001":
      return failure("week_conflict", 409);
    case "RC002":
      return failure("activity_conflict", 409);
    case "RC003":
      return failure("routine_not_saved", 409);
    default:
      return failure("routine_completions_unavailable", 503);
  }
}

export async function GET() {
  const authorization = await authorizeRoute("crm.dashboard.view");
  if (!authorization.ok) return authorization.response;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_crm_routine_completions");
    if (error) return rpcFailure(error.code);
    const result = routineCompletionSnapshotSchema.safeParse(data);
    if (!result.success) return rpcFailure(undefined);
    return Response.json(result.data, { headers: noStoreHeaders() });
  } catch {
    return rpcFailure(undefined);
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeRoute("crm.dashboard.view");
  if (!authorization.ok) return authorization.response;
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) return failure("invalid_origin", 403);
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    return failure("invalid_content_type", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return failure("body_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) return failure("invalid_completion", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 10_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return failure("body_too_large", 413);
      }
      chunks.push(value);
    }
    if (timedOut) return failure("request_timeout", 408);
    clearTimeout(timer);
    const parsed = routineCompletionSaveSchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!parsed.success) return failure("invalid_completion", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_crm_routine_completion", {
      p_role_key: parsed.data.role_key,
      p_row_index: parsed.data.row_index,
      p_day: parsed.data.day,
      p_activity_text: parsed.data.activity_text,
      p_expected_week_start: parsed.data.expected_week_start,
      p_completed: parsed.data.completed,
    });
    if (error) return rpcFailure(error.code);
    const result = routineCompletionSnapshotSchema.safeParse(data);
    if (!result.success) return rpcFailure(undefined);
    return Response.json(result.data, { headers: noStoreHeaders() });
  } catch (error) {
    if (timedOut) return failure("request_timeout", 408);
    return error instanceof SyntaxError
      ? failure("invalid_completion", 400)
      : rpcFailure(undefined);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
