const SALESFORCE_ORIGIN = "https://direcional.my.salesforce.com";
const SALESFORCE_PAGE_HOSTS = new Set([
  "direcional.my.salesforce.com",
  "direcional.lightning.force.com",
]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

function parsedUrl(value, errorMessage) {
  try {
    return new URL(value);
  } catch {
    throw new Error(errorMessage);
  }
}

export function safeCdpEndpoint(value = "http://127.0.0.1:9222") {
  const endpoint = parsedUrl(value, "invalid Salesforce CDP endpoint");
  if (
    !["http:", "https:", "ws:", "wss:"].includes(endpoint.protocol) ||
    !LOOPBACK_HOSTS.has(endpoint.hostname) ||
    endpoint.username ||
    endpoint.password
  ) {
    throw new Error("Salesforce CDP endpoint must use loopback without credentials");
  }
  return endpoint.toString();
}

export function isSalesforceWorkspaceUrl(value) {
  const pageUrl = parsedUrl(value, "invalid Salesforce page URL");
  return pageUrl.protocol === "https:" && SALESFORCE_PAGE_HOSTS.has(pageUrl.hostname);
}

export async function refreshSalesforceSession(context, options = {}) {
  const reloadTimeoutMs = options.reloadTimeoutMs ?? 45_000;
  const page = context.pages().find((candidate) => {
    try {
      return isSalesforceWorkspaceUrl(candidate.url());
    } catch {
      return false;
    }
  });
  if (!page) {
    throw new Error("Salesforce workspace page unavailable; manual login required");
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: reloadTimeoutMs });
  if (!isSalesforceWorkspaceUrl(page.url())) {
    throw new Error("Salesforce session left the workspace; manual login required");
  }

  const cookies = await context.cookies(SALESFORCE_ORIGIN);
  const session = cookies.find((cookie) => cookie.name === "sid" && cookie.value);
  if (!session) {
    throw new Error("Salesforce session unavailable; manual login required");
  }
  return session.value;
}
