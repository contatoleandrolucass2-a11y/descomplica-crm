import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm, chmod, open, stat, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  leadMetaRuntimeStore,
  transformLeadMetaRuntime,
  runtimeDigest,
  credentialsDigest,
  assertLeadMetaContainerDigests,
  leadMetaContainerDigestScript,
} from "./lead-plus-meta-runtime.mjs";
const id = "00000000-0000-4000-8000-000000000002";
const base = {
  LEAD_DB_PROJECT_REF: "xwtasgjnkctyxokxjykk",
  LEAD_DB_URL: "postgresql://synthetic-only",
  META_APP_ID: "4588155391458285",
  META_PAGE_IDS: "123",
  META_FORM_ROUTES_JSON: "[]",
  META_APP_SECRET: "",
  META_VERIFY_TOKEN: "",
  META_PAGE_ACCESS_TOKEN: "",
};
const secrets = {
  META_APP_SECRET: "a".repeat(32),
  META_VERIFY_TOKEN: "b".repeat(64),
  META_PAGE_ACCESS_TOKEN: "synthetic-private-token-" + "c".repeat(32),
};
async function fixture(fn) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), "lead-meta-release-")));
  await chmod(dir, 0o700);
  const runtime = path.join(dir, "runtime.json"),
    proposal = path.join(dir, "proposal.json");
  const before = JSON.stringify(base) + "\n";
  await writeFile(runtime, before, { mode: 0o440 });
  await writeFile(proposal, JSON.stringify(secrets), { mode: 0o600 });
  const store = leadMetaRuntimeStore({ runtime, proposal, backups: dir, owner: process.getuid() });
  try {
    await fn({ dir, runtime, proposal, before, store });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("LEAD+ transformation adds only three credentials and preserves all other configuration", () => {
  const before = JSON.stringify(base),
    after = JSON.parse(transformLeadMetaRuntime(before, JSON.stringify(secrets)));
  assert.deepEqual(after, { ...base, ...secrets });
  for (const proposal of [
    { ...secrets, SUPABASE_URL: "evil" },
    { ...secrets, META_ADS_ACCESS_TOKEN: "evil" },
    { ...secrets, LEAD_DB_URL: "evil" },
    { ...secrets, META_VERIFY_TOKEN: "short" },
  ])
    assert.throws(() => transformLeadMetaRuntime(before, JSON.stringify(proposal)));
  assert.throws(() =>
    transformLeadMetaRuntime(
      JSON.stringify({ ...base, META_APP_SECRET: "existing" }),
      JSON.stringify(secrets),
    ),
  );
});
test("LEAD+ durable backup precedes atomic CAS; old open inode remains unchanged, recovery restores exact bytes", async () =>
  fixture(async ({ runtime, before, store }) => {
    const mounted = await open(runtime, "r");
    try {
      const inode = (await stat(runtime)).ino,
        change = await store.prepare(id);
      assert.equal(await readFile(runtime, "utf8"), before);
      const backup = await store.readBackup(change);
      assert.equal(backup.before, before);
      await store.apply(change);
      assert.notEqual((await stat(runtime)).ino, inode);
      assert.equal(await mounted.readFile("utf8"), before);
      assert.equal(await readFile(runtime, "utf8"), backup.after);
      const expected = await store.assertCurrent(change);
      assert.equal(expected.file, runtimeDigest(backup.after));
      await store.apply(change, true);
      assert.equal(await readFile(runtime, "utf8"), before);
      await store.apply(change, true);
      assert.equal(await readFile(runtime, "utf8"), before);
    } finally {
      await mounted.close();
    }
  }));
test("LEAD+ CAS refuses concurrent source changes and corrupted backups", async () =>
  fixture(async ({ dir, runtime, store }) => {
    const change = await store.prepare(id);
    await chmod(runtime, 0o640);
    await writeFile(runtime, JSON.stringify({ ...base, UNRELATED: "changed" }));
    await chmod(runtime, 0o440);
    await assert.rejects(store.apply(change));
    await writeFile(path.join(dir, "lead-plus-meta-" + id + ".json"), "{}");
    await assert.rejects(store.readBackup(change));
  }));
test("LEAD+ rejects unsafe proposal metadata and does not overwrite backups", async () =>
  fixture(async ({ proposal, store }) => {
    await chmod(proposal, 0o644);
    await assert.rejects(store.prepare(id));
    await chmod(proposal, 0o600);
    await store.prepare(id);
    await assert.rejects(store.prepare(id));
  }));
test("LEAD+ mounted file and both loaded process credential digests must match", () => {
  const after = transformLeadMetaRuntime(JSON.stringify(base), JSON.stringify(secrets));
  const expected = { file: runtimeDigest(after), credentials: credentialsDigest(after) };
  const actual = {
    file: expected.file,
    processes: [
      { kind: "app", digest: expected.credentials },
      { kind: "worker", digest: expected.credentials },
    ],
  };
  assertLeadMetaContainerDigests(actual, expected);
  assert.throws(() => assertLeadMetaContainerDigests({ ...actual, file: "other" }, expected));
  assert.throws(() =>
    assertLeadMetaContainerDigests({ ...actual, processes: [actual.processes[0]] }, expected),
  );
  assert.throws(() =>
    assertLeadMetaContainerDigests(
      { ...actual, processes: [actual.processes[0], { kind: "worker", digest: "old" }] },
      expected,
    ),
  );
});

test("LEAD+ digest observation identifies Next renamed process only as a direct child of the launcher", () => {
  const value = transformLeadMetaRuntime(JSON.stringify(base), JSON.stringify(secrets));
  const nodes = {
    10: { cmd: "node\0/app/deploy/runtime/start-services.mjs\0", parent: "1" },
    11: { cmd: "next-server (v16.4.1)\0", parent: "10" },
    12: { cmd: "node\0/app/deploy/runtime/lead-plus-worker.mjs\0", parent: "10" },
    99: { cmd: "next-server (v16.4.1)\0", parent: "2" },
  };
  const environ = Object.entries({ ...secrets, META_FORM_ROUTES_JSON: base.META_FORM_ROUTES_JSON })
    .map(([k, v]) => k + "=" + v)
    .join("\0");
  let output;
  const fs = {
    readdirSync: () => Object.keys(nodes),
    readFileSync: (file) => {
      if (file === "/run/secrets/lead-plus-runtime.json") return value;
      const [, id, kind] = file.match(/^\/proc\/(\d+)\/(cmdline|status|environ)$/) || [];
      if (!nodes[id]) throw Error("missing");
      return kind === "cmdline"
        ? nodes[id].cmd
        : kind === "status"
          ? "PPid:\t" + nodes[id].parent
          : environ;
    },
  };
  runInNewContext(leadMetaContainerDigestScript, {
    require: (name) => (name === "node:fs" ? fs : crypto),
    console: { log: (v) => (output = JSON.parse(v)) },
  });
  assertLeadMetaContainerDigests(output, {
    file: runtimeDigest(value),
    credentials: credentialsDigest(value),
  });
});

const allMasterRoles = ["admin", "superintendent", "manager"];
const formRoute = {
  page_id: "123",
  form_id: "456",
  product: "Formulário sintético",
  roles: allMasterRoles,
};
test("LEAD+ optional form map accepts only unique forms on existing Pages for the three exact master profiles", () => {
  const before = JSON.stringify(base);
  const map = JSON.stringify([
    formRoute,
    { ...formRoute, form_id: "789", product: "Contratação sintética" },
  ]);
  const result = JSON.parse(
    transformLeadMetaRuntime(before, JSON.stringify({ ...secrets, META_FORM_ROUTES_JSON: map })),
  );
  assert.deepEqual(result, { ...base, ...secrets, META_FORM_ROUTES_JSON: map });
  const invalid = [
    "bad-json",
    "[]",
    "{}",
    JSON.stringify([{ ...formRoute, page_id: "999" }]),
    JSON.stringify([{ ...formRoute, team: "Equipe" }]),
    JSON.stringify([{ ...formRoute, owner_id: "person" }]),
    JSON.stringify([{ ...formRoute, roles: ["admin", "manager", "broker"] }]),
    JSON.stringify([{ ...formRoute, roles: ["admin"] }]),
    JSON.stringify([{ ...formRoute, roles: ["admin", "admin", "manager"] }]),
    JSON.stringify([formRoute, formRoute]),
    JSON.stringify([{ ...formRoute, form_id: 456 }]),
    JSON.stringify([{ ...formRoute, product: " " }]),
    JSON.stringify([{ ...formRoute, product: "x".repeat(251) }]),
    JSON.stringify([{ ...formRoute, unexpected: true }]),
  ];
  for (const value of invalid)
    assert.throws(() =>
      transformLeadMetaRuntime(
        before,
        JSON.stringify({ ...secrets, META_FORM_ROUTES_JSON: value }),
      ),
    );
  assert.throws(() =>
    transformLeadMetaRuntime(
      before,
      JSON.stringify({ ...secrets, META_FORM_ROUTES_JSON: map, META_PAGE_IDS: "999" }),
    ),
  );
});
test("LEAD+ backup and rollback preserve the exact prior map while permitting only the optional map extension", async () =>
  fixture(async ({ dir, runtime, proposal, before, store }) => {
    const map = JSON.stringify(
      Array.from({ length: 11 }, (_, index) => ({
        ...formRoute,
        form_id: String(456 + index),
        product: "Sintético " + index,
      })),
    );
    await writeFile(proposal, JSON.stringify({ ...secrets, META_FORM_ROUTES_JSON: map }));
    const change = await store.prepare(id);
    const backup = await store.readBackup(change);
    await store.apply(change);
    assert.equal(JSON.parse(await readFile(runtime, "utf8")).META_FORM_ROUTES_JSON, map);
    await store.apply(change, true);
    assert.equal(await readFile(runtime, "utf8"), before);
    assert.equal(JSON.parse(backup.before).META_FORM_ROUTES_JSON, base.META_FORM_ROUTES_JSON);
    const corruptedAfter =
      JSON.stringify({ ...JSON.parse(backup.after), META_PAGE_IDS: "999" }, null, 2) + "\n";
    const tampered = { ...backup, after: corruptedAfter };
    await writeFile(path.join(dir, "lead-plus-meta-" + id + ".json"), JSON.stringify(tampered));
    await assert.rejects(
      store.readBackup({ ...change, afterSha256: runtimeDigest(corruptedAfter) }),
    );
  }));

test("LEAD+ effective runtime digest also binds the loaded routing map", () => {
  const first = JSON.stringify({
    ...base,
    ...secrets,
    META_FORM_ROUTES_JSON: JSON.stringify([formRoute]),
  });
  const second = JSON.stringify({
    ...base,
    ...secrets,
    META_FORM_ROUTES_JSON: JSON.stringify([{ ...formRoute, form_id: "789" }]),
  });
  assert.notEqual(credentialsDigest(first), credentialsDigest(second));
});
