import { createClient } from "@/lib/auth/supabase/server";
import { syncStatusRowSchema } from "@/lib/crm/ingestion/schema";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRoute("crm.dashboard.view");
  if (!authorization.ok) return authorization.response;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_crm_sync_status");
  if (error) {
    return Response.json(
      { error: "status_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const parsed = syncStatusRowSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    return Response.json(
      { error: "status_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  return Response.json(
    {
      generatedAt: parsed.data.generated_at,
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
