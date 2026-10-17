import { constants } from "node:fs";
import http from "node:http";
import { open } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { z } from "zod";
import {
  assertCdpConfiguration,
  inspectPageUrl,
  isReadOnlyCampaignsUrl,
  META_ADS_ACCOUNT_ID,
  META_ADS_BUSINESS_ID,
} from "./session-contract.mjs";

export const STATUS_INTERVAL_MS = 45_000;
export const observationSchema = z
  .object({
    version: z.literal(1),
    observedAt: z.iso.datetime(),
    state: z.enum(["connected", "reauth_required", "unavailable", "wrong_account"]),
    accountId: z.literal(META_ADS_ACCOUNT_ID),
    businessId: z.literal(META_ADS_BUSINESS_ID),
  })
  .strict();

export async function withDeadline(operation, signal) {
  signal.throwIfAborted();
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(new Error("Meta Ads operation cancelled"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

export function gatewayRequest(
  method,
  requestPath,
  { signal, lease, request = http.request } = {},
) {
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req,
      response,
      settled = false;
    const finish = (value = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      response?.destroy();
      req?.destroy();
      resolve(value);
    };
    const abort = () => finish();
    const timer = setTimeout(abort, 2000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      req = request(
        {
          hostname: "127.0.0.1",
          port: 6083,
          path: requestPath,
          method,
          agent: false,
          maxHeaderSize: 2048,
          headers: {
            Accept: "application/json",
            "Content-Length": "0",
            ...(lease ? { "X-Meta-Probe-Lease": lease } : {}),
          },
        },
        (res) => {
          response = res;
          if (
            ![200, 201].includes(res.statusCode) ||
            !/^application\/json(?:\s*;|$)/i.test(res.headers["content-type"] ?? "")
          )
            return finish();
          let size = 0;
          const chunks = [];
          res.on("error", abort);
          res.on("aborted", abort);
          res.on("data", (chunk) => {
            size += chunk.length;
            if (size > 2048) finish();
            else chunks.push(chunk);
          });
          res.on("end", () => {
            try {
              finish(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
              finish();
            }
          });
        },
      );
      req.on("error", abort);
      req.end();
    } catch {
      finish();
    }
  });
}

export async function acquireProbeLease(options = {}) {
  const send = options.gatewayRequest ?? gatewayRequest;
  const active = await send("GET", "/session-active", options);
  if (active?.active !== false) return null;
  const receipt = await send("POST", "/session-probe", options);
  return /^[a-f0-9]{48}$/.test(receipt?.lease ?? "") ? receipt.lease : null;
}

// This function runs inside the existing page. It reads only visible DOM and
// returns booleans. It never reads cookies, storage, scripts, network traffic,
// credentials, campaign rows or private Meta APIs, and never clicks a control.
export function readVisibleSessionEvidence({ accountId }) {
  const visible = (element) => {
    if (!element || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  };
  const text = (element) =>
    (element.getAttribute("aria-label") || element.innerText || "").trim().replace(/\s+/g, " ");
  const labels = Array.from(
    document.querySelectorAll(
      '[role="tab"], [role="heading"], h1, h2, button, [role="button"], [role="combobox"]',
    ),
  )
    .slice(0, 2000)
    .filter(visible)
    .map((element) => ({ element, label: text(element) }));
  const hasLabel = (expression) => labels.some(({ label }) => expression.test(label));
  const login =
    Array.from(
      document.querySelectorAll('input[type="password"], input[name="email"], input[name="pass"]'),
    ).some(visible) ||
    hasLabel(
      /^(?:Entrar no Gerenciador de Anúncios|Log in to Ads Manager|Continuar com o Facebook|Continue with Facebook|Entrar com uma Conta Meta gerenciada|Log in with a managed Meta account)$/i,
    );
  const campaigns = hasLabel(/^(?:Campanhas|Campaigns)(?:\s*\(\d+\))?$/i);
  const adSets = hasLabel(/^(?:Conjuntos de anúncios|Ad sets)(?:\s*\(\d+\))?$/i);
  const ads = hasLabel(/^(?:Anúncios|Ads)(?:\s*\(\d+\))?$/i);
  const accountControl = labels.some(
    ({ element, label }) =>
      element.matches('button, [role="button"], [role="combobox"]') &&
      label.length <= 512 &&
      new RegExp(`(?:^|\\D)${accountId}(?:\\D|$)`).test(label),
  );
  const denied = hasLabel(
    /^(?:Você não tem permissão|Você não tem acesso|You do not have permission|You don't have access|Access denied|Acesso negado|Algo deu errado|Something went wrong)(?:[.!:]|$)/i,
  );
  const editing =
    Boolean(document.activeElement?.matches('input, textarea, [contenteditable="true"]')) ||
    Array.from(
      document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], textarea, [contenteditable="true"]',
      ),
    ).some(visible) ||
    hasLabel(/^(?:Publicar|Publish|Descartar rascunho|Discard draft|Salvar rascunho|Save draft)$/i);
  return { login, campaigns, adSets, ads, accountControl, denied, editing };
}

export function classifyEvidence(route, evidence) {
  if (route?.kind === "login" || evidence?.login === true) return "reauth_required";
  if (route?.kind === "wrong_account") return "wrong_account";
  if (route?.kind !== "workspace" || evidence?.denied !== false || evidence?.editing !== false)
    return "unavailable";
  return evidence.campaigns === true &&
    evidence.adSets === true &&
    evidence.ads === true &&
    evidence.accountControl === true
    ? "connected"
    : "unavailable";
}

export async function probeMetaAdsConnection(environment = process.env, options = {}) {
  const endpoint = assertCdpConfiguration(environment);
  const signal = AbortSignal.any([
    AbortSignal.timeout(options.timeoutMs ?? 15_000),
    ...(options.signal ? [options.signal] : []),
  ]);
  let browser;
  let lease;
  try {
    browser = await withDeadline(async () => {
      const connected = await (options.connect ?? chromium.connectOverCDP.bind(chromium))(
        endpoint,
        { timeout: 10_000 },
      );
      if (signal.aborted) {
        void connected.close().catch(() => {});
        throw new Error("Meta Ads probe cancelled");
      }
      return connected;
    }, signal);
    const pages = browser
      .contexts()
      .flatMap((context) => context.pages())
      .map((page) => ({ page, route: inspectPageUrl(page.url()) }))
      .filter(({ route }) => route);
    if (pages.some(({ route }) => route.kind === "login")) return "reauth_required";
    // Multiple workspaces can leave a stale tab authenticated. Ambiguous tabs
    // never prove the account currently displayed to the operator.
    if (pages.length !== 1) return "unavailable";
    const { page, route } = pages[0];
    if (route.kind === "wrong_account") return "wrong_account";
    if (route.kind !== "workspace") return "unavailable";
    const initial = await withDeadline(
      () => page.evaluate(readVisibleSessionEvidence, { accountId: META_ADS_ACCOUNT_ID }),
      signal,
    );
    if (initial?.login === true) return "reauth_required";
    if (initial?.editing !== false || !isReadOnlyCampaignsUrl(page.url())) return "unavailable";
    lease = await withDeadline(
      () => (options.acquireLease ?? acquireProbeLease)({ ...options, signal }),
      signal,
    );
    if (!lease) return "unavailable";
    const lockedEvidence = await withDeadline(
      () => page.evaluate(readVisibleSessionEvidence, { accountId: META_ADS_ACCOUNT_ID }),
      signal,
    );
    if (!isReadOnlyCampaignsUrl(page.url()) || lockedEvidence?.editing !== false)
      return "unavailable";
    if (lockedEvidence?.login === true) return "reauth_required";
    // Only the read-only canonical campaigns screen is refreshed, while the
    // gateway holds an exclusive lease that prevents a console opening.
    await withDeadline(() => page.reload({ waitUntil: "domcontentloaded", timeout: 8000 }), signal);
    const refreshedRoute = inspectPageUrl(page.url());
    if (refreshedRoute?.kind === "login") return "reauth_required";
    if (refreshedRoute?.kind === "wrong_account") return "wrong_account";
    if (!isReadOnlyCampaignsUrl(page.url())) return "unavailable";
    // Do not reuse initial evidence. The refreshed UI must prove every field.
    let evidence;
    const uiDeadline = Date.now() + 4000;
    do {
      evidence = await withDeadline(
        () => page.evaluate(readVisibleSessionEvidence, { accountId: META_ADS_ACCOUNT_ID }),
        signal,
      );
      if (
        classifyEvidence(refreshedRoute, evidence) !== "unavailable" ||
        evidence?.denied === true ||
        evidence?.editing === true
      )
        break;
      await wait(200, undefined, { signal });
    } while (Date.now() < uiDeadline);
    // A navigation during the DOM probe invalidates that observation.
    if (inspectPageUrl(page.url())?.kind !== "workspace") return "unavailable";
    return classifyEvidence(route, evidence);
  } catch {
    return "unavailable";
  } finally {
    // connectOverCDP attaches to the dedicated process; closing this connection
    // disconnects Playwright and does not terminate Chrome or its profile.
    if (browser)
      await withDeadline(() => browser.close(), AbortSignal.timeout(5000)).catch(() => {});
    if (lease)
      await (
        options.releaseLease ??
        ((value) => gatewayRequest("DELETE", "/session-probe", { lease: value }))
      )(lease).catch(() => {});
  }
}

export async function statusDestination(environment = process.env) {
  if (environment.META_ADS_STATUS_ENABLED !== "true") return null;
  let origin;
  try {
    origin = new URL(environment.META_ADS_CRM_ORIGIN);
  } catch {
    throw new Error("Meta Ads status origin is invalid");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("Meta Ads status requires a credential-free HTTPS origin");
  }
  const secretPath = environment.META_ADS_STATUS_SECRET_FILE;
  if (!secretPath || !path.isAbsolute(secretPath))
    throw new Error("Meta Ads status secret path must be absolute");
  // Open once with O_NOFOLLOW and inspect that descriptor to avoid a symlink
  // or time-of-check/time-of-use replacement of the bearer file.
  const file = await open(secretPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await file.stat();
    if (
      !metadata.isFile() ||
      metadata.nlink !== 1 ||
      (metadata.mode & 0o077) !== 0 ||
      metadata.uid !== process.getuid() ||
      metadata.size > 258
    ) {
      throw new Error("Meta Ads status secret must be a private owner-only regular file");
    }
    const secret = (await file.readFile("utf8")).replace(/\r?\n$/, "");
    if (secret.length < 32 || secret.length > 256 || !/^[A-Za-z0-9._~+/-]+={0,2}$/u.test(secret))
      throw new Error("Meta Ads status secret is invalid");
    return { url: new URL("/api/meta-ads/status", origin), secret };
  } finally {
    await file.close();
  }
}

export async function sendConnectionObservation(destination, observation, options = {}) {
  const body = JSON.stringify(observationSchema.parse(observation));
  const signal = AbortSignal.any([
    AbortSignal.timeout(10_000),
    ...(options.signal ? [options.signal] : []),
  ]);
  const response = await withDeadline(
    () =>
      (options.fetch ?? fetch)(destination.url, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${destination.secret}`,
          "content-type": "application/json",
        },
        body,
        signal,
      }),
    signal,
  );
  if (response.status !== 202) throw new Error("Meta Ads status receipt was not accepted");
  const receipt = await withDeadline(() => response.json(), signal);
  if (receipt?.ok !== true) throw new Error("Meta Ads status receipt was not confirmed");
}

export async function runConnectionMonitor(environment = process.env, options = {}) {
  const destination = await statusDestination(environment);
  if (!destination) return;
  const now = options.now ?? Date.now;
  const log =
    options.log ??
    ((message) =>
      process.stdout.write(
        `${JSON.stringify({ time: new Date(now()).toISOString(), message })}\n`,
      ));
  while (!options.signal?.aborted) {
    const state = await (options.probe ?? probeMetaAdsConnection)(environment, options);
    if (options.signal?.aborted) break;
    const observation = {
      version: 1,
      observedAt: new Date(now()).toISOString(),
      state,
      accountId: META_ADS_ACCOUNT_ID,
      businessId: META_ADS_BUSINESS_ID,
    };
    try {
      await (options.send ?? sendConnectionObservation)(destination, observation, options);
    } catch {
      log("Meta Ads status could not reach CRM; the previous receipt will expire");
    }
    try {
      await (options.wait ?? wait)(
        STATUS_INTERVAL_MS,
        undefined,
        options.signal ? { signal: options.signal } : undefined,
      );
    } catch (error) {
      if (!options.signal?.aborted) throw error;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  runConnectionMonitor(process.env, { signal: controller.signal }).catch(() => {
    process.stderr.write("Meta Ads monitor unavailable; check private configuration.\n");
    process.exitCode = 1;
  });
}
