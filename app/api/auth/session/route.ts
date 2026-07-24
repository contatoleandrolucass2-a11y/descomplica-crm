import { cookies } from "next/headers";
import { supabaseAuthUser } from "../../../auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get("sb-access-token")?.value;
  if (!token) return Response.json({ authenticated: false }, { status: 401 });
  const user = await supabaseAuthUser(decodeURIComponent(token));
  if (!user) return Response.json({ authenticated: false }, { status: 401 });
  return Response.json({ authenticated: true, user }, { headers: { "cache-control": "no-store" } });
}
