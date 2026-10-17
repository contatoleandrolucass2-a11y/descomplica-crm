import assert from "node:assert/strict";
import { constants } from "node:fs";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

// No filesystem/process call can escape this fixture. Real POSIX checks live below.
export function memoryFilesystem(t) {
  const entries = new Map();
  const events = [];
  const hooks = {};
  let inode = 1;
  const add = (target, kind, data = "", overrides = {}) => {
    entries.set(target, {
      data: Buffer.from(data),
      metadata: {
        uid: 0,
        gid: 0,
        mode: kind === "directory" ? 0o700 : 0o600,
        nlink: 1,
        ino: inode++,
        dev: 1,
        mtimeMs: 1,
        ctimeMs: 1,
        isFile: () => kind === "file",
        isDirectory: () => kind === "directory",
        isSymbolicLink: () => kind === "symlink",
        ...overrides,
      },
    });
  };
  const entryFor = (target) => {
    const entry = entries.get(target);
    if (!entry) throw Object.assign(new Error("Missing synthetic file"), { code: "ENOENT" });
    return entry;
  };
  const stat = (entry) => ({ ...entry.metadata, size: entry.data.length });
  const patches = [
    t.mock.method(filesystem, "lstat", async (target) => stat(entryFor(target))),
    t.mock.method(filesystem, "realpath", async (target) => entryFor(target).alias ?? target),
    t.mock.method(filesystem, "mkdir", async (target, options) => {
      assert.equal(options.mode, 0o700);
      if (entries.has(target)) throw Object.assign(new Error("Exists"), { code: "EEXIST" });
      add(target, "directory");
    }),
    t.mock.method(filesystem, "open", async (target, flags, mode) => {
      events.push(["open", target]);
      if (flags === "wx" || (typeof flags === "number" && flags & constants.O_CREAT)) {
        assert.ok(flags === "wx" || flags & constants.O_EXCL);
        assert.equal(mode, 0o600);
        if (entries.has(target)) throw Object.assign(new Error("Exists"), { code: "EEXIST" });
        add(target, "file");
      }
      const entry = entryFor(target);
      if (entry.metadata.isSymbolicLink()) throw new Error("Synthetic symlink rejected");
      return {
        fd: 3,
        stat: async () => stat(entry),
        readFile: async (encoding) =>
          encoding ? entry.data.toString(encoding) : Buffer.from(entry.data),
        read: async (buffer, offset, length, position) => {
          const bytesRead = entry.data.copy(buffer, offset, position, position + length);
          await hooks.read?.(target);
          return { bytesRead, buffer };
        },
        writeFile: async (data) => {
          events.push(["write", target]);
          entry.data = Buffer.from(data);
        },
        sync: async () => {
          events.push(["sync", target]);
          await hooks.sync?.(target);
        },
        close: async () => {},
        chown: async (uid, gid) => Object.assign(entry.metadata, { uid, gid }),
        chmod: async (mode) => {
          entry.metadata.mode = mode;
        },
      };
    }),
    t.mock.method(filesystem, "rename", async (source, target) => {
      events.push(["rename", target]);
      entries.set(target, entryFor(source));
      entries.delete(source);
    }),
    t.mock.method(filesystem, "rm", async (target) => {
      entries.delete(target);
    }),
  ];
  syncBuiltinESMExports();
  t.after(() => {
    for (const patch of patches) patch.mock.restore();
    syncBuiltinESMExports();
  });
  return { entries, events, hooks, add };
}
