import {
  dashboardProfileFailure,
  dashboardProfileRpcFailure,
  dashboardProfileSuccess,
  readDashboardProfileJson,
} from "@/lib/dashboard-canvas/persistence/http";
import {
  dashboardProfileIdSchema,
  dashboardProfilePatchSchema,
  dashboardProfileVersionSchema,
  dashboardCardsMatchPageLayout,
} from "@/lib/dashboard-canvas/persistence/schema";
import {
  canEditDashboardProfilePage,
  dashboardCardsMatchPageCatalog,
} from "@/lib/dashboard-canvas/persistence/catalog";
import {
  dashboardPagePath,
  deleteDashboardProfile,
  getDashboardProfile,
  updateDashboardProfile,
} from "@/lib/dashboard-canvas/persistence/server";
import { isSameOriginRequest } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRouteContext = { params: Promise<{ id: string }> };

async function loadAuthorizedProfile(profileId: string) {
  const existing = await getDashboardProfile(profileId);
  if (existing.error || !existing.data) {
    return { ok: false as const, response: dashboardProfileRpcFailure(existing.error) };
  }
  const pathname = dashboardPagePath(existing.data.pageKey);
  if (!pathname) return { ok: false as const, response: dashboardProfileFailure("forbidden", 403) };
  const authorization = await authorizePageRoute(pathname);
  if (!authorization.ok) return authorization;
  if (!canEditDashboardProfilePage(existing.data.pageKey, authorization.context.roleKey)) {
    return { ok: false as const, response: dashboardProfileFailure("forbidden", 403) };
  }
  return { ok: true as const, profile: existing.data, context: authorization.context };
}

export async function PATCH(request: Request, context: ProfileRouteContext) {
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return dashboardProfileFailure("invalid_origin", 403);
  }
  const { id } = await context.params;
  const profileId = dashboardProfileIdSchema.safeParse(id);
  if (!profileId.success) return dashboardProfileFailure("invalid_profile_id", 400);
  const body = await readDashboardProfileJson(request);
  if (!body.ok) return body.response;
  const input = dashboardProfilePatchSchema.safeParse(body.value);
  if (!input.success) return dashboardProfileFailure("invalid_profile", 400);
  try {
    const authorization = await loadAuthorizedProfile(profileId.data);
    if (!authorization.ok) return authorization.response;
    if (
      input.data.cards &&
      !dashboardCardsMatchPageCatalog(authorization.profile.pageKey, input.data.cards)
    ) {
      return dashboardProfileFailure("invalid_profile_catalog", 400);
    }
    if (
      input.data.cards &&
      !dashboardCardsMatchPageLayout(authorization.profile.pageKey, input.data.cards)
    ) {
      return dashboardProfileFailure("invalid_profile_layout", 400);
    }
    const result = await updateDashboardProfile(profileId.data, input.data);
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

export async function DELETE(request: Request, context: ProfileRouteContext) {
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    return dashboardProfileFailure("invalid_origin", 403);
  }
  const { id } = await context.params;
  const profileId = dashboardProfileIdSchema.safeParse(id);
  const rawVersion = new URL(request.url).searchParams.get("version");
  const version = dashboardProfileVersionSchema.safeParse(
    rawVersion && /^\d+$/u.test(rawVersion) ? Number(rawVersion) : Number.NaN,
  );
  if (!profileId.success || !version.success) {
    return dashboardProfileFailure("invalid_profile_version", 400);
  }
  try {
    const authorization = await loadAuthorizedProfile(profileId.data);
    if (!authorization.ok) return authorization.response;
    const result = await deleteDashboardProfile(profileId.data, version.data);
    if (result.error || !result.data) return dashboardProfileRpcFailure(result.error);
    return dashboardProfileSuccess(result.data);
  } catch {
    return dashboardProfileFailure("dashboard_profiles_unavailable", 503);
  }
}
