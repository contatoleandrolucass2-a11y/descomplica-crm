import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import { assertPrivateRegularFile } from "./private-file.mjs";
import {
  MAX_SALESFORCE_CANDIDATE_FILE_BYTES,
  MAX_SALESFORCE_INGESTION_BODY_BYTES,
} from "../../lib/crm/salesforce/transport.ts";
const MINIMUM_MACHINE_SECRET_LENGTH = 32;

function log(message, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), message, ...details })}\n`,
  );
}

function safeWebhookUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Salesforce n8n webhook URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !url.hostname
  ) {
    throw new Error("Salesforce n8n webhook URL must use credential-free HTTPS");
  }
  return url;
}

async function readMachineSecret(secretPath, privateFileOptions) {
  if (!secretPath || !path.isAbsolute(secretPath)) {
    throw new Error("Salesforce n8n secret path must be absolute");
  }
  try {
    await assertPrivateRegularFile(secretPath, privateFileOptions);
  } catch {
    throw new Error("Salesforce n8n secret must be a private regular file");
  }
  const value = (await readFile(secretPath, "utf8")).replace(/\r?\n$/, "");
  if (
    value.length < MINIMUM_MACHINE_SECRET_LENGTH ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes("\0")
  ) {
    throw new Error("Salesforce n8n secret is invalid");
  }
  return value;
}

export async function publishSalesforceCandidate(
  candidate,
  environment = process.env,
  options = {},
) {
  if (environment.SALESFORCE_N8N_PUBLISH_ENABLED !== "true") {
    return { published: false, status: "disabled" };
  }
  const payload = candidate?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Salesforce candidate payload is missing");
  }
  if (
    payload.schemaVersion !== 2 ||
    typeof payload.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.requestId,
    )
  ) {
    throw new Error("Salesforce candidate payload identity is invalid");
  }
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body, "utf8") > MAX_SALESFORCE_INGESTION_BODY_BYTES) {
    throw new Error("Salesforce candidate payload exceeds 8 MiB");
  }

  const webhookUrl = safeWebhookUrl(environment.SALESFORCE_N8N_WEBHOOK_URL);
  const secret = await readMachineSecret(
    environment.SALESFORCE_N8N_SECRET_FILE,
    options.privateFileOptions,
  );
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      "x-request-id": payload.requestId,
    },
    body,
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Salesforce n8n publication failed with HTTP ${response.status}`);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Salesforce n8n publication returned an invalid response");
  }
  if (result?.ok !== true || result.requestId !== payload.requestId) {
    throw new Error("Salesforce n8n publication did not confirm the request");
  }
  return {
    published: true,
    status: response.status,
    requestId: payload.requestId,
    idempotent: result.idempotent === true,
    recordCount: result.recordCount ?? null,
  };
}

export async function readSalesforceCandidateFile(candidatePath) {
  let handle;
  try {
    handle = await open(candidatePath, "r");
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw new Error("Salesforce candidate file is invalid");
    if (metadata.size > MAX_SALESFORCE_CANDIDATE_FILE_BYTES) {
      throw new Error("Salesforce candidate file exceeds its bounded read limit");
    }
    // Recheck actual bytes while reading: the file may grow after stat().
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(
        Math.min(64 * 1024, MAX_SALESFORCE_CANDIDATE_FILE_BYTES - total + 1),
      );
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > MAX_SALESFORCE_CANDIDATE_FILE_BYTES) {
        throw new Error("Salesforce candidate file exceeds its bounded read limit");
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total)),
      );
    } catch {
      throw new Error("Salesforce candidate file is invalid");
    }
  } catch (error) {
    if (error?.message === "Salesforce candidate file exceeds its bounded read limit") throw error;
    throw new Error("Salesforce candidate file is invalid");
  } finally {
    await handle?.close().catch(() => {
      throw new Error("Salesforce candidate file is invalid");
    });
  }
}

async function publishFromFile(environment = process.env) {
  const candidatePath = environment.SALESFORCE_CANDIDATE_OUTPUT;
  if (!candidatePath || !path.isAbsolute(candidatePath)) {
    throw new Error("absolute Salesforce candidate path required");
  }
  const candidate = await readSalesforceCandidateFile(candidatePath);
  const result = await publishSalesforceCandidate(candidate, environment);
  log("Salesforce candidate publication completed", result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publishFromFile().catch((error) => {
    log("Salesforce candidate publication failed", {
      error: error instanceof Error ? error.message : "unknown publication failure",
    });
    process.exitCode = 1;
  });
}
