import { authorizeSalesforceConsole } from "@/lib/crm/salesforce/console-auth";
import { noStoreHeaders } from "@/lib/security/api";
import { getApplicationOrigin } from "@/lib/security/origin";

async function hasEmptyBody(request: Request): Promise<boolean> {
  if (!request.body) return true;
  const reader = request.body.getReader();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 2_000);
  try {
    // Next can provide an empty stream for a bodyless POST.
    const { done } = await reader.read();
    return done === true && !timedOut;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const origin = getApplicationOrigin();
  if (!origin || request.headers.get("origin") !== origin.origin) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStoreHeaders() });
  }
  // No credentials or destinations are accepted from the caller.
  if (new URL(request.url).search || !(await hasEmptyBody(request))) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: noStoreHeaders() });
  }
  const authorization = await authorizeSalesforceConsole();
  if (!authorization.ok) return authorization.response;
  return Response.json(
    {
      password: authorization.configuration.password,
      websocketPath: "/salesforce-console/socket",
      expiresIn: 600,
    },
    { headers: noStoreHeaders({ "Referrer-Policy": "no-referrer" }) },
  );
}
