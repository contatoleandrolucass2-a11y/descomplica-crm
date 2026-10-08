import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

import {
  salesforceObservationSchema,
  salesforceReportKeys,
} from "../../lib/crm/salesforce/connection-contract.ts";
import { isSalesforceWorkspaceUrl, safeCdpEndpoint } from "./browser-session.mjs";
import { assertPrivateRegularFile } from "./private-file.mjs";
import { withSalesforceSignal } from "./report-request.mjs";

const SALESFORCE_ORIGIN = "https://direcional.my.salesforce.com";
const PROBE_URL = `${SALESFORCE_ORIGIN}/services/data/v61.0/analytics/reports/00OU600000DrfDeMAJ/describe`;
export const STATUS_INTERVAL_MS = 45_000;

export async function probeSalesforceConnection(environment = process.env, options = {}) {
  const now = options.now ?? Date.now;
  const result = (state, errorCode = null) => ({
    state,
    errorCode,
    checkedAt: new Date(now()).toISOString(),
  });
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), options.timeoutMs ?? 25_000);
  const signal = options.signal
    ? AbortSignal.any([deadline.signal, options.signal])
    : deadline.signal;
  let browser;
  try {
    browser = await withSalesforceSignal(async () => {
      const connected = await (options.connect ?? chromium.connectOverCDP.bind(chromium))(
        safeCdpEndpoint(environment.SALESFORCE_CDP_URL),
        { timeout: 10_000 },
      );
      if (signal.aborted) {
        void connected.close().catch(() => {});
        throw new Error("Salesforce probe cancelled");
      }
      return connected;
    }, signal);
    const context = browser.contexts()[0];
    const workspace = context?.pages().some((page) => {
      try {
        return isSalesforceWorkspaceUrl(page.url());
      } catch {
        return false;
      }
    });
    if (!workspace) return result("reauth_required", "session_expired");
    const session = (
      await withSalesforceSignal(() => context.cookies(SALESFORCE_ORIGIN), signal)
    ).find((cookie) => cookie.name === "sid" && cookie.value);
    if (!session) return result("reauth_required", "session_expired");
    const response = await withSalesforceSignal(
      () =>
        (options.fetch ?? fetch)(PROBE_URL, {
          headers: { authorization: `Bearer ${session.value}` },
          redirect: "manual",
          signal: AbortSignal.any([AbortSignal.timeout(10_000), signal]),
        }),
      signal,
    );
    if (response.status === 401 || (response.status >= 300 && response.status < 400)) {
      return result("reauth_required", "session_expired");
    }
    if (!response.ok) return result("unavailable", "salesforce_unavailable");
    const description = await withSalesforceSignal(() => response.json(), signal);
    if (!Array.isArray(description?.reportMetadata?.detailColumns)) {
      return result("unavailable", "salesforce_unavailable");
    }
    return result("connected");
  } catch {
    return result("unavailable", browser ? "salesforce_unavailable" : "browser_unavailable");
  } finally {
    clearTimeout(timer);
    if (browser)
      await withSalesforceSignal(() => browser.close(), AbortSignal.timeout(5_000)).catch(() => {});
  }
}

export async function statusDestination(environment, options = {}) {
  if (environment.SALESFORCE_STATUS_ENABLED !== "true") return null;
  let origin;
  try {
    origin = new URL(environment.SALESFORCE_CRM_ORIGIN);
  } catch {
    throw new Error("Salesforce status origin is invalid");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("Salesforce status requires a credential-free HTTPS origin");
  }
  const secretFile = environment.SALESFORCE_STATUS_SECRET_FILE;
  if (!secretFile || !path.isAbsolute(secretFile))
    throw new Error("Salesforce status secret path must be absolute");
  await assertPrivateRegularFile(secretFile, options.privateFileOptions);
  if ((await stat(secretFile)).size > 4098) throw new Error("Salesforce status secret is invalid");
  const secret = (await readFile(secretFile, "utf8")).replace(/\r?\n$/, "");
  if (secret.length < 32 || secret.length > 4096 || /[\r\n\0]/u.test(secret))
    throw new Error("Salesforce status secret is invalid");
  return { url: new URL("/api/salesforce/status", origin), secret };
}

export async function sendConnectionObservation(destination, observation, options = {}) {
  const body = JSON.stringify(salesforceObservationSchema.parse(observation));
  const response = await (options.fetch ?? fetch)(destination.url, {
    method: "POST",
    redirect: "error",
    headers: { authorization: `Bearer ${destination.secret}`, "content-type": "application/json" },
    body,
    signal: AbortSignal.any([
      AbortSignal.timeout(10_000),
      ...(options.signal ? [options.signal] : []),
    ]),
  });
  if (response.status !== 202) throw new Error("Salesforce status receipt was not accepted");
  const receipt = await response.json();
  if (receipt?.ok !== true) throw new Error("Salesforce status receipt was not confirmed");
}

export function createCollectorProgress(now = Date.now) {
  let value = {
    cycle: "idle",
    nextRunAt: null,
    lastExportAt: null,
    lastPublishedAt: null,
    reports: null,
    errorCode: null,
  };
  const collected = (candidate) => {
    const reports = salesforceReportKeys.map((key) => ({
      key,
      rows: candidate?.diagnostics?.sourceRows?.[key],
    }));
    if (reports.some((report) => !Number.isSafeInteger(report.rows) || report.rows < 0)) {
      throw new Error("Salesforce report counts are incomplete");
    }
    value = { ...value, lastExportAt: candidate.payload.dashboard.generatedAt, reports };
  };
  return {
    snapshot: () => structuredClone(value),
    start() {
      value = { ...value, cycle: "running", nextRunAt: null, errorCode: null };
    },
    scheduled(timestamp) {
      value.nextRunAt = new Date(timestamp).toISOString();
    },
    collected,
    succeed(candidate, published) {
      collected(candidate);
      value = {
        ...value,
        cycle: "succeeded",
        lastPublishedAt: published ? new Date(now()).toISOString() : value.lastPublishedAt,
        errorCode: null,
      };
    },
    fail(code = "export_failed") {
      value = { ...value, cycle: "failed", errorCode: code };
    },
  };
}

export async function runConnectionMonitor(environment = process.env, options = {}) {
  const destination = await statusDestination(environment, options);
  if (!destination) return;
  const now = options.now ?? Date.now;
  const signal = options.signal;
  const writeLog =
    options.log ??
    ((message) =>
      process.stdout.write(
        `${JSON.stringify({ time: new Date(now()).toISOString(), message })}\n`,
      ));
  const progress = options.progress ?? createCollectorProgress(now);
  while (!signal?.aborted) {
    const probe = await (options.probe ?? probeSalesforceConnection)(environment, options);
    const activity = progress.snapshot();
    const observation = {
      schemaVersion: 1,
      organization: "direcional",
      observedAt: new Date(now()).toISOString(),
      ...activity,
      ...probe,
      errorCode: activity.errorCode ?? probe.errorCode,
    };
    try {
      await (options.send ?? sendConnectionObservation)(destination, observation, options);
    } catch {
      writeLog("Salesforce status could not reach CRM; previous receipt will expire");
    }
    try {
      await (options.wait ?? wait)(STATUS_INTERVAL_MS, undefined, signal ? { signal } : undefined);
    } catch (error) {
      if (!signal?.aborted) throw error;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  runConnectionMonitor(process.env, { signal: controller.signal }).catch(() => {
    process.stderr.write("Salesforce monitor unavailable; check private configuration.\n");
    process.exitCode = 1;
  });
}
