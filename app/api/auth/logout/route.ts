export async function POST() {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", "sb-access-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("set-cookie", "sb-refresh-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(JSON.stringify({ ok: true }), { headers });
}
