import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import process from "node:process";

import {
  discoverLocalSupabase,
  fixtureSetupSql,
  runLocalSql,
  verifyFixturesThroughRls,
} from "../qa/local-authenticated-visual.mjs";

const accountsPath = "/etc/descomplica-crm/homologation-accounts.json";
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const requiredRoles = new Set([
  "master",
  "admin",
  "manager",
  "broker",
  "coordinator",
  "real_estate",
  "house",
  "partnership_channel",
  "pending",
]);

function fail(message) {
  throw new Error(message);
}

async function readSyntheticAccounts() {
  if (process.env.HOMOLOGATION_MODE !== "true" || process.env.QA_SUPABASE_WORKDIR !== runtimeRoot) {
    fail("Visual fixture provisioning is restricted to isolated homologation.");
  }

  const fileStat = await stat(accountsPath);
  if ((fileStat.mode & 0o077) !== 0) {
    fail("Homologation account storage must be private.");
  }

  let payload;
  try {
    payload = JSON.parse(await readFile(accountsPath, "utf8"));
  } catch {
    fail("Homologation account storage is invalid.");
  }

  if (
    payload?.schemaVersion !== 1 ||
    payload.environment !== "isolated-homologation" ||
    payload.dataClassification !== "synthetic-only" ||
    !/^\d{10,}-[a-f0-9]{12}$/.test(payload.visualRunId ?? "") ||
    !Array.isArray(payload.accounts) ||
    payload.accounts.length !== requiredRoles.size
  ) {
    fail("Homologation account matrix is invalid.");
  }

  const roles = new Set(payload.accounts.map((account) => account?.role));
  if (
    roles.size !== requiredRoles.size ||
    [...requiredRoles].some((role) => !roles.has(role)) ||
    payload.accounts.some(
      (account) =>
        typeof account?.id !== "string" ||
        typeof account?.email !== "string" ||
        typeof account?.password !== "string" ||
        !account.email.endsWith("@local.invalid") ||
        account.password.length < 20,
    )
  ) {
    fail("Homologation account matrix is incomplete.");
  }

  return payload;
}

function homologationGrantsSql() {
  return `
insert into public.role_permissions (role_key, permission_key)
values
  ('master', 'crm.read_model_v3.view'),
  ('master', 'crm.read_model_v3.ranking.view'),
  ('master', 'crm.read_model_v3.partnerships.view'),
  ('master', 'crm.read_model_v3.stock.view')
on conflict (role_key, permission_key) do nothing;
`;
}

function atomicProvisioningSql({ marker, userId }) {
  const fixtureSql = fixtureSetupSql({ marker, userId, reuseExistingMaster: true });
  return fixtureSql.replace(/^\s*begin;/, `begin;\n${homologationGrantsSql()}`);
}

async function persistMarker(payload, marker) {
  const temporary = `${accountsPath}.tmp-${process.pid}`;
  const updated = { ...payload, visualSourceMarker: marker };
  try {
    await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, accountsPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function main() {
  const payload = await readSyntheticAccounts();
  const master = payload.accounts.find((account) => account.role === "master");
  const marker = `QA local synthetic — not production · run ${payload.visualRunId}`;
  const local = await discoverLocalSupabase();

  if (payload.visualSourceMarker && payload.visualSourceMarker !== marker) {
    fail("Homologation visual marker does not match its synthetic account run.");
  }
  if (!payload.visualSourceMarker) {
    try {
      await verifyFixturesThroughRls({
        apiUrl: local.apiUrl,
        publishableKey: local.publishableKey,
        account: master,
        marker,
      });
    } catch {
      runLocalSql(
        local.database,
        atomicProvisioningSql({ marker, userId: master.id }),
        "atomic persistent synthetic fixture setup",
      );
    }
  }
  await verifyFixturesThroughRls({
    apiUrl: local.apiUrl,
    publishableKey: local.publishableKey,
    account: master,
    marker,
  });
  if (!payload.visualSourceMarker) await persistMarker(payload, marker);
  process.stdout.write("Homologation visual fixtures: synthetic=1 profiles=9 v3_grants=4\n");
}

try {
  await main();
} catch {
  process.stderr.write("Homologation visual fixture provisioning failed.\n");
  process.exitCode = 1;
}
