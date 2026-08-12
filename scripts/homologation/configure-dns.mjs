import { readFile, stat } from "node:fs/promises";
import process from "node:process";

const tokenPath = "/etc/descomplica-crm/hostinger-api.env";
const apiRoot = "https://developers.hostinger.com/api/dns/v1";
const domain = "descomplicapro.com.br";
const recordName = "homolog";
const expectedAddress = "187.127.249.50";
const expectedRecord = {
  name: recordName,
  type: "A",
  ttl: 300,
  records: [{ content: expectedAddress }],
};

function fail(message) {
  throw new Error(message);
}

async function privateToken() {
  if (process.getuid?.() !== 0) fail("DNS configuration requires root.");
  const fileStat = await stat(tokenPath);
  if ((fileStat.mode & 0o077) !== 0) fail("Hostinger token storage is not private.");
  const contents = await readFile(tokenPath, "utf8");
  const match = contents.match(/^HAPI_API_TOKEN=([A-Za-z0-9._-]{20,2048})\n?$/);
  if (!match) fail("Hostinger token storage is invalid.");
  return match[1];
}

async function request(token, pathname, options = {}) {
  const response = await fetch(`${apiRoot}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail(`Hostinger DNS request failed with status ${response.status}.`);
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? await response.json() : null;
}

function matchingRecords(zone) {
  if (!Array.isArray(zone)) fail("Hostinger DNS zone response is invalid.");
  return zone.filter((record) => {
    const name = typeof record?.name === "string" ? record.name.replace(/\.$/, "") : "";
    return name === recordName || name === `${recordName}.${domain}`;
  });
}

async function main() {
  const token = await privateToken();
  const pathname = `/zones/${domain}`;
  const before = await request(token, pathname);
  if (matchingRecords(before).length !== 0) {
    fail("Homologation DNS name already exists; refusing to alter it.");
  }

  const body = JSON.stringify({ overwrite: false, zone: [expectedRecord] });
  await request(token, `${pathname}/validate`, { method: "POST", body });
  await request(token, pathname, { method: "PUT", body });

  const after = matchingRecords(await request(token, pathname));
  if (
    after.length !== 1 ||
    after[0]?.type !== "A" ||
    !Array.isArray(after[0]?.records) ||
    after[0].records.length !== 1 ||
    after[0].records[0]?.content !== expectedAddress
  ) {
    fail("Homologation DNS verification failed after the authorized update.");
  }
  process.stdout.write("Homologation DNS A record created and verified; token=not-printed.\n");
}

try {
  await main();
} catch {
  process.stderr.write("Homologation DNS configuration failed; token=not-printed.\n");
  process.exitCode = 1;
}
