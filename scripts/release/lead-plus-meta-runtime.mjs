import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { validatePrivateDirectory } from "./production-release-lock.mjs";

export const leadMetaKeys = Object.freeze([
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "META_PAGE_ACCESS_TOKEN",
]);
const observedRuntimeKeys = Object.freeze([...leadMetaKeys, "META_FORM_ROUTES_JSON"]);
export const runtimeDigest = (value) => createHash("sha256").update(value).digest("hex");
const bad = () => {
  throw Error("LEAD+ runtime configuration or backup is invalid.");
};
function object(contents) {
  let value;
  try {
    value = JSON.parse(contents);
  } catch {
    bad();
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.values(value).some((v) => typeof v !== "string")
  )
    bad();
  return value;
}
export function validateLeadMetaRoutes(contents, pageIds) {
  if (typeof pageIds !== "string" || !/^\d{1,64}(,\d{1,64})*$/.test(pageIds)) bad();
  const pages = new Set(pageIds.split(","));
  let routes;
  try {
    routes = JSON.parse(contents);
  } catch {
    bad();
  }
  if (!Array.isArray(routes) || !routes.length || routes.length > 500) bad();
  const forms = new Set();
  for (const route of routes) {
    if (
      !route ||
      typeof route !== "object" ||
      Array.isArray(route) ||
      Object.keys(route).sort().join(",") !== "form_id,page_id,product,roles" ||
      typeof route.page_id !== "string" ||
      !pages.has(route.page_id) ||
      typeof route.form_id !== "string" ||
      !/^\d{1,64}$/.test(route.form_id) ||
      forms.has(route.form_id) ||
      typeof route.product !== "string" ||
      !route.product.trim() ||
      route.product.length > 250 ||
      /[\x00-\x1f\x7f]/.test(route.product) ||
      !Array.isArray(route.roles) ||
      route.roles.length !== 3 ||
      [...new Set(route.roles)].sort().join(",") !== "admin,manager,superintendent"
    )
      bad();
    forms.add(route.form_id);
  }
  return routes;
}
export function transformLeadMetaRuntime(before, proposed) {
  const current = object(before),
    changes = object(proposed);
  if (
    ![3, 4].includes(Object.keys(changes).length) ||
    leadMetaKeys.some((key) => !Object.hasOwn(changes, key)) ||
    Object.keys(changes).some(
      (key) => !leadMetaKeys.includes(key) && key !== "META_FORM_ROUTES_JSON",
    )
  )
    bad();
  if (current.LEAD_DB_PROJECT_REF !== "xwtasgjnkctyxokxjykk") bad();
  if (leadMetaKeys.some((key) => current[key])) bad(); // Activation only, never implicit rotation.
  if (
    !/^[a-f0-9]{32}$/i.test(changes.META_APP_SECRET) ||
    !/^[^\s\x00-\x1f\x7f]{32,4096}$/.test(changes.META_VERIFY_TOKEN) ||
    !/^[^\s\x00-\x1f\x7f]{20,16384}$/.test(changes.META_PAGE_ACCESS_TOKEN)
  )
    bad();
  if (Object.hasOwn(changes, "META_FORM_ROUTES_JSON"))
    validateLeadMetaRoutes(changes.META_FORM_ROUTES_JSON, current.META_PAGE_IDS);
  const after = JSON.stringify({ ...current, ...changes }, null, 2) + "\n";
  if (Buffer.byteLength(after) > 32768) bad();
  return after;
}
export function credentialsDigest(contents) {
  const value = object(contents);
  return runtimeDigest(
    JSON.stringify(Object.fromEntries(observedRuntimeKeys.map((key) => [key, value[key] || ""]))),
  );
}
export function validateRuntimeChange(change, id) {
  if (
    !change ||
    Object.keys(change).sort().join(",") !== "afterSha256,backupId,beforeSha256" ||
    change.backupId !== id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    !/^[0-9a-f]{64}$/.test(change.beforeSha256) ||
    !/^[0-9a-f]{64}$/.test(change.afterSha256) ||
    change.beforeSha256 === change.afterSha256
  )
    bad();
  return change;
}
export function leadMetaRuntimeStore({
  runtime = "/etc/descomplica-crm/secrets/lead-plus-runtime.json.prepared",
  proposal = "/etc/descomplica-crm/secrets/lead-plus-meta.json.pending",
  backups = "/etc/descomplica-crm/config-backups",
  owner = 0,
} = {}) {
  const group = owner === 0 ? 0 : process.getgid();
  async function read(file, mode, limit = 32768) {
    await validatePrivateDirectory(path.dirname(file), owner);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.uid !== owner ||
        stat.gid !== group ||
        stat.nlink !== 1 ||
        (stat.mode & 0o777) !== mode ||
        stat.size > limit
      )
        bad();
      return await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  }
  async function write(file, contents, mode, expected = null) {
    await validatePrivateDirectory(path.dirname(file), owner);
    if (expected !== null && (await read(file, mode, 131072)) !== expected) bad();
    const temporary = file + "." + randomUUID() + ".tmp";
    try {
      const handle = await open(temporary, "wx", mode);
      try {
        await handle.chmod(mode);
        await handle.chown(owner, group);
        await handle.writeFile(contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (expected !== null && (await read(file, mode, 131072)) !== expected) bad();
      if (expected === null) {
        // Exclusive backup creation: never overwrite another transaction.
        const { link } = await import("node:fs/promises");
        await link(temporary, file);
        await rm(temporary);
      } else await rename(temporary, file);
      const directory = await open(path.dirname(file), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const backupPath = (change) => path.join(backups, "lead-plus-meta-" + change.backupId + ".json");
  async function readBackup(change) {
    validateRuntimeChange(change, change.backupId);
    let backup;
    try {
      backup = JSON.parse(await read(backupPath(change), 0o600, 131072));
    } catch {
      bad();
    }
    if (
      !backup ||
      Object.keys(backup).sort().join(",") !== "after,before,kind,schemaVersion" ||
      backup.kind !== "lead-plus-meta" ||
      backup.schemaVersion !== 1 ||
      typeof backup.before !== "string" ||
      typeof backup.after !== "string" ||
      runtimeDigest(backup.before) !== change.beforeSha256 ||
      runtimeDigest(backup.after) !== change.afterSha256
    )
      bad();
    const after = object(backup.after),
      before = object(backup.before);
    const changes = Object.fromEntries(leadMetaKeys.map((k) => [k, after[k]]));
    if (after.META_FORM_ROUTES_JSON !== before.META_FORM_ROUTES_JSON)
      changes.META_FORM_ROUTES_JSON = after.META_FORM_ROUTES_JSON;
    if (transformLeadMetaRuntime(backup.before, JSON.stringify(changes)) !== backup.after) bad();
    return backup;
  }
  return {
    readCurrent: () => read(runtime, 0o440),
    async prepare(id) {
      const before = await read(runtime, 0o440);
      const after = transformLeadMetaRuntime(before, await read(proposal, 0o600));
      const change = validateRuntimeChange(
        { backupId: id, beforeSha256: runtimeDigest(before), afterSha256: runtimeDigest(after) },
        id,
      );
      await write(
        backupPath(change),
        JSON.stringify({ schemaVersion: 1, kind: "lead-plus-meta", before, after }) + "\n",
        0o600,
      );
      if ((await read(runtime, 0o440)) !== before) bad();
      return change;
    },
    readBackup,
    async apply(change, restore = false) {
      const backup = await readBackup(change),
        current = await read(runtime, 0o440);
      const target = restore ? backup.before : backup.after;
      if (current === target) return; // Safe interrupted recovery resumption.
      if (current !== (restore ? backup.after : backup.before)) bad();
      await write(runtime, target, 0o440, current);
      if ((await read(runtime, 0o440)) !== target) bad();
    },
    async assertCurrent(change, restore = false) {
      const backup = await readBackup(change),
        expected = restore ? backup.before : backup.after;
      if ((await read(runtime, 0o440)) !== expected) bad();
      return { file: runtimeDigest(expected), credentials: credentialsDigest(expected) };
    },
  };
}
// Prints only hashes of the bound file and loaded application/worker credentials plus routing.
export const leadMetaContainerDigestScript = `
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const keys=${JSON.stringify(observedRuntimeKeys)};
const file=hash(fs.readFileSync('/run/secrets/lead-plus-runtime.json'));
const entries=[];
for(const id of fs.readdirSync('/proc').filter(x=>/^\\d+$/.test(x))){
 try{const cmd=fs.readFileSync('/proc/'+id+'/cmdline','utf8').split('\\0');
 const parent=fs.readFileSync('/proc/'+id+'/status','utf8').match(/^PPid:\\s*(\\d+)$/m)?.[1];
 entries.push({id,cmd,parent});
 }catch{}
}
const launchers=entries.filter(p=>p.cmd[1]==='/app/deploy/runtime/start-services.mjs');
if(launchers.length!==1)throw Error('LEAD+ runtime launcher unavailable');
const processes=[];
for(const p of entries.filter(p=>p.parent===launchers[0].id)){
 const kind=p.cmd[1]==='/app/deploy/runtime/lead-plus-worker.mjs'?'worker':
 p.cmd[1]==='/app/server.js'||/^next-server(?: |$)/.test(p.cmd[0]||'')?'app':null;
 if(!kind)continue;
 const env=Object.fromEntries(fs.readFileSync('/proc/'+p.id+'/environ','utf8').split('\\0').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
 processes.push({kind,digest:hash(JSON.stringify(Object.fromEntries(keys.map(k=>[k,env[k]||'']))))});
}
console.log(JSON.stringify({file,processes}));`;

export function assertLeadMetaContainerDigests(actual, expected) {
  if (
    actual?.file !== expected.file ||
    !Array.isArray(actual.processes) ||
    actual.processes.length !== 2 ||
    !["app", "worker"].every(
      (kind) =>
        actual.processes.filter((p) => p.kind === kind && p.digest === expected.credentials)
          .length === 1,
    )
  )
    bad();
}
