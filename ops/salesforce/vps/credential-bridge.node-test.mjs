import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { assertPrivateRegularFile } from "../private-file.mjs";

test(
  "Linux credential bridge preserves strict private-file validation and replaces stale copies",
  { skip: process.platform !== "linux" ? "GNU install and POSIX modes require Linux" : false },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "crm-credential-bridge-"));
    const source = path.join(directory, "mounted");
    const target = path.join(directory, "private-copy");
    try {
      await chmod(directory, 0o700);
      await writeFile(source, "synthetic-credential\n", { mode: 0o440 });
      await chmod(source, 0o440);
      await writeFile(target, "stale", { mode: 0o600 });
      await assert.rejects(assertPrivateRegularFile(source), /group or others/u);
      await promisify(execFile)("/usr/bin/install", ["-m", "0600", "--", source, target]);
      await assertPrivateRegularFile(target);
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
      assert.equal((await stat(target)).mode & 0o777, 0o600);
      assert.equal((await stat(source)).mode & 0o777, 0o440);
      assert.deepEqual(await readFile(target), await readFile(source));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
