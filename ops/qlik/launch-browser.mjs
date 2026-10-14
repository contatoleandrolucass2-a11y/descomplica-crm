import { lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { collectBrowserMetadata } from "./browser-preflight.mjs";
import { startQlikCollectionLoop } from "./collection-loop.mjs";
import { writeMetadataArtifact } from "./metadata-artifact.mjs";
import { runRankingCycle } from "./ranking-cycle.mjs";
import { readRankingCredential } from "./ranking-credential.mjs";
import { writeRankingArtifact } from "./ranking-artifact.mjs";

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
    startCollection: ranking
      ? (signal) =>
          startRankingCollection({
            signal,
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
              collect: async (options) => {
                const result = await collectBrowserMetadata(browser, options);
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
  credential = readRankingCredential,
  cycle = runRankingCycle,
  write = writeRankingArtifact,
  loop = startQlikCollectionLoop,
  clock = () => performance.now(),
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
        await write(state === "succeeded" || acceptedFailure ? completed : { state });
      } finally {
        if (state !== "running") startedAt = undefined;
      }
    },
    collect: async ({ signal: cycleSignal }) => {
      collectionSignal = cycleSignal;
      if (cycleSignal.aborted) return { state: "unavailable" };
      const secret = await credential();
      if (cycleSignal.aborted) return { state: "unavailable" };
      const result = await cycle({ signal: cycleSignal, collect, secret });
      if (cycleSignal.aborted) return { state: "unavailable" };
      completed = result;
      return result;
    },
  });
}

export async function holdBrowserSession(
  browser,
  { signalSource = process, log = console.log, startCollection } = {},
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
    try {
      await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 60_000 });
    } catch {
      if (!stopping) log("qlik_navigation_pending");
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
