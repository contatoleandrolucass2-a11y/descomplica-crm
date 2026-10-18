import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  MAX_SALESFORCE_CANDIDATE_FILE_BYTES,
  MAX_SALESFORCE_INGESTION_BODY_BYTES,
} from "../../lib/crm/salesforce/transport.ts";
import { publishSalesforceCandidate, readSalesforceCandidateFile } from "./publish-candidate.mjs";

const limit = MAX_SALESFORCE_INGESTION_BODY_BYTES;
const environment = {
  SALESFORCE_N8N_PUBLISH_ENABLED: "true",
  SALESFORCE_N8N_WEBHOOK_URL: "https://synthetic.invalid/webhook",
};

function candidateOfBytes(bytes) {
  const payload = {
    schemaVersion: 2,
    requestId: "60000000-0000-4000-8000-000000000001",
    synthetic: "",
  };
  const remaining = bytes - Buffer.byteLength(JSON.stringify(payload));
  payload.synthetic = "\u00e9".repeat(Math.floor(remaining / 2)) + "x".repeat(remaining % 2);
  assert.equal(Buffer.byteLength(JSON.stringify(payload)), bytes);
  return { payload, diagnostics: { syntheticOnly: true } };
}

test("publisher permits the synthetic workload and exact 8 MiB until credential validation", async () => {
  for (const bytes of [2_150_979, limit]) {
    // Missing credentials deliberately stop after size validation, without file or network access.
    await assert.rejects(publishSalesforceCandidate(candidateOfBytes(bytes), environment), {
      message: "Salesforce n8n secret path must be absolute",
    });
  }
});

test("publisher rejects UTF-8 overflow before credentials or HTTP and keeps disabled mode inert", async () => {
  const candidate = candidateOfBytes(limit + 1);
  assert.ok(JSON.stringify(candidate.payload).length < limit);
  let fetched = false;
  const options = {
    fetch: async () => {
      fetched = true;
      throw new Error("must not publish");
    },
  };
  await assert.rejects(publishSalesforceCandidate(candidate, environment, options), {
    message: "Salesforce candidate payload exceeds 8 MiB",
  });
  assert.deepEqual(await publishSalesforceCandidate(candidate, {}, options), {
    published: false,
    status: "disabled",
  });
  assert.equal(fetched, false);
});

test("candidate file reads are bounded before parsing and JSON failures stay sanitized", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "salesforce-transport-synthetic-"));
  const file = path.join(directory, "candidate.json");
  try {
    const candidate = candidateOfBytes(limit);
    await writeFile(file, JSON.stringify(candidate));
    assert.deepEqual(await readSalesforceCandidateFile(file), candidate);
    await writeFile(file, '{"privateSyntheticDetail":');
    await assert.rejects(readSalesforceCandidateFile(file), {
      message: "Salesforce candidate file is invalid",
    });
    const handle = await open(file, "w");
    try {
      await handle.truncate(MAX_SALESFORCE_CANDIDATE_FILE_BYTES + 1);
    } finally {
      await handle.close();
    }
    await assert.rejects(readSalesforceCandidateFile(file), {
      message: "Salesforce candidate file exceeds its bounded read limit",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
