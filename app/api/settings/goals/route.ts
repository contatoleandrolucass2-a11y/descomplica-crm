import { supabaseRuntime } from "../../../auth-server";

export const dynamic = "force-dynamic";
const fields = ["opportunities", "appointments", "visits", "folders", "approved_folders", "sales"] as const;
const brokerMinimumKeys = ["month_1", "month_2", "month_3", "month_4_plus"] as const;
const brokerWeeklyKeys = ["appointments", "visits", "folders"] as const;
const productiveTeamKeys = ["appointments", "visits", "folders", "sales"] as const;

function parseIntegerMap(input: unknown, keys: readonly string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const output: Record<string, number> = {};
  for (const key of keys) {
    const value = Number(source[key]);
    if (!Number.isInteger(value) || value < 0 || value > 100000) return null;
    output[key] = value;
  }
  return output;
}

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
  if (!config) return Response.json({ error: "database_unavailable" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const values: Record<string, number> = {};
  for (const field of fields) {
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0 || value > 10000000) return Response.json({ error: `invalid_${field}` }, { status: 400 });
    values[field] = value;
  }
  const rates = Array.isArray(body.rates)
    ? body.rates.map(Number)
    : [];
  if (rates.length !== 5 || rates.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) {
    return Response.json({ error: "invalid_rates" }, { status: 400 });
  }
  const brokerMinimums = parseIntegerMap(body.broker_minimums, brokerMinimumKeys);
  if (!brokerMinimums) return Response.json({ error: "invalid_broker_minimums" }, { status: 400 });
  const brokerWeeklyTargets = parseIntegerMap(body.broker_weekly_targets, brokerWeeklyKeys);
  if (!brokerWeeklyTargets) return Response.json({ error: "invalid_broker_weekly_targets" }, { status: 400 });
  const productiveTeamTargets = parseIntegerMap(body.productive_team_targets, productiveTeamKeys);
  if (!productiveTeamTargets || Object.values(productiveTeamTargets).some((value) => value > 100)) {
    return Response.json({ error: "invalid_productive_team_targets" }, { status: 400 });
  }
  const response = await fetch(`${config.url}/rest/v1/crm_funnel_goals`, {
    method: "POST",
    headers: { apikey: config.key, authorization: `Bearer ${config.key}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: "default", effective_month: new Date().toISOString().slice(0, 7) + "-01", ...values, rates, broker_minimums: brokerMinimums, broker_weekly_targets: brokerWeeklyTargets, productive_team_targets: productiveTeamTargets, updated_by: "configuracoes-publicas", updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) return Response.json({ error: "goals_save_failed" }, { status: 502 });
  const rows = await response.json();
  return Response.json(rows[0] ?? values, { headers: { "cache-control": "no-store" } });
}
