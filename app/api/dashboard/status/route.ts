import { createClient } from "@/lib/auth/supabase/server";
import { syncStatusRowSchema } from "@/lib/crm/ingestion/schema";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";
import { z } from "zod";

const snapshotVersionSchema = z
  .object({
    generated_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .nullable();

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRoute("crm.dashboard.view");
  if (!authorization.ok) return authorization.response;

  const supabase = await createClient();
  const [{ data, error }, snapshot] = await Promise.all([
    supabase.rpc("get_crm_sync_status"),
    supabase
      .from("crm_dashboard_snapshots")
      .select("generated_at,updated_at")
      .eq("snapshot_key", "global")
      .maybeSingle(),
  ]);
  if (error || snapshot.error) {
    return Response.json(
      { error: "status_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const parsed = syncStatusRowSchema.safeParse(Array.isArray(data) ? data[0] : data);
  const version = snapshotVersionSchema.safeParse(snapshot.data);
  if (!parsed.success || !version.success) {
    return Response.json(
      { error: "status_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  return Response.json(
    {
      generatedAt: version.data?.generated_at ?? null,
      updatedAt: version.data?.updated_at ?? null,
      ingestion: {
        status: parsed.data.last_ingest_status,
        completedAt: parsed.data.last_ingest_at,
      },
      refresh: {
        status: parsed.data.refresh_status,
        requestedAt: parsed.data.refresh_requested_at,
      },
    },
    { headers: noStoreHeaders() },
  );
}
