import { lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { collectBrowserMetadata } from "./browser-preflight.mjs";
import { startQlikCollectionLoop } from "./collection-loop.mjs";
import { writeMetadataArtifact } from "./metadata-artifact.mjs";
import { runRankingCycle } from "./ranking-cycle.mjs";
import { readRankingCredential } from "./ranking-credential.mjs";
import { writeRankingArtifact } from "./ranking-artifact.mjs";
import { loginAttemptStore } from "./login-attempt.mjs";
import { getBrowserRankingScript } from "./browser-ranking.mjs";
import { startQlikStatusMonitor } from "./status-monitor.mjs";

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
  const ranking = process.env.QLIK_RANKING_COLLECTION === "enabled";
  if (metadataOnly && ranking) {
    await browser.close();
    throw new Error("exclusive_qlik_collection_mode_required");
  }
  const rankingCollect = ranking
    ? (await import("./browser-ranking.mjs")).collectBrowserRanking
    : undefined;
  await holdBrowserSession(browser, {
    navigate: !(metadataOnly || ranking),
    startCollection: ranking
      ? (signal) =>
          startRankingCollection({
            signal,
            monitor: startQlikStatusMonitor({ signal }),
            authenticate: (options) => authenticateBrowserSession(browser, options),
            mappingFactory: async () =>
              (await import("./ranking-mapping.mjs")).createRankingMapping(),
            collect: (options) =>
              rankingCollect(browser, {
                ...options,
                onOwnerUnrecoverable: () => {
                  console.error("qlik_owner_unrecoverable");
                  process.exit(1);
                },
              }),
          })
      : metadataOnly
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

export function startRankingCollection({
  signal,
  collect,
  authenticate,
  // Legacy injected cycles may omit this; production main always supplies it.
  mappingFactory,
  credential = readRankingCredential,
  cycle = runRankingCycle,
  write = writeRankingArtifact,
  loop = startQlikCollectionLoop,
  clock = () => performance.now(),
  monitor,
}) {
  let completed;
  let collectionSignal;
  let startedAt;
  let elapsed;
  return loop({
    signal,
    intervalMs: 3_600_000,
    timeoutMs: 480_000,
    clock: () => {
      elapsed = NaN;
      const value = clock();
      if (startedAt === undefined) startedAt = value;
      elapsed = value - startedAt;
      return value;
    },
    onStatus: async ({ state }) => {
      if (state === "running") completed = undefined;
      // Reuse the loop's own clock samples, including its post-collection check.
      const acceptedFailure =
        ["unavailable", "reauth_required"].includes(state) &&
        state === completed?.state &&
        !collectionSignal?.aborted &&
        Number.isFinite(elapsed) &&
        elapsed >= 0 &&
        elapsed < 480_000;
      try {
        const result = state === "succeeded" || acceptedFailure ? completed : { state };
        await write(result);
        monitor?.update(result);
      } catch (error) {
        monitor?.update({ state: "unavailable" });
        throw error;
      } finally {
        if (state !== "running") startedAt = undefined;
      }
    },
    collect: async ({ signal: cycleSignal }) => {
      collectionSignal = cycleSignal;
      if (cycleSignal.aborted) return { state: "unavailable" };
      if (authenticate) {
        const login = await authenticate({ signal: cycleSignal });
        if (cycleSignal.aborted) return { state: "unavailable" };
        if (login?.status !== "authenticated") {
          completed = {
            state: login?.status === "reauth_required" ? "reauth_required" : "unavailable",
          };
          return completed;
        }
      }
      let cycleCollect = collect;
      if (mappingFactory !== undefined) {
        let mapping;
        try {
          mapping = structuredClone(await mappingFactory());
          if (cycleSignal.aborted) return { state: "unavailable" };
          if (mapping?.schemaVersion !== 1 || mapping?.verified !== true)
            throw new Error("mapping_invalid");
          const freeze = (value) => {
            if (value && typeof value === "object" && !Object.isFrozen(value)) {
              Object.freeze(value);
              Object.values(value).forEach(freeze);
            }
          };
          freeze(mapping);
          // Enforce the real browser serialization/scope boundary before HMAC access.
          await getBrowserRankingScript({ mapping });
        } catch {
          if (cycleSignal.aborted) return { state: "unavailable" };
          completed = { state: "unavailable", reason: "mapping_invalid" };
          return completed;
        }
        if (cycleSignal.aborted) return { state: "unavailable" };
        // One detached immutable snapshot belongs to both independent sessions.
        cycleCollect = (options) => collect({ ...options, mapping });
      }
      const secret = await credential();
      if (cycleSignal.aborted) return { state: "unavailable" };
      const result = await cycle({ signal: cycleSignal, collect: cycleCollect, secret });
      if (cycleSignal.aborted) return { state: "unavailable" };
      completed = result;
      return result;
    },
  });
}

export async function authenticateBrowserSession(
  browser,
  options,
  {
    renew = async (...args) => (await import("./browser-login.mjs")).renewBrowserLogin(...args),
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
    return { status: "authenticated" };
  } catch {
    return { status: "unavailable", reason: "login_unavailable" };
  }
}

export async function collectAuthenticatedMetadata(
  browser,
  options,
  { collect = collectBrowserMetadata, ...authentication } = {},
) {
  const login = await authenticateBrowserSession(browser, options, authentication);
  if (login.status !== "authenticated") return login;
  try {
    const result = await collect(browser, options);
    return options.signal.aborted ? { status: "unavailable", reason: "cancelled" } : result;
  } catch {
    return { status: "unavailable", reason: "collection_unavailable" };
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
