import assert from "node:assert/strict";
import test from "node:test";
import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  publishInventory,
  readPublishedInventory,
  syncInventoryDirectory,
} from "./publish-inventory.mjs";

const now = Date.now();
function candidate(time = now) {
  const item = Object.fromEntries(
    [
      "description",
      "identifier",
      "plant",
      "classification",
      "unitType",
      "building",
      "constructionStatus",
      "completionDate",
      "postalCode",
      "city",
      "street",
      "streetNumber",
      "neighborhood",
      "district",
      "state",
      "launchPrice",
      "appraisal",
      "finalWithKit",
      "unitBonus",
      "tableSlack",
      "cashBackSlack",
      "minimumSignal",
      "finalPrice",
      "privateArea",
      "rooms",
      "parkingSpaces",
      "floor",
      "finalUnit",
      "progress",
    ].map((key) => [key, null]),
  );
  Object.assign(item, {
    id: "a0Q000000000001AAA",
    businessUnit: "Riva",
    project: "Sintético",
    product: "Sintético",
    status: "Disponível",
  });
  return {
    schemaVersion: 1,
    source: "Salesforce · ESTOQUE SPC",
    sourceKind: "live",
    reportId: "00OU6000007yRpKMAU",
    generatedAt: new Date(time).toISOString(),
    sourceRows: 1,
    duplicateRows: 0,
    projectCount: 1,
    count: 1,
    items: [item],
  };
}
async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "inventory-publication-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await chmod(directory, 0o2710);
  return { directory, owner: process.getuid(), group: process.getgid(), now: () => now + 1000 };
}
const native = { skip: process.platform === "win32" };

test(
  "publishes a readable atomic stock file and retains the previous valid collection",
  native,
  async (t) => {
    const options = await fixture(t);
    await publishInventory(candidate(now - 1000), options);
    await publishInventory(candidate(), options);
    const current = await readPublishedInventory(options.directory, options.owner, options.group);
    assert.equal(current.payload.collectionMode, "automatic");
    assert.equal(current.payload.generatedAt, candidate().generatedAt);
    const previous = JSON.parse(await readFile(path.join(options.directory, "previous.json")));
    assert.equal(previous.generatedAt, candidate(now - 1000).generatedAt);
    assert.equal((await publishInventory(candidate(), options)).published, false);
  },
);

for (const failure of [
  "older",
  "same-time-different-content",
  "future",
  "stale",
  "invalid",
  "cancelled",
]) {
  test(`preserves the current inventory when candidate is ${failure}`, native, async (t) => {
    const options = await fixture(t);
    await publishInventory(candidate(now - 1000), options);
    const filename = path.join(options.directory, "current.json");
    const before = await readFile(filename);
    const next = candidate();
    if (failure === "older") next.generatedAt = candidate(now - 2000).generatedAt;
    if (failure === "same-time-different-content") {
      next.generatedAt = candidate(now - 1000).generatedAt;
      next.items[0].status = "Mirror";
    }
    if (failure === "future") next.generatedAt = candidate(now + 2000).generatedAt;
    if (failure === "stale") next.generatedAt = candidate(now - 11 * 60_000).generatedAt;
    if (failure === "invalid") next.count = 2;
    if (failure === "cancelled") options.signal = AbortSignal.abort();
    await assert.rejects(publishInventory(next, options));
    assert.deepEqual(await readFile(filename), before);
  });
}

test("rejects a symlink instead of reading or overwriting its target", native, async (t) => {
  const options = await fixture(t);
  const filename = path.join(options.directory, "current.json");
  await symlink(path.join(options.directory, "missing.json"), filename);
  await assert.rejects(publishInventory(candidate(), options));
});

test("rejects public or wrongly owned directories", native, async (t) => {
  const options = await fixture(t);
  await assert.rejects(publishInventory(candidate(), { ...options, owner: options.owner + 1 }));
  await chmod(options.directory, 0o2777);
  await assert.rejects(publishInventory(candidate(), options));
});

test("automatic publication rejects an alternate lock/output before opening the browser", async () => {
  const { exportInventory } = await import("./export-inventory.mjs");
  await assert.rejects(
    exportInventory(
      {
        SALESFORCE_CANDIDATE_OUTPUT: "/alternate/candidate.json",
        SALESFORCE_INVENTORY_OUTPUT: "/alternate/inventory.json",
      },
      { publish: true },
    ),
    (error) => error.code === "SALESFORCE_EXPORT_CONFIG",
  );
});

for (const failure of ["directory-sync", "confirmation-read"]) {
  test(`restores the previous base after post-rename ${failure} failure`, native, async (t) => {
    const options = await fixture(t);
    await publishInventory(candidate(now - 1000), options);
    const filename = path.join(options.directory, "current.json");
    const before = await readFile(filename);
    let syncs = 0;
    const injected =
      failure === "confirmation-read"
        ? {
            confirm: async () => {
              throw new Error("read failure");
            },
          }
        : {
            syncDirectory: async (directory) => {
              if (++syncs === 1) throw new Error("fsync failure");
              await syncInventoryDirectory(directory);
            },
          };
    await assert.rejects(publishInventory(candidate(), { ...options, ...injected }));
    assert.deepEqual(await readFile(filename), before);
  });
}

test("reports uncertain publication when recovery cannot be confirmed", native, async (t) => {
  const options = await fixture(t);
  await publishInventory(candidate(now - 1000), options);
  await assert.rejects(
    publishInventory(candidate(), {
      ...options,
      syncDirectory: async () => {
        throw new Error("persistent fsync failure");
      },
    }),
    (error) => error.code === "inventory_publication_uncertain",
  );
});

test("removes an unconfirmed first publication when no earlier file existed", native, async (t) => {
  const options = await fixture(t);
  await assert.rejects(
    publishInventory(candidate(), {
      ...options,
      confirm: async () => {
        throw new Error("read failure");
      },
    }),
  );
  await assert.rejects(readFile(path.join(options.directory, "current.json")), { code: "ENOENT" });
});

test("does not roll back over an unexpected concurrent file replacement", native, async (t) => {
  const options = await fixture(t);
  await publishInventory(candidate(now - 1000), options);
  const filename = path.join(options.directory, "current.json");
  const foreign = Buffer.from(JSON.stringify(candidate(now + 500)));
  await assert.rejects(
    publishInventory(candidate(), {
      ...options,
      confirm: async () => {
        await writeFile(filename + ".external", foreign, { mode: 0o640 });
        await rename(filename + ".external", filename);
        throw new Error("concurrent replacement");
      },
    }),
    (error) => error.code === "inventory_publication_uncertain",
  );
  assert.deepEqual(await readFile(filename), foreign);
});
