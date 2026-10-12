import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, link, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { assertHeldLock, withFileLock } from "./production-release-lock.mjs";
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
};
const lockModule = pathToFileURL(
  path.join(import.meta.dirname, "production-release-lock.mjs"),
).href;

async function holder(file, inheritedChild = false) {
  const code = `
    import { spawn } from 'node:child_process';
    import { withFileLock, inheritedLockDescriptor } from ${JSON.stringify(lockModule)};
    await withFileLock(process.argv[1], async token => {
      let child;
      if (${inheritedChild}) {
        child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
          stdio: ['ignore','ignore','ignore',inheritedLockDescriptor(token)]
        });
      }
      process.stdout.write(String(child?.pid ?? 0)+'\\n');
      await new Promise(resolve => process.stdin.once('data',resolve));
      child?.kill();
    }, process.getuid());
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code, file], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  const result = await Promise.race([
    once(child.stdout, "data").then(([data]) => Number(data.toString().trim())),
    closed.then(() => {
      throw new Error("Lock holder exited before acquiring flock.");
    }),
  ]);
  return { child, closed, inheritedPid: result };
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
    t.after(() => {
      first.child.kill("SIGKILL");
      try {
        process.kill(first.inheritedPid, "SIGKILL");
      } catch {
        /* already exited */
      }
    });
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
