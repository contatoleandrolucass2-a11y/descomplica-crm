import { createClient } from "@/lib/auth/supabase/server";
import { routineRecordSchema, routineSaveSchema, routineSnapshotSchema } from "@/lib/crm/routines";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const MAX_BYTES = 1_000_000;
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStoreHeaders() });

export async function GET() {
  const authorization = await authorizeRoute("crm.dashboard.view");
  if (!authorization.ok) return authorization.response;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_crm_routines");
    const result = routineSnapshotSchema.safeParse(data);
    if (error || !result.success) return failure("routine_unavailable", 503);
    return Response.json(result.data, { headers: noStoreHeaders() });
  } catch {
    return failure("routine_unavailable", 503);
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeRoute("crm.settings.manage");
  if (!authorization.ok) return authorization.response;
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) return failure("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return failure("invalid_content_type", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return failure("body_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) return failure("invalid_routine", 400);
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
    const parsed = routineSaveSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return failure("invalid_routine", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_crm_routine", {
      p_role_key: parsed.data.role_key,
      p_rows: parsed.data.rows,
      p_expected_revision: parsed.data.expected_revision,
    });
    if (error?.code === "40001") return failure("revision_conflict", 409);
    if (error?.code === "42501") return failure("forbidden", 403);
    if (error?.code === "22023") return failure("invalid_routine", 400);
    const saved = routineRecordSchema.safeParse(data);
    if (error || !saved.success) return failure("routine_unavailable", 503);
    return Response.json(saved.data, { headers: noStoreHeaders() });
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? "invalid_routine" : "routine_unavailable",
      error instanceof SyntaxError ? 400 : 503,
    );
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
