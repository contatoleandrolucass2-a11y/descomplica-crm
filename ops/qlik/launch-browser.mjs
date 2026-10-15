import { lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { collectBrowserMetadata } from "./browser-preflight.mjs";
import { startQlikCollectionLoop } from "./collection-loop.mjs";
import { writeMetadataArtifact } from "./metadata-artifact.mjs";
import { loginAttemptStore } from "./login-attempt.mjs";

const PROFILE = "/var/lib/descomplica-qlik/chrome";
const ORIGIN = "https://direcional.us.qlikcloud.com/";

async function main() {
  if (process.platform !== "linux" || !process.getuid?.() || process.env.DISPLAY !== ":98") {
    throw new Error("dedicated_qlik_environment_required");
  }
  const profile = await lstat(PROFILE);
  if (
    !profile.isDirectory() ||
    profile.isSymbolicLink() ||
    profile.uid !== process.getuid() ||
    (profile.mode & 0o777) !== 0o700
  ) {
    throw new Error("private_qlik_profile_required");
  }
  const browser = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "/usr/bin/google-chrome-stable",
    headless: false,
    chromiumSandbox: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    viewport: null,
    acceptDownloads: false,
    args: ["--no-first-run", "--no-default-browser-check"],
  });
  const metadataOnly = process.env.QLIK_METADATA_PREFLIGHT === "enabled";
  await holdBrowserSession(browser, {
    navigate: !metadataOnly,
    startCollection: metadataOnly
      ? (signal) =>
          startQlikCollectionLoop({
            signal,
            timeoutMs: 300_000,
            collect: async (options) => {
              const result = await collectAuthenticatedMetadata(browser, options);
              if (options.signal.aborted) return { state: "unavailable" };
              await writeMetadataArtifact(result);
              return {
                state:
                  result.status === "reauth_required"
                    ? "reauth_required"
                    : result.status === "inspected"
                      ? "succeeded"
                      : "unavailable",
              };
            },
          })
      : undefined,
  });
}

export async function collectAuthenticatedMetadata(
  browser,
  options,
  {
    renew = async (...args) => (await import("./browser-login.mjs")).renewBrowserLogin(...args),
    collect = collectBrowserMetadata,
    attempts = loginAttemptStore,
  } = {},
) {
  if (options.signal.aborted) return { status: "unavailable", reason: "cancelled" };
  try {
    const store = attempts();
    const login = await renew(browser, { ...options, ...store });
    if (options.signal.aborted) return { status: "unavailable", reason: "cancelled" };
    if (login?.status === "reauth_required") {
      const reasons = new Set([
        "mfa_required",
        "captcha_required",
        "credential_rejected",
        "attempt_blocked",
        "account_mismatch",
      ]);
      return {
        status: "reauth_required",
        reason: reasons.has(login.reason) ? login.reason : "login_required",
      };
    }
    if (login?.status !== "authenticated")
      return { status: "unavailable", reason: "login_unavailable" };
    const result = await collect(browser, options);
    if (options.signal.aborted) return { status: "unavailable", reason: "cancelled" };
    return result;
  } catch {
    return { status: "unavailable", reason: "login_unavailable" };
  }
}

export async function holdBrowserSession(
  browser,
  { signalSource = process, log = console.log, startCollection, navigate = true } = {},
) {
  let stopping = false;
  const abort = new AbortController();
  let collection;
  async function stop() {
    if (stopping) return;
    stopping = true;
    abort.abort();
    await browser.close();
  }
  const onSignal = () => void stop().catch(() => {});
  const signals = ["SIGTERM", "SIGINT", "SIGHUP"];
  for (const signal of signals) signalSource.once(signal, onSignal);
  const closed = new Promise((resolve) =>
    browser.once("close", () => {
      abort.abort();
      resolve();
    }),
  );
  try {
    const page = browser.pages()[0] ?? (await browser.newPage());
    if (navigate) {
      try {
        await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 60_000 });
      } catch {
        if (!stopping) log("qlik_navigation_pending");
      }
    }
    if (!abort.signal.aborted && startCollection) {
      collection = Promise.resolve()
        .then(() => startCollection(abort.signal))
        .catch(() => {
          if (!abort.signal.aborted) log("qlik_metadata_preflight_unavailable");
        });
    }
    await closed;
  } finally {
    abort.abort();
    for (const signal of signals) signalSource.removeListener(signal, onSignal);
    await browser.close();
    await collection;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    console.error("qlik_browser_unavailable");
    process.exitCode = 1;
  });
}
