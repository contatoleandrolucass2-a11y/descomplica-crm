import { env } from "cloudflare:workers";

export type RuntimeAuthEnv = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };

export function supabaseRuntime() {
  const runtime = env as unknown as RuntimeAuthEnv;
  const url = runtime.SUPABASE_URL?.trim();
  const key = runtime.SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

export async function supabaseAuthUser(token: string) {
  const config = supabaseRuntime();
  if (!config) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as { id: string; email?: string };
}
