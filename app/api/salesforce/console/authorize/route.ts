import { authorizeSalesforceConsole } from "@/lib/crm/salesforce/console-auth";
import { noStoreHeaders } from "@/lib/security/api";

export async function GET() {
  const authorization = await authorizeSalesforceConsole(false);
  if (!authorization.ok) return authorization.response;
  return Response.json(
    { ok: true, subject: authorization.context.userId },
    {
      headers: noStoreHeaders(),
    },
  );
}
