import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { validatePrivateDirectory, validatePrivateFile } from "./production-release-lock.mjs";

export const maximumEnvironmentBytes = 65536;
const maximumSecretBytes = 4096;
const maximumBackupBytes = maximumEnvironmentBytes * 12 + 1024;
const backupDirectory = "/etc/descomplica-crm/config-backups";
const secretDirectory = "/etc/descomplica-crm/secrets";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const sha = /^[0-9a-f]{40}$/u;
const digest = /^[0-9a-f]{64}$/u;
const keys = Object.freeze([
  "SUPABASE_SECRET_KEY",
  "SALESFORCE_INGEST_SECRET",
  "SALESFORCE_INGEST_ENABLED",
  "SALESFORCE_REFRESH_ENABLED",
]);
const qlikKeys = Object.freeze(["QLIK_RANKING_V2_ENABLED", "QLIK_RANKING_V2_HMAC_SECRET"]);
const metaAdsKeys = Object.freeze([
  "META_ADS_STATUS_ENABLED",
  "META_ADS_STATUS_SECRET",
  "META_ADS_CONSOLE_ENABLED",
  "META_ADS_CONSOLE_PASSWORD",
]);
const metaAdsSecretKeys = ["META_ADS_STATUS_SECRET", "META_ADS_CONSOLE_PASSWORD"];

function validateMetaAdsSecrets(secrets) {
  exactKeys(secrets, metaAdsSecretKeys);
  if (
    typeof secrets.META_ADS_STATUS_SECRET !== "string" ||
    secrets.META_ADS_STATUS_SECRET.length < 32 ||
    secrets.META_ADS_STATUS_SECRET.length > 256 ||
    !/^[A-Za-z0-9._~+/-]+={0,2}$/u.test(secrets.META_ADS_STATUS_SECRET) ||
    typeof secrets.META_ADS_CONSOLE_PASSWORD !== "string" ||
    !/^[A-Za-z0-9._~+/-]{8}$/u.test(secrets.META_ADS_CONSOLE_PASSWORD)
  )
    fail("Meta Ads release secrets are invalid.");
}

function fail(message) {
  throw new Error(message);
}

export function environmentSha256(contents) {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function exactKeys(value, names) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  )
    fail("Environment change has an invalid shape.");
}

export function validateEnvironmentChange(change) {
  exactKeys(change, ["backupId", "beforeSha256", "afterSha256"]);
  if (
    typeof change.backupId !== "string" ||
    !uuid.test(change.backupId) ||
    typeof change.beforeSha256 !== "string" ||
    !digest.test(change.beforeSha256) ||
    typeof change.afterSha256 !== "string" ||
    !digest.test(change.afterSha256) ||
    change.beforeSha256 === change.afterSha256
  )
    fail("Environment change descriptor is invalid.");
  return change;
}

// Accept single-line dotenv assignments only. Ambiguous/multiline input cannot
// safely be patched while preserving all unrelated bytes and detecting duplicates.
function assignments(contents) {
  if (
    typeof contents !== "string" ||
    !contents.isWellFormed() ||
    Buffer.byteLength(contents, "utf8") > maximumEnvironmentBytes ||
    /[\p{Cc}\u2028\u2029]/u.test(contents.replace(/\r?\n|\t/gu, ""))
  )
    fail("Production environment contents are invalid or too large.");
  const found = new Map();
  let offset = 0;
  for (const line of contents.split(/\n/u)) {
    const text = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!/^[ \t]*(?:#.*)?$/u.test(text)) {
      const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/u.exec(
        text,
      );
      if (!match || found.has(match[1]))
        fail("Environment assignments are ambiguous or duplicated.");
      const value = match[2];
      if (
        (value.startsWith("'") && !/^'(?:[^'\\]|\\.)*'[ \t]*(?:#.*)?$/u.test(value)) ||
        (value.startsWith('"') && !/^"(?:[^"\\]|\\.)*"[ \t]*(?:#.*)?$/u.test(value))
      )
        fail("Multiline environment assignments are unsupported.");
      found.set(match[1], { offset, length: text.length, text, value });
    }
    offset += line.length + 1;
  }
  return found;
}

function literal(entry) {
  const raw = entry.value;
  const match = /^(?:"([^"\\$]*)"|'([^'\\$]*)'|([^'"\\$]*?))[ \t]*(?:[ \t]#.*)?$/u.exec(raw);
  if (!match) fail("Managed environment values must be unambiguous literals.");
  return match[1] ?? match[2] ?? match[3].trim();
}

function imageSha(contents) {
  const entry = assignments(contents).get("IMAGE_TAG");
  const value = entry?.value;
  if (!sha.test(value ?? "") || entry.text !== `IMAGE_TAG=${value}`) {
    fail("Environment backup requires an exact IMAGE_TAG assignment.");
  }
  return value;
}

function validateSecrets(secrets) {
  exactKeys(secrets, ["SUPABASE_SECRET_KEY", "SALESFORCE_INGEST_SECRET"]);
  const supabase = secrets.SUPABASE_SECRET_KEY;
  const bearer = secrets.SALESFORCE_INGEST_SECRET;
  if (
    typeof supabase !== "string" ||
    !/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(supabase) ||
    supabase.length > maximumSecretBytes ||
    typeof bearer !== "string" ||
    bearer.length < 32 ||
    bearer.length > maximumSecretBytes ||
    !/^[A-Za-z0-9._~+/-]+={0,2}$/u.test(bearer) ||
    bearer === supabase
  )
    fail("Salesforce release secrets are invalid.");
}

export function transformSalesforceReleaseEnvironment(contents, expectedSha, targetSha, secrets) {
  if (!sha.test(expectedSha ?? "") || !sha.test(targetSha ?? "") || expectedSha === targetSha) {
    fail("Salesforce configuration requires distinct exact release SHAs.");
  }
  const entries = assignments(contents);
  if (imageSha(contents) !== expectedSha)
    fail("Production environment does not match the expected SHA.");
  validateSecrets(secrets);
  // Validate the before literals now so recovery never needs the new credentials.
  salesforceEnvironmentValues(contents);
  const replacements = {
    IMAGE_TAG: targetSha,
    ...secrets,
    SALESFORCE_INGEST_ENABLED: "true",
    SALESFORCE_REFRESH_ENABLED: "false",
  };
  let after = contents;
  const edits = Object.entries(replacements)
    .filter(([key]) => entries.has(key))
    .map(([key, value]) => ({ ...entries.get(key), replacement: `${key}=${value}` }))
    .sort((a, b) => b.offset - a.offset);
  for (const edit of edits) {
    after = after.slice(0, edit.offset) + edit.replacement + after.slice(edit.offset + edit.length);
  }
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  for (const [key, value] of Object.entries(replacements)) {
    if (entries.has(key)) continue;
    if (after && !after.endsWith("\n")) after += newline;
    after += `${key}=${value}${newline}`;
  }
  assignments(after);
  return after;
}

export function salesforceEnvironmentValues(contents) {
  const entries = assignments(contents);
  return Object.fromEntries(
    keys.map((key) => {
      const entry = entries.get(key);
      // compose.yaml uses :- only for the two secrets; flags use :? (required).
      if (!entry && key.endsWith("_ENABLED")) fail("Compose requires explicit Salesforce flags.");
      const value = entry ? literal(entry) : "";
      if (key.endsWith("_ENABLED") && !value) fail("Compose requires explicit Salesforce flags.");
      return [key, value];
    }),
  );
}

export function qlikEnvironmentValues(contents) {
  const entries = assignments(contents);
  return Object.fromEntries(
    qlikKeys.map((key) => {
      const value = entries.has(key) ? literal(entries.get(key)) : "";
      return [key, value || (key.endsWith("_ENABLED") ? "false" : "")];
    }),
  );
}

export function transformQlikReleaseEnvironment(contents, expectedSha, targetSha, secret) {
  if (
    typeof expectedSha !== "string" ||
    typeof targetSha !== "string" ||
    !sha.test(expectedSha) ||
    !sha.test(targetSha) ||
    expectedSha === targetSha ||
    imageSha(contents) !== expectedSha
  )
    fail("Qlik configuration requires distinct exact release SHAs.");
  const entries = assignments(contents);
  const supabase = entries.get("SUPABASE_SECRET_KEY");
  if (!supabase || !/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(literal(supabase)))
    fail("Qlik requires the existing privileged server configuration.");
  if (
    typeof secret !== "string" ||
    !/^[A-Za-z0-9_-]{43,128}$/u.test(secret) ||
    ["SUPABASE_SECRET_KEY", "SALESFORCE_INGEST_SECRET", "QLIK_RELAY_HMAC_SECRET"].some(
      (key) => entries.has(key) && literal(entries.get(key)) === secret,
    )
  )
    fail("A separate Qlik ranking credential is required.");
  qlikEnvironmentValues(contents);
  const replacements = {
    IMAGE_TAG: targetSha,
    QLIK_RANKING_V2_ENABLED: "true",
    QLIK_RANKING_V2_HMAC_SECRET: secret,
  };
  let after = contents;
  for (const edit of Object.entries(replacements)
    .filter(([key]) => entries.has(key))
    .map(([key, value]) => ({ ...entries.get(key), replacement: `${key}=${value}` }))
    .sort((a, b) => b.offset - a.offset)) {
    after = after.slice(0, edit.offset) + edit.replacement + after.slice(edit.offset + edit.length);
  }
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  for (const [key, value] of Object.entries(replacements)) {
    if (entries.has(key)) continue;
    if (after && !after.endsWith("\n")) after += newline;
    after += `${key}=${value}${newline}`;
  }
  assignments(after);
  return after;
}

export function metaAdsEnvironmentValues(contents) {
  const entries = assignments(contents);
  return Object.fromEntries(
    metaAdsKeys.map((key) => {
      const value = entries.has(key) ? literal(entries.get(key)) : "";
      return [key, value || (key.endsWith("_ENABLED") ? "false" : "")];
    }),
  );
}

export function transformMetaAdsReleaseEnvironment(contents, expectedSha, targetSha, secrets) {
  if (
    typeof expectedSha !== "string" ||
    typeof targetSha !== "string" ||
    !sha.test(expectedSha) ||
    !sha.test(targetSha) ||
    expectedSha === targetSha ||
    imageSha(contents) !== expectedSha
  )
    fail("Meta Ads configuration requires distinct exact release SHAs.");
  validateMetaAdsSecrets(secrets);
  const entries = assignments(contents);
  for (const key of [
    "SUPABASE_SECRET_KEY",
    "SALESFORCE_INGEST_SECRET",
    "SALESFORCE_STATUS_SECRET",
    "SALESFORCE_REFRESH_SECRET",
    "SALESFORCE_CONSOLE_PASSWORD",
    "QLIK_RELAY_HMAC_SECRET",
    "QLIK_RANKING_V2_HMAC_SECRET",
  ]) {
    if (entries.has(key) && Object.values(secrets).includes(literal(entries.get(key))))
      fail("Meta Ads requires credentials separate from existing integrations.");
  }
  // Validate rollback literals before preparing any new configuration.
  metaAdsEnvironmentValues(contents);
  const replacements = {
    IMAGE_TAG: targetSha,
    META_ADS_STATUS_ENABLED: "true",
    META_ADS_STATUS_SECRET: secrets.META_ADS_STATUS_SECRET,
    META_ADS_CONSOLE_ENABLED: "true",
    META_ADS_CONSOLE_PASSWORD: secrets.META_ADS_CONSOLE_PASSWORD,
  };
  let after = contents;
  for (const edit of Object.entries(replacements)
    .filter(([key]) => entries.has(key))
    .map(([key, value]) => ({ ...entries.get(key), replacement: `${key}=${value}` }))
    .sort((a, b) => b.offset - a.offset)) {
    after = after.slice(0, edit.offset) + edit.replacement + after.slice(edit.offset + edit.length);
  }
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  for (const [key, value] of Object.entries(replacements)) {
    if (entries.has(key)) continue;
    if (after && !after.endsWith("\n")) after += newline;
    after += `${key}=${value}${newline}`;
  }
  assignments(after);
  return after;
}

function descriptor(backup) {
  return {
    backupId: backup.backupId,
    beforeSha256: backup.beforeSha256,
    afterSha256: backup.afterSha256,
  };
}

function validateBackup(backup, change) {
  validateEnvironmentChange(change);
  exactKeys(backup, [
    "schemaVersion",
    "backupId",
    "beforeSha256",
    "afterSha256",
    "before",
    "after",
    ...(backup?.schemaVersion === 2 ? ["kind"] : []),
  ]);
  if (
    ![1, 2].includes(backup.schemaVersion) ||
    (backup.schemaVersion === 2 &&
      !["qlik-ranking-v2", "meta-ads-session"].includes(backup.kind)) ||
    backup.backupId !== change.backupId ||
    backup.beforeSha256 !== change.beforeSha256 ||
    backup.afterSha256 !== change.afterSha256 ||
    typeof backup.before !== "string" ||
    typeof backup.after !== "string" ||
    environmentSha256(backup.before) !== change.beforeSha256 ||
    environmentSha256(backup.after) !== change.afterSha256
  )
    fail("Environment backup does not match its descriptor or digests.");
  if (backup.kind === "meta-ads-session") {
    const values = metaAdsEnvironmentValues(backup.after);
    if (
      transformMetaAdsReleaseEnvironment(
        backup.before,
        imageSha(backup.before),
        imageSha(backup.after),
        Object.fromEntries(metaAdsSecretKeys.map((key) => [key, values[key]])),
      ) !== backup.after
    )
      fail("Meta Ads backup contains an unrelated transformation.");
    return backup;
  }
  if (backup.schemaVersion === 2) {
    const secret = qlikEnvironmentValues(backup.after).QLIK_RANKING_V2_HMAC_SECRET;
    if (
      transformQlikReleaseEnvironment(
        backup.before,
        imageSha(backup.before),
        imageSha(backup.after),
        secret,
      ) !== backup.after
    )
      fail("Qlik backup contains an unrelated transformation.");
    return backup;
  }
  const values = salesforceEnvironmentValues(backup.after);
  if (
    transformSalesforceReleaseEnvironment(
      backup.before,
      imageSha(backup.before),
      imageSha(backup.after),
      {
        SUPABASE_SECRET_KEY: values.SUPABASE_SECRET_KEY,
        SALESFORCE_INGEST_SECRET: values.SALESFORCE_INGEST_SECRET,
      },
    ) !== backup.after
  )
    fail("Environment backup contains an unrelated transformation.");
  return backup;
}

export function selectEnvironmentChange(contents, backup, change, options) {
  validateBackup(backup, change);
  if (options.restoreEnvironment !== undefined && options.restoreEnvironment !== true) {
    fail("Environment restore must be explicit.");
  }
  const restore = options.restoreEnvironment === true;
  if (contents !== backup.before && (!restore || contents !== backup.after)) {
    fail("Production environment changed; full compare-and-swap refused.");
  }
  const selected = restore ? backup.before : backup.after;
  if (
    imageSha(contents) !== options.expectedCurrentSha ||
    imageSha(selected) !== options.targetSha
  ) {
    fail("Environment change does not match the requested release SHAs.");
  }
  return selected;
}

export function assertEnvironmentChangeContents(contents, backup, change, restore) {
  if (typeof restore !== "boolean") fail("Environment verification direction is required.");
  validateBackup(backup, change);
  if (contents !== (restore ? backup.before : backup.after)) {
    fail("Production environment does not match the complete recorded configuration.");
  }
}

export function assertSalesforceContainerDigests(contents, digests) {
  exactKeys(digests, keys);
  const expected = salesforceEnvironmentValues(contents);
  if (keys.some((key) => digests[key] !== environmentSha256(expected[key]))) {
    fail("Effective container configuration differs from the recorded environment.");
  }
}

// Docker receives only this fixed program. Neither arguments nor stdout contain secrets.
export const salesforceContainerDigestScript = `const {createHash}=require('node:crypto');const keys=${JSON.stringify(keys)};process.stdout.write(JSON.stringify(Object.fromEntries(keys.map(key=>[key,process.env[key]===undefined?null:createHash('sha256').update(process.env[key],'utf8').digest('hex')]))));`;

export const qlikContainerDigestScript = `const {createHash}=require('node:crypto');const keys=${JSON.stringify(qlikKeys)};process.stdout.write(JSON.stringify(Object.fromEntries(keys.map(key=>[key,createHash('sha256').update(process.env[key]??(key.endsWith('_ENABLED')?'false':''),'utf8').digest('hex')]))));`;

export function assertQlikContainerDigests(contents, digests) {
  exactKeys(digests, qlikKeys);
  const expected = qlikEnvironmentValues(contents);
  if (qlikKeys.some((key) => digests[key] !== environmentSha256(expected[key])))
    fail("Effective Qlik configuration differs from its recorded environment.");
}

export const metaAdsContainerDigestScript = `const {createHash}=require('node:crypto');const keys=${JSON.stringify(metaAdsKeys)};process.stdout.write(JSON.stringify(Object.fromEntries(keys.map(key=>[key,createHash('sha256').update(process.env[key]??(key.endsWith('_ENABLED')?'false':''),'utf8').digest('hex')]))));`;

export function assertMetaAdsContainerDigests(contents, digests) {
  exactKeys(digests, metaAdsKeys);
  const expected = metaAdsEnvironmentValues(contents);
  if (metaAdsKeys.some((key) => digests[key] !== environmentSha256(expected[key])))
    fail("Effective Meta Ads configuration differs from its recorded environment.");
}

export async function readBoundedEnvironmentText(handle, maximum) {
  const bytes = Buffer.alloc(maximum + 1);
  try {
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length > maximum || !isUtf8(bytes.subarray(0, length))) {
      fail("Private release file is too large or is not valid UTF-8.");
    }
    return bytes.subarray(0, length).toString("utf8");
  } finally {
    bytes.fill(0);
  }
}

async function readPrivateText(file, maximum, owner = 0) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    validatePrivateFile(before, owner);
    if ((before.mode & 0o7000) !== 0 || before.size > maximum)
      fail("Private release file metadata is invalid.");
    const contents = await readBoundedEnvironmentText(handle, maximum);
    const after = await handle.stat();
    const current = await lstat(file);
    validatePrivateFile(after, owner);
    validatePrivateFile(current, owner);
    if (
      current.isSymbolicLink() ||
      before.dev !== current.dev ||
      before.ino !== current.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      Buffer.byteLength(contents, "utf8") !== after.size
    )
      fail("Private release file changed while reading.");
    return contents;
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory) {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readSalesforceReleaseSecrets() {
  await validatePrivateDirectory(path.dirname(secretDirectory));
  await validatePrivateDirectory(secretDirectory);
  const secrets = {};
  for (const [key, name] of [
    ["SUPABASE_SECRET_KEY", "salesforce-supabase-secret"],
    ["SALESFORCE_INGEST_SECRET", "salesforce-crm-ingest-bearer"],
  ]) {
    secrets[key] = (
      await readPrivateText(path.join(secretDirectory, name), maximumSecretBytes + 2)
    ).replace(/\r?\n$/u, "");
  }
  validateSecrets(secrets);
  return secrets;
}

export async function readQlikReleaseSecret() {
  await validatePrivateDirectory(path.dirname(secretDirectory));
  await validatePrivateDirectory(secretDirectory);
  const value = (
    await readPrivateText(path.join(secretDirectory, "qlik-ranking-hmac"), 130)
  ).replace(/\r?\n$/u, "");
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(value)) fail("Invalid private Qlik credential.");
  return value;
}

export async function readMetaAdsReleaseSecrets() {
  await validatePrivateDirectory(path.dirname(secretDirectory));
  await validatePrivateDirectory(secretDirectory);
  const secrets = {};
  for (const [key, name, maximum] of [
    ["META_ADS_STATUS_SECRET", "meta-ads-status-bearer", 258],
    ["META_ADS_CONSOLE_PASSWORD", "meta-ads-console-password", 10],
  ]) {
    secrets[key] = (await readPrivateText(path.join(secretDirectory, name), maximum)).replace(
      /\r?\n$/u,
      "",
    );
  }
  validateMetaAdsSecrets(secrets);
  return secrets;
}

// The optional path/owner are for isolated POSIX fixtures. Production uses only defaults.
export function salesforceEnvironmentBackupStore(directory = backupDirectory, owner = 0) {
  async function validateDirectory(create = false) {
    await validatePrivateDirectory(path.dirname(directory), owner);
    if (create) {
      try {
        await mkdir(directory, { mode: 0o700 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    await validatePrivateDirectory(directory, owner);
    const metadata = await lstat(directory);
    if (
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o7777) !== 0o700 ||
      (await realpath(directory)) !== directory
    )
      fail("Environment backup directory must have mode 0700.");
    if (create) await syncDirectory(path.dirname(directory));
  }

  async function read(change) {
    validateEnvironmentChange(change);
    await validateDirectory();
    const contents = await readPrivateText(
      path.join(directory, `${change.backupId}.json`),
      maximumBackupBytes,
      owner,
    );
    let backup;
    try {
      backup = JSON.parse(contents);
    } catch {
      fail("Environment backup JSON is invalid.");
    }
    // Reject duplicate JSON members as well as noncanonical/partial writes.
    if (`${JSON.stringify(backup)}\n` !== contents)
      fail("Environment backup encoding is not canonical.");
    return validateBackup(backup, change);
  }

  async function create(backupId, before, after, kind = "salesforce") {
    if (!["salesforce", "qlik-ranking-v2", "meta-ads-session"].includes(kind))
      fail("Unknown environment change.");
    const backup = {
      schemaVersion: kind === "salesforce" ? 1 : 2,
      ...(kind !== "salesforce" ? { kind } : {}),
      backupId,
      beforeSha256: environmentSha256(before),
      afterSha256: environmentSha256(after),
      before,
      after,
    };
    const change = descriptor(backup);
    validateBackup(backup, change);
    await validateDirectory(true);
    // Exclusive creation never replaces an existing receipt, even after a crash.
    const file = path.join(directory, `${backupId}.json`);
    const handle = await open(
      file,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      validatePrivateFile(await handle.stat(), owner);
      await handle.writeFile(`${JSON.stringify(backup)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory(directory);
    await read(change);
    return Object.freeze(change);
  }

  return { create, read };
}
