import { authorizeMetaAdsConsole } from "@/lib/crm/meta-ads/console-auth";
import { noStoreHeaders } from "@/lib/security/api";

export async function GET() {
  const authorization = await authorizeMetaAdsConsole(false);
  if (!authorization.ok) return authorization.response;
  return Response.json(
    { ok: true, subject: authorization.context.userId },
    {
      headers: noStoreHeaders(),
    },
  );
}
