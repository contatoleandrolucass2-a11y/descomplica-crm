import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { assertWindowsPrivateAcl } from "../private-file.mjs";

export async function assertNativePrivatePath(file, mode) {
  if (process.platform === "win32") {
    await assertWindowsPrivateAcl(file);
  } else {
    assert.equal((await stat(file)).mode & 0o777, mode);
  }
}

// Use only synthetic temporary fixtures: deliberately add an unsafe read grant.
export async function allowOtherReaders(file) {
  if (process.platform !== "win32") {
    await chmod(file, 0o640);
    return;
  }
  // icacls changes only the DACL, without requiring SACL/audit privileges.
  await promisify(execFile)(
    path.join(process.env.SystemRoot, "System32/icacls.exe"),
    [file, "/grant", "*S-1-1-0:R"],
    { windowsHide: true, timeout: 10_000 },
  );
}
