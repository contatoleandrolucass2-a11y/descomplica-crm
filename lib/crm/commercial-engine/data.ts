import "server-only";

import postgres from "postgres";
import { z } from "zod";

import type { CommercialEngineKey } from "@/lib/crm/commercial-engine/catalog";
import type { CommercialEngineRuntimeMode } from "@/lib/crm/commercial-engine/config";
import { sha256Schema } from "@/lib/crm/commercial-engine/contract";
import {
  verifyCommercialPolicyDocument,
  type VerifiedCommercialPolicy,
} from "@/lib/crm/commercial-engine/runtime";

const loadedPolicySchema = z
  .object({
    policyId: z.string().uuid(),
    engineKey: z.string(),
    version: z.number().int().positive(),
    policyHash: sha256Schema,
    goldenReportHash: sha256Schema,
    gateState: z.enum(["shadow", "active"]),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveUntil: z.string().datetime({ offset: true }).nullable(),
    policy: z.unknown(),
  })
  .strict();

const executionRecordSchema = z
  .object({
    ok: z.boolean(),
    replay: z.boolean(),
    executionId: z.string().uuid(),
  })
  .strict();

let databaseClient: ReturnType<typeof postgres> | null = null;
let configuredDatabaseUrl: string | null = null;

function commercialEngineDatabase(databaseUrl: string) {
  if (databaseClient) {
    if (configuredDatabaseUrl !== databaseUrl) {
      throw new Error("Commercial engine database configuration changed during process lifetime.");
    }
    return databaseClient;
  }

  configuredDatabaseUrl = databaseUrl;
  databaseClient = postgres(databaseUrl, {
    max: 2,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    max_lifetime: 30 * 60,
    ssl: { rejectUnauthorized: true },
    connection: { application_name: "descomplica_commercial_engine" },
  });
  return databaseClient;
}

function postgresErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export type LoadedCommercialPolicy = VerifiedCommercialPolicy & {
  policyId: string;
  engineKey: CommercialEngineKey;
  version: number;
  gateState: "shadow" | "active";
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export function verifyLoadedCommercialEnginePolicy(
  data: unknown,
  engineKey: CommercialEngineKey,
): LoadedCommercialPolicy {
  const parsed = loadedPolicySchema.safeParse(data);
  if (!parsed.success || parsed.data.engineKey !== engineKey) {
    throw new Error("commercial policy contract failed");
  }
  const verified = verifyCommercialPolicyDocument(parsed.data.policy);
  if (
    verified.document.engineKey !== engineKey ||
    verified.document.version !== parsed.data.version ||
    verified.policyHash !== parsed.data.policyHash ||
    verified.goldenReportHash !== parsed.data.goldenReportHash
  ) {
    throw new Error("commercial policy integrity failed");
  }

  return Object.assign(verified, {
    policyId: parsed.data.policyId,
    engineKey,
    version: parsed.data.version,
    gateState: parsed.data.gateState,
    effectiveFrom: parsed.data.effectiveFrom,
    effectiveUntil: parsed.data.effectiveUntil,
  });
}

export async function loadCommercialEnginePolicy(
  databaseUrl: string,
  actorUserId: string,
  engineKey: CommercialEngineKey,
  requestedMode: Exclude<CommercialEngineRuntimeMode, "off">,
): Promise<LoadedCommercialPolicy | null> {
  const sql = commercialEngineDatabase(databaseUrl);
  let data: unknown;
  try {
    const rows = await sql<{ policy_result: unknown }[]>`
      select commercial_engine.get_policy(
        ${actorUserId}::uuid,
        ${engineKey}::text,
        ${requestedMode}::text
      ) as policy_result
    `;
    data = rows[0]?.policy_result;
  } catch {
    throw new Error("commercial policy lookup failed");
  }
  if (data == null) return null;
  return verifyLoadedCommercialEnginePolicy(data, engineKey);
}

export type CommercialExecutionRecordResult =
  | { status: "recorded"; replay: boolean; executionId: string }
  | { status: "conflict" };

export async function recordCommercialEngineExecution(input: {
  databaseUrl: string;
  actorUserId: string;
  engineKey: CommercialEngineKey;
  mode: Exclude<CommercialEngineRuntimeMode, "off">;
  policyHash: string;
  requestId: string;
  inputHash: string;
  outputHash: string;
  durationMs: number;
}): Promise<CommercialExecutionRecordResult> {
  const sql = commercialEngineDatabase(input.databaseUrl);
  let data: unknown;
  try {
    const rows = await sql<{ execution_result: unknown }[]>`
      select commercial_engine.record_execution(
        ${input.actorUserId}::uuid,
        ${input.engineKey}::text,
        ${input.mode}::text,
        ${input.policyHash}::text,
        ${input.requestId}::uuid,
        ${input.inputHash}::text,
        ${input.outputHash}::text,
        ${input.durationMs}::integer
      ) as execution_result
    `;
    data = rows[0]?.execution_result;
  } catch (error) {
    if (postgresErrorCode(error) === "23505") return { status: "conflict" };
    throw new Error("commercial execution audit failed");
  }

  const parsed = executionRecordSchema.safeParse(data);
  if (!parsed.success || !parsed.data.ok) throw new Error("commercial execution audit failed");
  return {
    status: "recorded",
    replay: parsed.data.replay,
    executionId: parsed.data.executionId,
  };
}
