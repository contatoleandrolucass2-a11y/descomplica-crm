import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const snapshotVersionSchema = z
  .object({
    generated_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .nullable();

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRoute("crm.stage.appointments.view");
  if (!authorization.ok) return authorization.response;

  try {
    const supabase = await createClient();
    const snapshot = await supabase
      .from("crm_dashboard_snapshots")
      .select("generated_at,updated_at")
      .eq("snapshot_key", "global")
      .maybeSingle();
    const version = snapshotVersionSchema.safeParse(snapshot.data);
    if (!snapshot.error && version.success) {
      return Response.json(
        {
          generatedAt: version.data?.generated_at ?? null,
          updatedAt: version.data?.updated_at ?? null,
        },
        { headers: noStoreHeaders() },
      );
    }
  } catch {
    // A failed read is not a new snapshot version.
  }
  return Response.json({ error: "status_unavailable" }, { status: 503, headers: noStoreHeaders() });
}
