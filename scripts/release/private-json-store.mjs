import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validatePrivateDirectory, validatePrivateFile } from "./production-release-lock.mjs";

export function privateJsonStore(file, validate, owner = 0) {
  async function read() {
    await validatePrivateDirectory(path.dirname(file), owner);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      validatePrivateFile(await handle.stat(), owner);
      const info = await handle.stat();
      if (info.size > 16384) throw new Error("Release record is too large.");
      return validate(JSON.parse(await handle.readFile("utf8")));
    } finally {
      await handle.close();
    }
  }

  async function compareAndWrite(expected, next) {
    validate(next);
    let current;
    try {
      current = await read();
    } catch (error) {
      if (expected !== null || error.code !== "ENOENT") throw error;
      current = null;
    }
    if (!isDeepStrictEqual(current, expected)) {
      throw new Error("Release record changed; compare-and-swap refused.");
    }
    if (isDeepStrictEqual(expected, next)) return;
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
      const directory = await open(path.dirname(file), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      if (!isDeepStrictEqual(await read(), next)) throw new Error("Release record write failed.");
    } finally {
      await rm(temporary, { force: true });
    }
  }

  return { read, compareAndWrite };
}
