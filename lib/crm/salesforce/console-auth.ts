import "server-only";

import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";
import { getSalesforceConsoleConfiguration } from "./console-config";

export async function authorizeSalesforceConsole(allowSessionRefresh = true) {
  const configuration = getSalesforceConsoleConfiguration();
  if (!configuration.available) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "console_unavailable" },
        {
          status: 503,
          headers: noStoreHeaders(),
        },
      ),
    };
  }
  try {
    const authorization = await authorizeRoute("crm.settings.manage", allowSessionRefresh);
    if (!authorization.ok) return authorization;
    if (authorization.context.roleKey !== "master") {
      return {
        ok: false as const,
        response: Response.json(
          { error: "forbidden" },
          {
            status: 403,
            headers: noStoreHeaders(),
          },
        ),
      };
    }
    return { ok: true as const, context: authorization.context, configuration };
  } catch {
    return {
      ok: false as const,
      response: Response.json(
        { error: "console_unavailable" },
        {
          status: 503,
          headers: noStoreHeaders(),
        },
      ),
    };
  }
}
