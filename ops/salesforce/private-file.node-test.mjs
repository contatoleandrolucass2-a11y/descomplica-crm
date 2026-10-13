import assert from "node:assert/strict";
import filesystem, { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  allowOtherReaders,
  assertNativePrivatePath,
} from "./test-helpers/native-private-fixture.mjs";

import {
  assertPrivateRegularFile,
  assertWindowsPrivateAcl,
  hardenPrivateRegularFile,
  hardenWindowsPrivateDirectory,
} from "./private-file.mjs";

let directory;
let privateFile;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "salesforce-private-file-"));
  privateFile = path.join(directory, "secret");
  await writeFile(privateFile, "synthetic", { mode: 0o600 });
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

test("enforces the POSIX permission contract with simulated metadata on every host", async (context) => {
  let mode = 0o600;
  const inspect = context.mock.method(filesystem, "lstat", async (file) => {
    assert.equal(file, privateFile);
    return { mode, isFile: () => true, isSymbolicLink: () => false };
  });
  syncBuiltinESMExports();
  try {
    await assert.doesNotReject(assertPrivateRegularFile(privateFile, { platform: "linux" }));
    for (mode of [0o640, 0o604, 0o666]) {
      await assert.rejects(
        assertPrivateRegularFile(privateFile, { platform: "linux" }),
        /group or others/,
      );
    }
    assert.equal(inspect.mock.callCount(), 4);
  } finally {
    inspect.mock.restore();
    syncBuiltinESMExports();
  }
});

test("enforces native private permissions and rejects a real additional reader", async () => {
  const fixture = path.join(directory, "native-permissions");
  await writeFile(fixture, "synthetic", { mode: 0o600 });
  await hardenPrivateRegularFile(fixture);
  await assertNativePrivatePath(fixture, 0o600);
  await allowOtherReaders(fixture);
  await assert.rejects(
    assertPrivateRegularFile(fixture),
    process.platform === "win32" ? /owner-only Windows ACL/ : /group or others/,
  );
});

test("uses Windows ACL validation instead of POSIX mode bits", async () => {
  await chmod(privateFile, 0o666);
  let validated;
  await assertPrivateRegularFile(privateFile, {
    platform: "win32",
    validateWindowsAcl: async (filePath) => {
      validated = filePath;
    },
  });
  assert.equal(validated, privateFile);
  await chmod(privateFile, 0o600);
});

test("hardens a Windows file and validates the resulting ACL", async () => {
  const calls = [];
  await hardenPrivateRegularFile(privateFile, {
    platform: "win32",
    hardenWindowsAcl: async (filePath) => calls.push(["harden", filePath]),
    validateWindowsAcl: async (filePath) => calls.push(["validate", filePath]),
  });
  assert.deepEqual(calls, [
    ["harden", privateFile],
    ["validate", privateFile],
  ]);
});

test("passes a Windows path through an environment variable, never command text", async () => {
  const target = "C:\\Users\\operator\\private source bearer";
  let invocation;
  await assertWindowsPrivateAcl(target, {
    environment: { SystemRoot: "C:\\Windows" },
    execFileFn: async (command, arguments_, options) => {
      invocation = { command, arguments_, options };
    },
  });
  assert.equal(
    invocation.command,
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  );
  assert.equal(invocation.arguments_.includes(target), false);
  assert.equal(invocation.options.shell, undefined);
  assert.equal(invocation.options.env.DESCOMPLICA_SALESFORCE_PRIVATE_FILE, target);
});

test("hardens a Windows directory without interpolating its path into PowerShell", async () => {
  const target = "C:\\Users\\operator\\Salesforce Chrome";
  let invocation;
  await hardenWindowsPrivateDirectory(target, {
    environment: { SystemRoot: "C:\\Windows" },
    execFileFn: async (command, arguments_, options) => {
      invocation = { command, arguments_, options };
    },
  });
  assert.equal(invocation.arguments_.includes(target), false);
  assert.match(invocation.arguments_.at(-1), /DirectorySecurity/);
  assert.equal(invocation.options.env.DESCOMPLICA_SALESFORCE_PRIVATE_FILE, target);
});
