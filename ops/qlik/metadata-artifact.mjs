import { randomUUID } from "node:crypto";
import { lstat, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

export async function writeMetadataArtifact(
  result,
  { directory = "/run/descomplica-qlik", now = () => new Date() } = {},
) {
  if (!path.isAbsolute(directory)) throw new Error("private_qlik_directory_required");
  if (process.platform !== "linux" || !process.getuid?.())
    throw new Error("private_qlik_environment_required");
  const uid = process.getuid();
  const parent = await lstat(directory);
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== uid ||
    (parent.mode & 0o777) !== 0o700
  )
    throw new Error("private_qlik_directory_required");
  const data = JSON.stringify({
    schemaVersion: 1,
    kind: "qlik_metadata_preflight",
    observedAt: now().toISOString(),
    rankingConnected: false,
    result,
  });
  if (Buffer.byteLength(data) > 131_072) throw new Error("metadata_artifact_limit");
  const target = path.join(directory, "ranking-metadata.json");
  try {
    const old = await lstat(target);
    if (
      !old.isFile() ||
      old.isSymbolicLink() ||
      old.uid !== uid ||
      old.nlink !== 1 ||
      (old.mode & 0o777) !== 0o600
    )
      throw new Error("private_qlik_artifact_required");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.ranking-metadata-${randomUUID()}.tmp`);
  const file = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  let published = false;
  try {
    await file.writeFile(data);
    await file.sync();
    await file.close();
    await rename(temporary, target);
    published = true;
    const dir = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await file.close().catch(() => {});
    if (!published) await unlink(temporary).catch(() => {});
  }
}
