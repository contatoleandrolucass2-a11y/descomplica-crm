import { lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

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
  await holdBrowserSession(browser);
}

export async function holdBrowserSession(
  browser,
  { signalSource = process, log = console.log } = {},
) {
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await browser.close();
  }
  const onSignal = () => void stop().catch(() => {});
  const signals = ["SIGTERM", "SIGINT", "SIGHUP"];
  for (const signal of signals) signalSource.once(signal, onSignal);
  const closed = new Promise((resolve) => browser.once("close", resolve));
  try {
    const page = browser.pages()[0] ?? (await browser.newPage());
    try {
      await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 60_000 });
    } catch {
      if (!stopping) log("qlik_navigation_pending");
    }
    await closed;
  } finally {
    for (const signal of signals) signalSource.removeListener(signal, onSignal);
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    console.error("qlik_browser_unavailable");
    process.exitCode = 1;
  });
}
