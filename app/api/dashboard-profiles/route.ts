import {
  dashboardProfileFailure,
  dashboardProfileRpcFailure,
  dashboardProfileSuccess,
  readDashboardProfileJson,
} from "@/lib/dashboard-canvas/persistence/http";
import {
  dashboardProfileCreateSchema,
  dashboardProfileQuerySchema,
} from "@/lib/dashboard-canvas/persistence/schema";
import { canEditDashboardProfilePage } from "@/lib/dashboard-canvas/persistence/catalog";
import {
  createDashboardProfile,
  dashboardPagePath,
  listDashboardProfiles,
} from "@/lib/dashboard-canvas/persistence/server";
import { isSameOriginRequest } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizePage(pageKey: string) {
  const pathname = dashboardPagePath(pageKey);
  if (!pathname)
    return { ok: false as const, response: dashboardProfileFailure("invalid_page_key", 400) };
  return authorizePageRoute(pathname);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = dashboardProfileQuerySchema.safeParse({
    pageKey: url.searchParams.get("pageKey"),
    scopeKey: url.searchParams.get("scopeKey"),
  });
  if (!query.success) return dashboardProfileFailure("invalid_profile_scope", 400);
  const authorization = await authorizePage(query.data.pageKey);
  if (!authorization.ok) return authorization.response;
  try {
    const result = await listDashboardProfiles(query.data.pageKey, query.data.scopeKey);
    if (result.error || !result.data) return dashboardProfileRpcFailure(result.error);
    const profiles =
      query.data.pageKey === "crm.stage.appointments"
        ? result.data.map((profile) => ({
            ...profile,
            userId: authorization.context.userId,
          }))
        : result.data;
    return dashboardProfileSuccess({ profiles });
  } catch {
    return dashboardProfileFailure("dashboard_profiles_unavailable", 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return dashboardProfileFailure("invalid_origin", 403);
  }
  const body = await readDashboardProfileJson(request);
  if (!body.ok) return body.response;
  const input = dashboardProfileCreateSchema.safeParse(body.value);
  if (!input.success) return dashboardProfileFailure("invalid_profile", 400);
  const authorization = await authorizePage(input.data.pageKey);
  if (!authorization.ok) return authorization.response;
  if (!canEditDashboardProfilePage(input.data.pageKey, authorization.context.roleKey)) {
    return dashboardProfileFailure("forbidden", 403);
  }
  try {
    const result = await createDashboardProfile(input.data);
    if (result.error || !result.data) return dashboardProfileRpcFailure(result.error);
    return dashboardProfileSuccess(
      {
        profile: result.data,
        savedAt: result.data.updatedAt,
        version: result.data.version,
      },
      201,
    );
  } catch {
    return dashboardProfileFailure("dashboard_profiles_unavailable", 503);
  }
}
