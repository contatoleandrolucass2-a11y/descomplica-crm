import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import {
  assertCdpPortAvailable,
  assertInteractiveEnvironment,
  runDedicatedChrome,
} from "../salesforce/launch-dedicated-chrome.mjs";
import { assertCdpConfiguration, META_ADS_MANAGER_URL } from "./session-contract.mjs";

export const PROFILE_DIRECTORY = "/var/lib/descomplica-meta-ads/chrome";
const MARKER = ".descomplica-meta-ads-profile";
const MARKER_CONTENT = "descomplica-crm meta ads chrome profile v1\n";

// Only the process supervisor is shared with Salesforce. Profile, origin and
// listeners are fixed independently, and no Salesforce session is accessed.
export async function prepareMetaAdsProfile(directory = PROFILE_DIRECTORY) {
  if (
    !directory.startsWith("/") ||
    path.normalize(directory) !== directory ||
    (await realpath(path.dirname(directory))) !== path.dirname(directory)
  ) {
    throw new Error("Meta Ads profile must have a real absolute parent directory");
  }
  const parent = await lstat(path.dirname(directory));
  if (parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) {
    throw new Error("Meta Ads profile parent must be private and owned by the dedicated user");
  }
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  return validateMetaAdsProfile(directory);
}

async function validateMetaAdsProfile(directory) {
  const metadata = await lstat(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== process.getuid() ||
    (metadata.mode & 0o077) !== 0
  ) {
    throw new Error("Meta Ads profile must be a private directory owned by the dedicated user");
  }
  const entries = await readdir(directory);
  if (!entries.includes(MARKER)) {
    if (entries.length) throw new Error("Meta Ads refuses an existing unmarked Chrome profile");
    await writeFile(`${directory}/${MARKER}`, MARKER_CONTENT, { flag: "wx", mode: 0o600 });
  }
  const marker = await lstat(`${directory}/${MARKER}`);
  if (
    !marker.isFile() ||
    marker.isSymbolicLink() ||
    marker.uid !== process.getuid() ||
    (marker.mode & 0o077) !== 0 ||
    (await readFile(`${directory}/${MARKER}`, "utf8")) !== MARKER_CONTENT
  ) {
    throw new Error("Meta Ads profile marker is invalid");
  }
  return realpath(directory);
}

export function buildChromeArguments() {
  return [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9224",
    `--user-data-dir=${PROFILE_DIRECTORY}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    META_ADS_MANAGER_URL,
  ];
}

export async function launchMetaAdsChrome(environment = process.env) {
  if (process.platform !== "linux")
    throw new Error("Meta Ads browser requires the dedicated Linux host");
  assertInteractiveEnvironment({ env: environment });
  assertCdpConfiguration(environment);
  await prepareMetaAdsProfile();
  await assertCdpPortAvailable(9224);
  return runDedicatedChrome({
    executable: "/usr/bin/google-chrome-stable",
    arguments_: buildChromeArguments(),
    port: 9224,
    supervised: true,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Meta Ads launcher accepts no arguments");
    await launchMetaAdsChrome();
  } catch {
    process.stderr.write("Meta Ads browser unavailable; inspect dedicated host configuration.\n");
    process.exitCode = 1;
  }
}
