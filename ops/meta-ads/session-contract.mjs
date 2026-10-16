export const META_ADS_ACCOUNT_ID = "1080988750909489";
export const META_ADS_BUSINESS_ID = "310106776631136";
export const META_ADS_CDP_URL = "http://127.0.0.1:9224";
export const META_ADS_MANAGER_URL =
  `https://adsmanager.facebook.com/adsmanager/manage/campaigns/?global_scope_id=${META_ADS_BUSINESS_ID}` +
  `&business_id=${META_ADS_BUSINESS_ID}&act=${META_ADS_ACCOUNT_ID}&nav_entry_point=am_global_scope_selector`;

export function assertCdpConfiguration(environment = process.env) {
  if (environment.META_ADS_CDP_URL && environment.META_ADS_CDP_URL !== META_ADS_CDP_URL) {
    throw new Error("Meta Ads CDP must use the dedicated fixed loopback endpoint");
  }
  return META_ADS_CDP_URL;
}

export function inspectPageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (
      ![
        "adsmanager.facebook.com",
        "business.facebook.com",
        "www.facebook.com",
        "facebook.com",
      ].includes(url.hostname)
    ) {
      return null;
    }
    if (
      /^\/(?:login|checkpoint|two_step_verification|recover)(?:[/.]|$)/.test(url.pathname) ||
      (url.hostname === "business.facebook.com" && /^\/business\/loginpage\/?$/.test(url.pathname))
    ) {
      return { kind: "login" };
    }
    if (url.hostname !== "adsmanager.facebook.com" || !url.pathname.startsWith("/adsmanager/")) {
      return null;
    }
    const account = url.searchParams.getAll("act");
    const business = url.searchParams.getAll("business_id");
    const globalScope = url.searchParams.getAll("global_scope_id");
    if (account.length !== 1 || business.length !== 1 || globalScope.length > 1) {
      return { kind: "ambiguous" };
    }
    return {
      kind:
        account[0] === META_ADS_ACCOUNT_ID &&
        business[0] === META_ADS_BUSINESS_ID &&
        (!globalScope.length || globalScope[0] === META_ADS_BUSINESS_ID)
          ? "workspace"
          : "wrong_account",
    };
  } catch {
    return null;
  }
}

export function isReadOnlyCampaignsUrl(value) {
  if (inspectPageUrl(value)?.kind !== "workspace") return false;
  const url = new URL(value);
  const parameters = [...url.searchParams.keys()];
  const sessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return (
    /^\/adsmanager\/manage\/campaigns\/?$/.test(url.pathname) &&
    !url.hash &&
    new Set(parameters).size === parameters.length &&
    parameters.every((key) => {
      // Meta adds these transient navigation values after an interactive login.
      // Validate them in memory only; never persist them or send them to CRM.
      if (key === "biz_login_source") {
        return url.searchParams.get(key) === "biz_unified_f3_fb_login_button";
      }
      if (key === "join_id" || key === "redirect_session_id") {
        return sessionId.test(url.searchParams.get(key));
      }
      return ["global_scope_id", "business_id", "act", "nav_entry_point"].includes(key);
    })
  );
}
