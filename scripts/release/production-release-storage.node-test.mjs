import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, link, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  assertHeldLock,
  inheritedLockDescriptors,
  withFileLock,
  withFileLocks,
} from "./production-release-lock.mjs";
import { privateJsonStore } from "./private-json-store.mjs";

const owner = process.getuid();
async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "release-guard-")));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("private ledger persists, performs CAS, and never overwrites foreign state", async (t) => {
  const file = path.join(await fixture(t), "state.json");
  const store = privateJsonStore(file, (value) => value, owner);
  await store.compareAndWrite(null, { version: 1 });
  await assert.rejects(store.compareAndWrite(null, { version: 2 }), /compare-and-swap/u);
  await assert.rejects(store.compareAndWrite({ version: 0 }, { version: 2 }), /compare-and-swap/u);
  await store.compareAndWrite({ version: 1 }, { version: 2 });
  await store.compareAndWrite({ version: 2 }, { version: 2 });
  assert.deepEqual(await store.read(), { version: 2 });
});

test("ledger rejects symlinks, extra hard links, permissive modes and corrupt JSON", async (t) => {
  const directory = await fixture(t);
  const file = path.join(directory, "state.json");
  const alias = path.join(directory, "alias.json");
  const store = privateJsonStore(file, (value) => value, owner);
  await writeFile(file, "{}", { mode: 0o600 });
  await symlink(file, alias);
  await assert.rejects(privateJsonStore(alias, (value) => value, owner).read());
  await rm(alias);
  await link(file, alias);
  await assert.rejects(store.read(), /single link/u);
  await rm(alias);
  await chmod(file, 0o644);
  await assert.rejects(store.read(), /0600/u);
  await chmod(file, 0o600);
  await writeFile(file, "{invalid");
  await assert.rejects(store.compareAndWrite(null, {}));
  assert.equal(await readFile(file, "utf8"), "{invalid");
});

test("a forged lock token never authorizes a production mutation", async () => {
  await assert.rejects(assertHeldLock({}), /live release lock/u);
  await assert.rejects(
    assertHeldLock("--production-image-binding-lock-held"),
    /live release lock/u,
  );
});

const linuxOnly = {
  skip: process.platform !== "linux" ? "Real flock requires Linux; mandatory on CI Ubuntu." : false,
  timeout: 10_000,
};
const lockModule = pathToFileURL(
  path.join(import.meta.dirname, "production-release-lock.mjs"),
).href;

async function holder(files, inheritedChild = false) {
  const paths = Array.isArray(files) ? files : [files];
  const code = `
    import { spawn } from 'node:child_process';
    import { withFileLocks, inheritedLockDescriptors } from ${JSON.stringify(lockModule)};
    await withFileLocks(JSON.parse(process.argv[1]), async token => {
      let child;
      const descriptors = inheritedLockDescriptors(token);
      if (${inheritedChild}) {
        child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
          stdio: ['ignore','ignore','ignore',...descriptors]
        });
      }
      process.stdout.write(JSON.stringify({ inheritedPid: child?.pid ?? 0, descriptorCount: descriptors.length })+String.fromCharCode(10));
      await new Promise(resolve => process.stdin.once('data',resolve));
      child?.kill();
    }, process.getuid());
  `;
  const child = spawn(
    process.execPath,
    ["--input-type=module", "-e", code, JSON.stringify(paths)],
    {
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const closed = once(child, "close");
  const result = await Promise.race([
    once(child.stdout, "data").then(([data]) => JSON.parse(data.toString().trim())),
    closed.then(() => {
      throw new Error("Lock holder exited before acquiring flock.");
    }),
  ]);
  return { child, closed, ...result };
}

function terminateHolder(holder) {
  holder.child.kill("SIGKILL");
  if (holder.inheritedPid > 0) {
    try {
      process.kill(holder.inheritedPid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

async function threeLockPaths(t) {
  const directory = await fixture(t);
  return [
    ".production-deploy.lock",
    ".production-release.lock",
    ".production-image-binding.lock",
  ].map((name) => path.join(directory, name));
}

async function assertEventuallyUnlocked(files) {
  const deadline = Date.now() + 3_000;
  while (true) {
    try {
      await withFileLocks(files, (token) => assertHeldLock(token, files.at(-1)), owner);
      return;
    } catch (error) {
      if (!/holds the lock/u.test(error.message) || Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
}

test("two real processes contend; kernel lock releases on SIGKILL", linuxOnly, async (t) => {
  const file = path.join(await fixture(t), "release.lock");
  const first = await holder(file);
  t.after(() => first.child.kill("SIGKILL"));
  await assert.rejects(
    withFileLock(file, () => assert.fail("second writer entered"), owner),
    /holds the lock/u,
  );
  first.child.kill("SIGKILL");
  await first.closed;
  await withFileLock(file, async (token) => assertHeldLock(token, file), owner);
});

test(
  "lock remains held by inherited Docker-like child after coordinator death",
  linuxOnly,
  async (t) => {
    const file = path.join(await fixture(t), "release.lock");
    const first = await holder(file, true);
    t.after(() => terminateHolder(first));
    assert.equal(Number.isSafeInteger(first.inheritedPid) && first.inheritedPid > 0, true);
    assert.equal(first.descriptorCount, 1);
    first.child.kill("SIGKILL");
    await first.closed;
    await assert.rejects(
      withFileLock(file, () => assert.fail("orphan still mutating"), owner),
      /holds the lock/u,
    );
  },
);

test(
  "lock covers promotion, verification and recovery callbacks; path replacement is rejected",
  linuxOnly,
  async (t) => {
    const file = path.join(await fixture(t), "release.lock");
    await withFileLock(
      file,
      async (token) => {
        for (const phase of ["bind", "compose", "verify", "recover", "record"]) {
          await assert.rejects(
            withFileLock(file, () => assert.fail(phase), owner),
            /holds the lock/u,
          );
        }
        await rm(file);
        await writeFile(file, "", { mode: 0o600 });
        await assert.rejects(assertHeldLock(token, file), /inode changed/u);
      },
      owner,
    );
  },
);

test(
  "a multi-lock guard holds all three paths against independent competing writers",
  linuxOnly,
  async (t) => {
    const files = await threeLockPaths(t);
    const first = await holder(files);
    t.after(() => terminateHolder(first));
    assert.equal(first.descriptorCount, 3);
    for (const file of files) {
      await assert.rejects(
        withFileLock(
          file,
          () => assert.fail(`A competing writer entered ${path.basename(file)}.`),
          owner,
        ),
        /holds the lock/u,
      );
    }
    first.child.stdin.end("release\n");
    assert.deepEqual(await first.closed, [0, null]);
    await withFileLocks(
      files,
      async (token) => {
        await assertHeldLock(token, files.at(-1));
        const descriptors = inheritedLockDescriptors(token);
        assert.equal(descriptors.length, 3);
        assert.equal(new Set(descriptors).size, 3);
        assert.equal(
          descriptors.every((descriptor) => Number.isSafeInteger(descriptor) && descriptor >= 0),
          true,
        );
      },
      owner,
    );
  },
);

test(
  "contention on the second or third path releases every previously acquired lock",
  linuxOnly,
  async (t) => {
    for (const blockedIndex of [1, 2]) {
      const files = await threeLockPaths(t);
      const blocker = await holder(files[blockedIndex]);
      t.after(() => terminateHolder(blocker));
      await assert.rejects(
        withFileLocks(files, () => assert.fail("The callback ran without all three locks."), owner),
        /holds the lock/u,
      );
      for (const file of files.filter((_, index) => index !== blockedIndex)) {
        await withFileLock(file, (token) => assertHeldLock(token, file), owner);
      }
      await assert.rejects(
        withFileLock(
          files[blockedIndex],
          () => assert.fail("The competing holder lost its lock."),
          owner,
        ),
        /holds the lock/u,
      );
      blocker.child.stdin.end("release\n");
      assert.deepEqual(await blocker.closed, [0, null]);
      await withFileLocks(files, (token) => assertHeldLock(token, files.at(-1)), owner);
    }
  },
);

test(
  "invalid second or third lock permissions release every previously acquired lock",
  linuxOnly,
  async (t) => {
    for (const invalidIndex of [1, 2]) {
      const files = await threeLockPaths(t);
      await writeFile(files[invalidIndex], "", { mode: 0o644 });
      await assert.rejects(
        withFileLocks(
          files,
          () => assert.fail("The callback ran with an invalid companion lock."),
          owner,
        ),
        /0600/u,
      );
      for (const file of files.filter((_, index) => index !== invalidIndex)) {
        await withFileLock(file, (token) => assertHeldLock(token, file), owner);
      }
      await chmod(files[invalidIndex], 0o600);
      await withFileLocks(files, (token) => assertHeldLock(token, files.at(-1)), owner);
    }
  },
);

test(
  "the primary token rejects replacement of either companion lock path",
  linuxOnly,
  async (t) => {
    for (const replacedIndex of [0, 1]) {
      const files = await threeLockPaths(t);
      await withFileLocks(
        files,
        async (token) => {
          await assertHeldLock(token, files.at(-1));
          await rm(files[replacedIndex]);
          await writeFile(files[replacedIndex], "", { mode: 0o600 });
          await assert.rejects(assertHeldLock(token, files.at(-1)), /inode changed/u);
        },
        owner,
      );
    }
  },
);

test(
  "all three inherited locks survive coordinator SIGKILL until the Docker-like child exits",
  linuxOnly,
  async (t) => {
    const files = await threeLockPaths(t);
    const first = await holder(files, true);
    t.after(() => terminateHolder(first));
    assert.equal(first.descriptorCount, 3);
    assert.equal(Number.isSafeInteger(first.inheritedPid) && first.inheritedPid > 0, true);
    first.child.kill("SIGKILL");
    assert.deepEqual(await first.closed, [null, "SIGKILL"]);
    for (const file of files) {
      await assert.rejects(
        withFileLock(file, () => assert.fail(`Orphaned child lost ${path.basename(file)}.`), owner),
        /holds the lock/u,
      );
    }
    await assert.rejects(
      withFileLocks(
        files,
        () => assert.fail("A second release entered while the child was alive."),
        owner,
      ),
      /holds the lock/u,
    );
    process.kill(first.inheritedPid, "SIGKILL");
    await assertEventuallyUnlocked(files);
  },
);
