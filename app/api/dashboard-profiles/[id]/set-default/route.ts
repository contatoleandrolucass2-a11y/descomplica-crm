import {
  dashboardProfileFailure,
  dashboardProfileRpcFailure,
  dashboardProfileSuccess,
  readDashboardProfileJson,
} from "@/lib/dashboard-canvas/persistence/http";
import {
  dashboardProfileIdSchema,
  dashboardProfileVersionBodySchema,
} from "@/lib/dashboard-canvas/persistence/schema";
import { canEditDashboardProfilePage } from "@/lib/dashboard-canvas/persistence/catalog";
import {
  dashboardPagePath,
  getDashboardProfile,
  setDefaultDashboardProfile,
} from "@/lib/dashboard-canvas/persistence/server";
import { isSameOriginRequest } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: ProfileRouteContext) {
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return dashboardProfileFailure("invalid_origin", 403);
  }
  const { id } = await context.params;
  const profileId = dashboardProfileIdSchema.safeParse(id);
  if (!profileId.success) return dashboardProfileFailure("invalid_profile_id", 400);
  const body = await readDashboardProfileJson(request);
  if (!body.ok) return body.response;
  const input = dashboardProfileVersionBodySchema.safeParse(body.value);
  if (!input.success) return dashboardProfileFailure("invalid_profile_version", 400);
  try {
    const existing = await getDashboardProfile(profileId.data);
    if (existing.error || !existing.data) return dashboardProfileRpcFailure(existing.error);
    const pathname = dashboardPagePath(existing.data.pageKey);
    if (!pathname) return dashboardProfileFailure("forbidden", 403);
    const authorization = await authorizePageRoute(pathname);
    if (!authorization.ok) return authorization.response;
    if (!canEditDashboardProfilePage(existing.data.pageKey, authorization.context.roleKey)) {
      return dashboardProfileFailure("forbidden", 403);
    }
    const result = await setDefaultDashboardProfile(profileId.data, input.data.version);
    if (result.error || !result.data) return dashboardProfileRpcFailure(result.error);
    return dashboardProfileSuccess({
      profile: result.data,
      savedAt: result.data.updatedAt,
      version: result.data.version,
    });
  } catch {
    return dashboardProfileFailure("dashboard_profiles_unavailable", 503);
  }
}
