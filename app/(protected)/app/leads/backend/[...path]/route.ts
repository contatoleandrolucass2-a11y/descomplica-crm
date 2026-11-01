import { getAuthorizedNavigation } from "@/lib/navigation/pages";
import { operationPage, operationPermissions } from "@/lib/crm/lead-plus/server/access.mjs";
import { createClient } from "@/lib/auth/supabase/server";
import { authorizePageRoute } from "@/lib/security/route-auth";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { handleLeadPlus } from "@/lib/crm/lead-plus/server/runtime.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const authorization = await authorizePageRoute("/app/leads");
  if (!authorization.ok) return authorization.response;
  if (request.method !== "GET" && !isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return Response.json({ error: "Origem inválida." }, { status: 403, headers: noStoreHeaders() });
  }
  const { path } = await context.params;
  const operation = "/" + path.join("/");
  const page = operationPage(operation, request.method);
  if (!page)
    return Response.json(
      { error: "Rota indisponível." },
      { status: 404, headers: noStoreHeaders() },
    );
  if (page !== "/app/leads") {
    const operationAuthorization = await authorizePageRoute(page);
    if (!operationAuthorization.ok) return operationAuthorization.response;
  }
  const requiredPermissions = operationPermissions(operation, request.method);
  if (
    !requiredPermissions ||
    !requiredPermissions.every((permission) =>
      (authorization.context.permissions as readonly string[]).includes(permission),
    )
  ) {
    return Response.json(
      { error: "Permissão operacional não concedida." },
      { status: 403, headers: noStoreHeaders() },
    );
  }
  const authorizedPages = (await getAuthorizedNavigation(authorization.context)).map(
    (page) => page.path,
  );
  const client = await createClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.id !== authorization.context.userId) {
    return Response.json(
      { error: "Sessão indisponível." },
      { status: 401, headers: noStoreHeaders() },
    );
  }
  return handleLeadPlus(request, "/" + path.join("/"), {
    id: authorization.context.userId,
    email: data.session.user.email || "",
    token: data.session.access_token,
    authorizedPages,
    canonicalPermissions: authorization.context.permissions,
  });
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
