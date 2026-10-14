import assert from "node:assert/strict";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeMetadataArtifact } from "./metadata-artifact.mjs";

const supported = process.platform === "linux" && !!process.getuid?.();

test("artifact requires an absolute path and dedicated non-root Linux process", async () => {
  await assert.rejects(
    writeMetadataArtifact({}, { directory: "relative" }),
    /private_qlik_directory_required/,
  );
  if (!supported)
    await assert.rejects(writeMetadataArtifact({}), /private_qlik_environment_required/);
});

test(
  "private metadata artifact is replaced atomically and never claims connection",
  { skip: !supported },
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "qlik-metadata-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await chmod(directory, 0o700);
    const options = { directory, now: () => new Date("2026-10-14T13:00:00Z") };
    const target = path.join(directory, "ranking-metadata.json");
    await writeMetadataArtifact({ status: "reauth_required" }, options);
    const first = JSON.parse(await readFile(target, "utf8"));
    assert.equal(first.rankingConnected, false);
    assert.equal(first.kind, "qlik_metadata_preflight");
    assert.equal(first.observedAt, "2026-10-14T13:00:00.000Z");
    assert.equal((await lstat(target)).mode & 0o777, 0o600);
    await writeMetadataArtifact({ status: "pending", dataRead: false }, options);
    assert.equal(JSON.parse(await readFile(target, "utf8")).result.status, "pending");
    await assert.rejects(
      writeMetadataArtifact({ oversized: "x".repeat(131_072) }, options),
      /metadata_artifact_limit/,
    );
    assert.deepEqual(await readdir(directory), ["ranking-metadata.json"]);
    assert.equal(JSON.parse(await readFile(target, "utf8")).result.status, "pending");
  },
);

test(
  "unsafe directories, links and permissions preserve the existing artifact",
  { skip: !supported },
  async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qlik-metadata-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "private");
    await mkdir(directory, { mode: 0o700 });
    const target = path.join(directory, "ranking-metadata.json");
    const original = path.join(root, "original");
    await writeFile(original, "unchanged", { mode: 0o600 });
    await symlink(original, target);
    await assert.rejects(
      writeMetadataArtifact({}, { directory }),
      /private_qlik_artifact_required/,
    );
    assert.equal(await readFile(original, "utf8"), "unchanged");
    await rm(target);
    await link(original, target);
    await assert.rejects(
      writeMetadataArtifact({}, { directory }),
      /private_qlik_artifact_required/,
    );
    await rm(target);
    await writeFile(target, "unchanged", { mode: 0o644 });
    await assert.rejects(
      writeMetadataArtifact({}, { directory }),
      /private_qlik_artifact_required/,
    );
    await chmod(directory, 0o755);
    await assert.rejects(
      writeMetadataArtifact({}, { directory }),
      /private_qlik_directory_required/,
    );
    await chmod(directory, 0o700);
    const alias = path.join(root, "alias");
    await symlink(directory, alias);
    await assert.rejects(
      writeMetadataArtifact({}, { directory: alias }),
      /private_qlik_directory_required/,
    );
  },
);
