import assert from "node:assert/strict";
import { chmod, lstat, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  isRankingFailureCode,
  rankingCycleArtifact,
  writeRankingArtifact,
} from "./ranking-artifact.mjs";

const now = new Date("2026-10-14T19:00:00.000Z");
const success = {
  state: "succeeded",
  batchId: "11111111-1111-4111-8111-111111111111",
  requestId: "22222222-2222-4222-8222-222222222222",
  contentSha256: "c".repeat(64),
  completedAt: "2026-10-14T18:59:59.000Z",
};

test("diagnostic authority serializes without Node/module closures and preserves projection", () => {
  const standalone = runInNewContext(`(${isRankingFailureCode.toString()})`);
  for (const code of [
    "mapping_invalid",
    "master_pin_mismatch",
    "master_catalog_item",
    "master_catalog_text",
    "master_catalog_binding",
    "master_alias_identity",
    "selection_failed",
    "definition_changed",
    "collection_unavailable",
    "cleanup_failed",
  ]) {
    assert.equal(standalone(code), true);
    assert.equal(isRankingFailureCode(code), true);
    for (const state of ["unavailable", "reauth_required"]) {
      assert.deepEqual(
        rankingCycleArtifact({ state, reason: code, secret: "synthetic-private" }, now).result,
        { state, code },
      );
    }
  }
  for (const code of [
    "synthetic-private",
    "mapping_invalid:synthetic-private",
    "",
    undefined,
    null,
    ["mapping_invalid"],
    {},
    123,
  ]) {
    assert.equal(standalone(code), false);
    assert.equal(isRankingFailureCode(code), false);
  }
});
for (const code of [
  "master_catalog_shape",
  "master_catalog_coverage_limit",
  "page_size_invalid",
  "selection_list_coverage_limit",
  "calendar_list_coverage_limit",
  "imobs_native_coverage_limit",
  "imobs_identity_coverage_limit",
  "developments_native_coverage_limit",
  "developments_identity_coverage_limit",
  "master_catalog_item",
  "master_catalog_text",
  "master_catalog_binding",
  "master_alias_identity",
]) {
  test(`artifact accepts only exact diagnostic enum ${code} and strips raw payload`, () => {
    const standalone = runInNewContext(`(${isRankingFailureCode.toString()})`);
    for (const state of ["unavailable", "reauth_required"]) {
      for (const field of ["reason", "code"]) {
        const artifact = rankingCycleArtifact(
          {
            state,
            [field]: code,
            payload: { qData: { title: "synthetic-private\ntext" }, rows: ["private"] },
            error: "synthetic-private",
          },
          now,
        );
        assert.deepEqual(artifact.result, { state, code });
        assert.equal(artifact.rankingConnected, false);
        assert.doesNotMatch(JSON.stringify(artifact), /synthetic-private|qData|payload|rows/);
      }
      for (const invalid of [
        `${code}:synthetic-private`,
        `${code}\n`,
        `${code} `,
        code.toUpperCase(),
        [code],
        { code },
      ]) {
        assert.equal(standalone(invalid), false);
        assert.equal(isRankingFailureCode(invalid), false);
        for (const field of ["reason", "code"])
          assert.deepEqual(rankingCycleArtifact({ state, [field]: invalid }, now).result, {
            state,
          });
      }
    }
  });
}
for (const state of ["running", "reauth_required", "unavailable"]) {
  test(`${state} contains no details and does not claim connection`, () => {
    const artifact = rankingCycleArtifact(
      { state, source: "private", secret: "private", reason: "private" },
      now,
    );
    assert.deepEqual(artifact.result, { state });
    assert.equal(artifact.rankingConnected, false);
  });
}
test("success exposes only its verified publication receipt", () => {
  const artifact = rankingCycleArtifact({ ...success, payload: "private" }, now);
  assert.deepEqual(artifact.result, success);
  assert.equal(artifact.rankingConnected, true);
  assert.equal(artifact.kind, "qlik_ranking_cycle");
});
for (const patch of [
  { batchId: "invalid" },
  { requestId: "invalid" },
  { contentSha256: ["c".repeat(64)] },
  { completedAt: "invalid" },
  { completedAt: "2026-10-14T20:00:00.000Z" },
]) {
  test(`invalid success receipt ${JSON.stringify(patch)} fails closed`, () => {
    assert.throws(() => rankingCycleArtifact({ ...success, ...patch }, now));
  });
}
test("unknown states cannot create an operational receipt", () => {
  assert.throws(() => rankingCycleArtifact({ state: "staged" }, now));
});

for (const state of ["unavailable", "reauth_required"]) {
  for (const field of ["reason", "code"]) {
    test(`${state} projects only an allowlisted ${field}`, () => {
      const artifact = rankingCycleArtifact(
        {
          state,
          [field]: "definition_changed",
          secret: "private",
          payload: { rows: "private" },
        },
        now,
      );
      assert.deepEqual(artifact.result, { state, code: "definition_changed" });
      assert.equal(artifact.rankingConnected, false);
    });
  }
}
for (const code of ["private", "definition_changed:private", ["definition_changed"], {}, 123]) {
  test(`artifact strips non-allowlisted code ${JSON.stringify(code)}`, () => {
    assert.deepEqual(rankingCycleArtifact({ state: "unavailable", code }, now).result, {
      state: "unavailable",
    });
  });
}
test("diagnostics never augment running or replace a successful receipt", () => {
  assert.deepEqual(
    rankingCycleArtifact({ state: "running", code: "mapping_invalid" }, now).result,
    { state: "running" },
  );
  assert.deepEqual(
    rankingCycleArtifact({ ...success, code: "mapping_invalid" }, now).result,
    success,
  );
  assert.throws(() => rankingCycleArtifact({ state: "succeeded", code: "mapping_invalid" }, now));
});
test(
  "private runtime artifact is atomic, restricted and refuses symlinks",
  { skip: process.platform !== "linux" || !process.getuid?.() },
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "qlik-ranking-"));
    t.after(() => rm(directory, { force: true, recursive: true }));
    await chmod(directory, 0o700);
    const options = { directory, now: () => now };
    await writeRankingArtifact({ state: "running" }, options);
    const target = path.join(directory, "ranking-status.json");
    assert.equal((await lstat(target)).mode & 0o777, 0o600);
    await writeRankingArtifact(success, options);
    assert.deepEqual(
      JSON.parse(await readFile(target, "utf8")),
      rankingCycleArtifact(success, now),
    );
    await rm(target);
    await symlink(path.join(directory, "outside"), target);
    await assert.rejects(
      writeRankingArtifact(success, options),
      /private_ranking_artifact_required/,
    );
  },
);
