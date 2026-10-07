import assert from "node:assert/strict";
import { test } from "node:test";

import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  resolveCandidateOutputPath,
  resolveReferenceDate,
  writeCandidateAtomically,
} from "./export-candidate.mjs";

test("treats an empty reference date as automatic", () => {
  assert.match(resolveReferenceDate({ SALESFORCE_REFERENCE_DATE: "" }), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(resolveReferenceDate({ SALESFORCE_REFERENCE_DATE: " 2026-10-07 " }), "2026-10-07");
});

test("accepts native absolute candidate paths and rejects relative paths", () => {
  assert.equal(
    resolveCandidateOutputPath(
      { SALESFORCE_CANDIDATE_OUTPUT: "C:\\Users\\operator\\candidate.json" },
      "win32",
    ),
    "C:\\Users\\operator\\candidate.json",
  );
  assert.equal(
    resolveCandidateOutputPath({ SALESFORCE_CANDIDATE_OUTPUT: "/private/candidate.json" }, "linux"),
    "/private/candidate.json",
  );
  assert.throws(
    () => resolveCandidateOutputPath({ SALESFORCE_CANDIDATE_OUTPUT: "candidate.json" }, "linux"),
    /absolute output path required/,
  );
});

test("writes the candidate atomically as an owner-only file", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "salesforce-candidate-write-"));
  context.after(() =>
    import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true })),
  );
  const output = path.join(directory, "candidate.json");
  await writeCandidateAtomically(output, { payload: { schemaVersion: 2 } });
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), {
    payload: { schemaVersion: 2 },
  });
  assert.equal((await stat(output)).mode & 0o777, 0o600);
});
