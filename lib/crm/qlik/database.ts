import "server-only";

import postgres from "postgres";
import { z } from "zod";

import type { QlikRankingIngestion } from "../integrations/contracts";
import type { QlikRelayMode } from "./config";

const relayResultSchema = z
  .object({
    ok: z.boolean(),
    status: z.enum(["shadow_compared", "succeeded", "rejected", "gate_blocked"]),
    runId: z.string().uuid().nullable().optional(),
    recordCount: z.number().int().nonnegative().nullable().optional(),
    developmentRecordCount: z.number().int().nonnegative().nullable().optional(),
    idempotent: z.boolean().optional(),
    replay: z.boolean().optional(),
    comparisonStatus: z.enum(["matched", "mismatch", "legacy_run_missing"]).optional(),
    reason: z
      .enum([
        "invalid_payload",
        "request_conflict",
        "replay_conflict",
        "cutover_gate_closed",
        "relay_role_not_isolated",
        "database_unavailable",
        "rate_limited",
      ])
      .optional(),
  })
  .strict();

export type QlikRelayDatabaseResult = z.infer<typeof relayResultSchema>;

let databaseClient: ReturnType<typeof postgres> | null = null;
let configuredDatabaseUrl: string | null = null;

function qlikRelayDatabase(databaseUrl: string) {
  if (databaseClient) {
    if (configuredDatabaseUrl !== databaseUrl) {
      throw new Error("Qlik relay database configuration changed during process lifetime.");
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
    connection: { application_name: "descomplica_qlik_relay" },
  });
  return databaseClient;
}

export async function executeQlikRelayIngestion(input: {
  databaseUrl: string;
  payload: QlikRankingIngestion;
  mode: Exclude<QlikRelayMode, "off">;
  keyId: string;
  requestedAt: string;
  nonceHash: string;
  bodySha256: string;
}): Promise<QlikRelayDatabaseResult> {
  const sql = qlikRelayDatabase(input.databaseUrl);
  const rows = await sql<{ relay_result: unknown }[]>`
    select qlik_relay.ingest_snapshot(
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.mode}::text,
      ${input.keyId}::text,
      ${input.requestedAt}::timestamptz,
      ${input.nonceHash}::text,
      ${input.bodySha256}::text
    ) as relay_result
  `;

  return relayResultSchema.parse(rows[0]?.relay_result);
}
