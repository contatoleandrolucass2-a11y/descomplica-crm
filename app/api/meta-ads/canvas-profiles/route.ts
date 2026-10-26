import { createClient } from "@/lib/auth/supabase/server";
import {
  metaAdsCanvasRecordSchema,
  metaAdsCanvasSaveSchema,
  metaAdsCanvasScopeSchema,
} from "@/lib/crm/meta-ads/canvas-profiles";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 524_288;
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStoreHeaders() });

export async function GET(request: Request) {
  const authorization = await authorizePageRoute("/app/meta-ads");
  if (!authorization.ok) return authorization.response;
  const scope = metaAdsCanvasScopeSchema.safeParse(new URL(request.url).searchParams.get("scope"));
  if (!scope.success) return failure("invalid_scope", 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meta_ads_canvas_profiles")
      .select("scope,state,revision,updated_at")
      .eq("user_id", authorization.context.userId)
      .eq("scope", scope.data)
      .maybeSingle();
    if (error) return failure("canvas_profiles_unavailable", 503);
    if (!data) return Response.json({ profile: null }, { headers: noStoreHeaders() });
    const profile = metaAdsCanvasRecordSchema.safeParse(data);
    if (!profile.success) return failure("canvas_profiles_unavailable", 503);
    return Response.json({ profile: profile.data }, { headers: noStoreHeaders() });
  } catch {
    return failure("canvas_profiles_unavailable", 503);
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizePageRoute("/app/meta-ads");
  if (!authorization.ok) return authorization.response;
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) return failure("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return failure("invalid_content_type", 415);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BYTES) return failure("body_too_large", 413);
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BYTES) return failure("body_too_large", 413);
    const parsed = metaAdsCanvasSaveSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return failure("invalid_canvas_profiles", 400);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meta_ads_canvas_profiles")
      .upsert(
        {
          user_id: authorization.context.userId,
          scope: parsed.data.scope,
          state: parsed.data.state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,scope" },
      )
      .select("scope,state,revision,updated_at")
      .single();
    if (error) return failure("canvas_profiles_unavailable", 503);
    const profile = metaAdsCanvasRecordSchema.safeParse(data);
    if (!profile.success) return failure("canvas_profiles_unavailable", 503);
    return Response.json({ profile: profile.data }, { headers: noStoreHeaders() });
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? "invalid_canvas_profiles" : "canvas_profiles_unavailable",
      error instanceof SyntaxError ? 400 : 503,
    );
  }
}
