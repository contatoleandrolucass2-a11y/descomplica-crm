import { authorizeRoute } from "@/lib/security/route-auth";
import { noStoreHeaders } from "@/lib/security/api";

/** Retired endpoint: old links must not export from the former CRM database. */
export async function GET(_request: Request) {
  void _request;
  const authorization = await authorizeRoute("crm.leads.export");
  if (!authorization.ok) return authorization.response;
  return Response.json(
    { error: "legacy_lead_export_retired", message: "Utilize a exportação do DESCOMPLICA LEAD." },
    { status: 410, headers: noStoreHeaders() },
  );
}
