import { supabaseRuntime } from "../../../auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = supabaseRuntime();
  if (!config) return Response.json({ error: "auth_unavailable" }, { status: 503 });
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body.email || !body.password) return Response.json({ error: "email_password_required" }, { status: 400 });
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: config.key, "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }), cache: "no-store",
  });
  if (!response.ok) return Response.json({ error: "login_failed" }, { status: 401 });
  const session = await response.json() as { access_token: string; refresh_token?: string; user?: { email?: string } };
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", `sb-access-token=${encodeURIComponent(session.access_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`);
  if (session.refresh_token) headers.append("set-cookie", `sb-refresh-token=${encodeURIComponent(session.refresh_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return new Response(JSON.stringify({ ok: true, email: session.user?.email ?? body.email }), { status: 200, headers });
}
