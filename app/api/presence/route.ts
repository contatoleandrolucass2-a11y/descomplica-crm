import { createClient } from "@/lib/auth/supabase/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizeAuthenticatedRoute } from "@/lib/security/route-auth";

export async function POST(request: Request) {
  const authorization = await authorizeAuthenticatedRoute();
  if (!authorization.ok) return authorization.response;
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const supabase = await createClient();
    // Identity and time are resolved by the database, never accepted from the browser.
    const { error } = await supabase.rpc("touch_user_presence");
    if (error) {
      return Response.json(
        { error: "presence_unavailable" },
        { status: error.code === "42501" ? 403 : 503, headers: noStoreHeaders() },
      );
    }
    return new Response(null, { status: 204, headers: noStoreHeaders() });
  } catch {
    return Response.json(
      { error: "presence_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
