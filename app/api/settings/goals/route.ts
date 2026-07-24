import { cookies } from "next/headers";
import { supabaseAuthUser, supabaseRuntime } from "../../../auth-server";

export const dynamic = "force-dynamic";
const fields = ["opportunities", "appointments", "visits", "folders", "sales"] as const;

export async function GET() {
  const config = supabaseRuntime();
  if (!config) return Response.json({ error: "database_unavailable" }, { status: 503 });
  const response = await fetch(`${config.url}/rest/v1/crm_funnel_goals?select=*&id=eq.default&limit=1`, { headers: { apikey: config.key, authorization: `Bearer ${config.key}` }, cache: "no-store" });
  if (!response.ok) return Response.json({ error: "goals_unavailable" }, { status: 502 });
  const rows = await response.json();
  return Response.json(rows[0] ?? null, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const config = supabaseRuntime();
  const token = (await cookies()).get("sb-access-token")?.value;
  const user = token ? await supabaseAuthUser(decodeURIComponent(token)) : null;
  if (!config || !user || !token) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const values: Record<string, number> = {};
  for (const field of fields) {
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0 || value > 10000000) return Response.json({ error: `invalid_${field}` }, { status: 400 });
    values[field] = Math.round(value);
  }
  const response = await fetch(`${config.url}/rest/v1/crm_funnel_goals`, {
    method: "POST",
    headers: { apikey: config.key, authorization: `Bearer ${decodeURIComponent(token)}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: "default", effective_month: new Date().toISOString().slice(0, 7) + "-01", ...values, updated_by: user.email ?? null, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) return Response.json({ error: "goals_save_failed" }, { status: 502 });
  const rows = await response.json();
  return Response.json(rows[0] ?? values, { headers: { "cache-control": "no-store" } });
}
