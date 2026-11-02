import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createPool } from "../../lib/crm/lead-plus/server/postgres.mjs";

const command = process.argv[2] || "--check";
if (!["--check", "--apply"].includes(command)) throw new Error("Use --check or --apply.");
if (!process.env.LEAD_DB_URL || !process.env.LEAD_DB_PROJECT_REF)
  throw new Error(
    "Provide the isolated LEAD+ database configuration through the server environment.",
  );
const connection = new URL(process.env.LEAD_DB_URL);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname);
if (!local && process.env.LEAD_DB_PROJECT_REF !== "xwtasgjnkctyxokxjykk")
  throw new Error("The CRM/Auth database is not an allowed destination.");
if (command === "--apply" && process.env.LEAD_WHATSAPP_MIGRATION_APPROVED !== "1")
  throw new Error(
    "Apply requires explicit migration authorization and LEAD_WHATSAPP_MIGRATION_APPROVED=1.",
  );
const pool = createPool({ ...process.env, SUPABASE_DB_URL: undefined });
const tables = [
  "wa_accounts",
  "wa_contacts",
  "wa_conversations",
  "wa_messages",
  "wa_assignment_history",
  "wa_internal_notes",
  "wa_webhook_events",
  "wa_changes",
  "wa_availability",
  "wa_reads",
];
const source = await readFile(
  new URL(
    "../../lib/crm/lead-plus/server/migrations/20261102013756_lead_whatsapp_central.sql",
    import.meta.url,
  ),
  "utf8",
);
const checksum = createHash("sha256").update(source).digest("hex");
let client;
try {
  client = await pool.connect();
  await client.query(command === "--apply" ? "BEGIN" : "BEGIN READ ONLY");
  if (command === "--apply") await client.query("SELECT pg_advisory_xact_lock(730203)");
  const found = (
    await client.query(
      "SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='c2s_app' AND tablename=ANY($1::text[])",
      [tables],
    )
  ).rows;
  if (command === "--check") {
    console.log(
      JSON.stringify({
        destination: local ? "local" : "isolated-lead-plus",
        expected_tables: tables.length,
        present_tables: found.length,
        all_present: found.length === tables.length,
        rls_enabled: found.length === tables.length && found.every((row) => row.rowsecurity),
        migration_sha256: checksum,
        writes: false,
      }),
    );
    await client.query("ROLLBACK");
  } else {
    const prior = (
      await client.query(
        "SELECT data FROM c2s_app.resources WHERE kind='settings' AND id='whatsapp-schema-v1' FOR UPDATE",
      )
    ).rows[0];
    if (found.length) {
      if (
        found.length !== tables.length ||
        prior?.data?.checksum !== checksum ||
        !found.every((row) => row.rowsecurity)
      )
        throw new Error(
          "Existing or partial WhatsApp schema requires reconciliation; no changes applied.",
        );
      await client.query("ROLLBACK");
      console.log(JSON.stringify({ status: "already_applied", migration_sha256: checksum }));
    } else {
      if (prior)
        throw new Error("Migration ledger exists without its tables; reconcile before applying.");
      await client.query(source.replace(/^([\s\S]*?)\bBEGIN;/, "$1").replace(/COMMIT;\s*$/, ""));
      await client.query(
        "INSERT INTO c2s_app.resources(kind,id,data) VALUES('settings','whatsapp-schema-v1',$1)",
        [JSON.stringify({ checksum, applied_at: new Date().toISOString() })],
      );
      await client.query("COMMIT");
      console.log(
        JSON.stringify({
          status: "applied",
          destination: local ? "local" : "isolated-lead-plus",
          migration_sha256: checksum,
        }),
      );
    }
  }
} catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "WhatsApp schema operation failed; configuration and SQL details were not printed.",
  );
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end();
}
