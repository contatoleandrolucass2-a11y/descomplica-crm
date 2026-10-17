import "server-only";

import { noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";
import { getMetaAdsConsoleConfiguration } from "./config";

export async function authorizeMetaAdsConsole(allowSessionRefresh = true) {
  const configuration = getMetaAdsConsoleConfiguration();
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
    const authorization = await authorizePageRoute(
      "/app/configuracoes/conectar-sistemas",
      allowSessionRefresh,
    );
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
