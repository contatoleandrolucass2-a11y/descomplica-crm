import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const presenceRowsSchema = z.array(
  z.object({
    user_id: z.string().uuid(),
    last_seen_at: z.string().datetime({ offset: true }).nullable(),
    is_online: z.boolean(),
    observed_at: z.string().datetime({ offset: true }),
  }),
);

export async function GET() {
  const authorization = await authorizeRoute("users.view");
  if (!authorization.ok) return authorization.response;

  try {
    const supabase = await createClient();
    // The RPC applies the same scoped visibility as the administration directory.
    const { data, error } = await supabase.rpc("get_user_presence");
    const parsed = presenceRowsSchema.safeParse(data);
    if (error || !parsed.success) {
      return Response.json(
        { error: "presence_unavailable" },
        { status: error?.code === "42501" ? 403 : 503, headers: noStoreHeaders() },
      );
    }
    return Response.json(
      {
        observedAt: parsed.data[0]?.observed_at ?? new Date().toISOString(),
        users: parsed.data.map((row) => ({
          userId: row.user_id,
          lastSeenAt: row.last_seen_at,
          isOnline: row.is_online,
        })),
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    return Response.json(
      { error: "presence_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
