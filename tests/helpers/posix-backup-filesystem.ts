import type { PathLike, Stats } from "node:fs";
import type * as filesystem from "node:fs/promises";
import { vi } from "vitest";

// Windows lacks POSIX permission bits and read-only/directory fsync handles.
// Keep real bytes, links and inode identities; model only these OS contracts.
export function posixBackupFilesystem(actual: typeof filesystem) {
  const modes = new Map<string, number>();
  const key = (file: PathLike) => String(file);
  const lstat = vi.fn(async (file: PathLike) => {
    const metadata = await actual.lstat(file);
    const mode = modes.get(key(file));
    if (mode !== undefined) metadata.mode = (metadata.mode & ~0o777) | mode;
    return metadata;
  });
  return {
    ...actual,
    lstat,
    mkdtemp: async (prefix: string) => {
      const directory = await actual.realpath(await actual.mkdtemp(prefix));
      modes.set(directory, 0o700);
      return directory;
    },
    mkdir: vi.fn(async (...args: Parameters<typeof actual.mkdir>) => {
      const result = await actual.mkdir(...args);
      const options = args[1];
      if (!modes.has(key(args[0])) && typeof options === "object" && options?.mode !== undefined) {
        modes.set(key(args[0]), Number(options.mode));
      }
      return result;
    }),
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      await actual.writeFile(...args);
      const options = args[2];
      if (typeof options === "object" && options?.mode !== undefined) {
        modes.set(key(args[0] as PathLike), Number(options.mode));
      }
    },
    chmod: async (file: PathLike, mode: number) => {
      await actual.chmod(file, mode);
      modes.set(key(file), mode);
    },
    open: vi.fn(async (...args: Parameters<typeof actual.open>) => {
      const metadata = await lstat(args[0]);
      if (!metadata.isDirectory()) {
        const handle = await actual.open(...args);
        handle.sync = async () => {};
        return handle;
      }
      return {
        stat: async (): Promise<Stats> => lstat(args[0]),
        sync: async () => {},
        close: vi.fn(async () => {}),
      } as unknown as filesystem.FileHandle;
    }),
  };
}
