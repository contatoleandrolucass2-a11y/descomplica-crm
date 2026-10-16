// Offline planner. No network, database, subprocess, CLI, or file writes.
// Pin provenance: local HEAD 2234298b6312623e0b1105054de3bf105a25b864.
// Coordinator must independently match these bytes to approved PR235 artifacts.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SOURCES = Object.freeze([
  Object.freeze({
    name: "20261015202643_sync_page_catalog.sql",
    sha256: "408be14e270848de530cc5e10a64361a81421032f07dd7c99c2c54ed3f4b3673",
  }),
  Object.freeze({
    name: "20261015202644_routine_individual_page_access.sql",
    sha256: "582dc8a45df4de0cc0f7209ca343f4661da4b03e29bfa1a9302b25a4a33654f7",
  }),
  Object.freeze({
    name: "20261016000120_individual_page_data_access.sql",
    sha256: "aea60d3202b0be62c0c08b9d6849ff032790d3e4c5d2b89e164fefdcc084b320",
  }),
]);
export const TABLES = Object.freeze([
  "app_pages",
  "permissions",
  "role_permissions",
  "user_permission_overrides",
  "user_roles",
]);
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = fileURLToPath(new URL("../../", import.meta.url));

// A lexical scanner, not a general PostgreSQL parser. Dollar-quoted bodies are
// opaque, so PL/pgSQL BEGIN/END and their semicolons cannot become SQL controls.
export function statements(sql) {
  const result = [];
  let tokens = [];
  let start;
  let i = 0;
  function token(value, at) {
    start ??= at;
    tokens.push(value);
  }
  while (i < sql.length) {
    const at = i;
    if (/\s/u.test(sql[i])) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      const end = sql.slice(i + 2).search(/[\r\n]/u);
      i = end < 0 ? sql.length : i + 2 + end + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      i += 2;
      let depth = 1;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw new Error("Unterminated SQL comment");
      continue;
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/u)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new Error("Unterminated dollar quote");
      token("<quoted>", at);
      i = end + dollar.length;
      continue;
    }
    const escaped = /^[eE]'/u.test(sql.slice(i));
    if (sql[i] === "'" || sql[i] === '"' || escaped) {
      if (escaped) i++;
      const quote = sql[i++];
      let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) throw new Error("Unterminated SQL quote");
      token("<quoted>", at);
      continue;
    }
    if (sql[i] === ";") {
      if (!tokens.length) throw new Error("Empty SQL statement");
      result.push({ start, end: ++i, tokens });
      tokens = [];
      start = undefined;
      continue;
    }
    if (sql[i] === "\\" || sql[i] === "\0") throw new Error("Unsupported SQL input");
    const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9$]*/u)?.[0];
    if (word) {
      token(word.toUpperCase(), at);
      i += word.length;
    } else {
      token(sql[i], at);
      i++;
    }
  }
  if (tokens.length) throw new Error("SQL statement missing semicolon");
  return result;
}

export function stripOuterTransaction(sql) {
  const list = statements(sql);
  const first = list[0];
  const last = list.at(-1);
  if (list.length < 3 || first.tokens.join(" ") !== "BEGIN" || last.tokens.join(" ") !== "COMMIT") {
    throw new Error("Expected exactly BEGIN; and COMMIT; outer wrappers");
  }
  for (const { tokens } of list.slice(1, -1)) {
    const control =
      /^(BEGIN|START|COMMIT|END|ABORT|ROLLBACK|SAVEPOINT|RELEASE|PREPARE)$/u.test(tokens[0]) ||
      (tokens[0] === "SET" &&
        /^(TRANSACTION|SESSION|LOCAL)$/u.test(tokens[1]) &&
        (tokens[1] !== "LOCAL" || tokens[2] === "TRANSACTION"));
    if (control) throw new Error("Extra transaction control");
    if (
      !["SET", "LOCK", "CREATE", "ALTER", "WITH", "INSERT", "NOTIFY", "DO", "SELECT"].includes(
        tokens[0],
      )
    ) {
      throw new Error("Unsupported top-level SQL statement");
    }
  }
  // Remove only the two lexical statement spans. All other bytes are retained.
  return sql.slice(0, first.start) + sql.slice(first.end, last.start) + sql.slice(last.end);
}

export async function loadSources(directory = path.join(root, "supabase/migrations")) {
  const loaded = [];
  for (const source of SOURCES) {
    const bytes = await readFile(path.join(directory, source.name));
    if (digest(bytes) !== source.sha256) throw new Error(`Source hash mismatch: ${source.name}`);
    loaded.push({ ...source, bytes });
  }
  return loaded;
}

export function combineSources(loaded) {
  if (!Array.isArray(loaded) || loaded.length !== SOURCES.length)
    throw new Error("Expected exact source trio");
  return loaded
    .map((source, index) => {
      const pin = SOURCES[index];
      if (
        source.name !== pin.name ||
        !Buffer.isBuffer(source.bytes) ||
        digest(source.bytes) !== pin.sha256
      ) {
        throw new Error(`Source hash/order mismatch: ${pin.name}`);
      }
      return stripOuterTransaction(source.bytes.toString("utf8"));
    })
    .join("\n");
}

function fingerprint(table) {
  return `(select jsonb_build_object('count', count(*), 'sha256',
    encode(sha256(convert_to(coalesce(jsonb_agg(row_value order by row_value::text collate "C"), '[]'::jsonb)::text, 'UTF8')), 'hex'))
    from (select to_jsonb(t) row_value from public.${table} t) rows)`;
}

// Run this INSIDE the same consistent transaction that creates the private backup.
// Full rows remain on the private VPS; only counts/digests enter the CAS input.
export const snapshotSql = `select jsonb_build_object(\n${TABLES.map((table) => `  '${table}', ${fingerprint(table)}`).join(",\n")}\n) as catalog_snapshot;`;

function buildActivationBody(loaded, expectedSnapshot) {
  const body = combineSources(loaded);
  if (
    !expectedSnapshot ||
    Object.keys(expectedSnapshot).sort().join() !== [...TABLES].sort().join()
  ) {
    throw new Error("Exact five-table backup snapshot required");
  }
  for (const table of TABLES) {
    const value = expectedSnapshot[table];
    if (
      !value ||
      Object.keys(value).sort().join() !== "count,sha256" ||
      !Number.isSafeInteger(value.count) ||
      value.count < 0 ||
      !/^[a-f0-9]{64}$/u.test(value.sha256)
    ) {
      throw new Error(`Invalid backup snapshot: ${table}`);
    }
  }
  const cas = TABLES.map(
    (
      table,
    ) => `  if ${fingerprint(table)} is distinct from '${JSON.stringify(expectedSnapshot[table])}'::jsonb then
    raise exception 'catalog CAS mismatch: ${table}; abort and create a new private backup' using errcode = '40001';
  end if;`,
  ).join("\n");
  const capture = TABLES.map(
    (table) =>
      `create temporary table catalog_before_${table} on commit drop as select * from public.${table};`,
  ).join("\n");
  const preserved = TABLES.map((table) => {
    const columns = table === "app_pages" ? "key, is_active" : "*";
    return `  if exists (select ${columns} from catalog_before_${table} except select ${columns} from public.${table}) then
    raise exception 'catalog preservation failed: ${table}' using errcode = '23514';
  end if;`;
  }).join("\n");
  return `set local lock_timeout = '5s';
lock table ${TABLES.map((table) => `public.${table}`).join(", ")} in share row exclusive mode;
do $catalog_cas$
begin
${cas}
end;
$catalog_cas$;
${capture}
${body}
do $catalog_preserved$
begin
${preserved}
end;
$catalog_preserved$;
`;
}

function dollarQuote(text, label) {
  let suffix = 0;
  while (text.includes(`$${label}_${suffix}$`)) suffix++;
  const delimiter = `$${label}_${suffix}$`;
  return `${delimiter}${text}${delimiter}`;
}

// SPI accepts multiple commands and refreshes snapshots per command under READ
// COMMITTED. One DO statement, with no caught errors or transaction controls,
// makes catalog DML and DDL atomic even when the caller uses autocommit.
// Migration-history bookkeeping by the MCP/API is separate and must be checked.
function atomicStatement(body) {
  const block = `\nbegin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'catalog activation requires read committed isolation' using errcode = '25001';
  end if;
  execute ${dollarQuote(body, "catalog_bundle")};
end;\n`;
  return `do ${dollarQuote(block, "catalog_activation")} language plpgsql;\n`;
}

export function buildActivation(loaded, expectedSnapshot) {
  const query = atomicStatement(buildActivationBody(loaded, expectedSnapshot));
  return {
    name: "dashboard_catalog_pr235_activation",
    transactionOwner: "PostgreSQL single DO statement",
    query,
    sha256: digest(query),
  };
}

export const verificationPlan = Object.freeze({
  authority:
    "Approved immutable SQL migrations; server RPCs, has_permission, RLS and restrictive MFA policies enforce access. UI visibility is not authorization.",
  backupAndCas: [
    "Coordinator confirms exact project/environment and approved source hashes; obtains private backup via MCP on VPS without printing rows, UUIDs, reasons or credentials.",
    "In one backup transaction: lock app_pages, permissions, role_permissions, user_permission_overrides, user_roles in this fixed order, SHARE ROW EXCLUSIVE; save all five tables and schema/RPC/policy definitions privately and compute snapshotSql before releasing locks. A dump and fingerprints from unrelated snapshots are not acceptable.",
    "Pass that exact five-table snapshot to buildActivation. Send query unchanged in one MCP apply_migration call: a single DO statement owns atomic catalog execution even in autocommit. No multi-call SQL fragments or manual COMMIT. API migration-history bookkeeping is NOT assumed atomic with this statement; verify history afterward and reconcile ambiguity before any retry.",
    "Application requires READ COMMITTED and locks all five tables before CAS, so a writer completing while the lock waits is visible to CAS. A differing count or digest raises 40001 before DDL. Abort, inspect concurrency, create a NEW backup and snapshot, then rebuild; never replace expected hashes alone or overwrite concurrent choices.",
  ],
  prechecks: [
    "Read-only aggregates: exact migration history and prerequisites; table/RLS existence; four routine RPC signatures, owners, ACLs, security-definer/search_path and five target policies including restrictive MFA policies. Missing dependency blocks application; no inferred legacy preparation.",
    "Capture snapshotSql in backup transaction. Count pages by is_active, overrides by permission_key/effect, role defaults by role_key/permission_key, orphan permission references, and duplicate keys. Keep identifiers/reasons private.",
    "Compute expected additions against the backup: only newly registered permissions inherit legacy role grants/overrides; repasse inheritance is master/admin only; administrative default inserts also apply to existing permissions. Catalog changes metadata but preserves existing is_active.",
  ],
  postchecks: [
    "In-transaction preservation assertions compare all previous rows for permissions, role_permissions, overrides and user_roles; app_pages compares key/is_active. Any removal/change aborts the whole application. Full preimage remains temporary on server, never returned.",
    "Coordinator compares aggregate expected additions versus observed additions; check zero missing/mismatched catalog entries, zero unexpected role/override grants, zero orphan references, four expected routine RPC definitions and five expected policy definitions. Unrelated grants, write policies and restrictive MFA policies must match backup.",
    "Verify migration history contains the combined activation once and maintain explicit mapping to the original three versions; do not falsely stamp originals or blindly reapply them. Post-commit reads can observe later authorized edits; use transaction evidence to distinguish them.",
    "Run existing page_catalog, page_access_set_convergence, individual-page and crm_shared_routines pgTAP coverage locally: allowed/denied roles, explicit deny precedence, inactive page/account, channel restrictions, MFA, routine write permission/revision. Healthy HTTP alone is insufficient.",
  ],
  localRehearsal: [
    "Use an isolated disposable PostgreSQL/Supabase matching production version, prerequisites before this trio, and synthetic fixtures only. No remote URL and no production dump on desktop.",
    "Obtain fixture snapshot; execute buildRollbackRehearsal.query unchanged in AUTOCOMMIT, with no outer BEGIN/ROLLBACK. Require P0235 and verify all DDL/catalog updates rolled back. Execute buildActivation.query unchanged in autocommit on a fresh fixture and assert expected additions and unchanged existing choices.",
    "Use two sessions: change a protected row after snapshot and verify CAS 40001; during activation verify a competing write blocks until transaction end. Rehearse missing dependency and lock timeout. Commit once on disposable DB to prove temp-table cleanup and repeat-application behavior.",
  ],
  limitations:
    "No remote execution, backup, project selection, publication or legacy builder. Source hashes pin raw LF bytes; never normalize or accept CRLF silently. Lexer is intentionally narrow; hashes are mandatory. CAS guards the five table contents, not schema/function drift; coordinator must serialize other DDL/migration writers and verify those definitions separately. Aggregating full rows may need sizing rehearsal. Preservation assertions do not by themselves prove that new grants are correct. Existing source SET LOCAL statement_timeout remains byte-preserved but does NOT guarantee a deadline for the already-running DO statement. Require an externally bounded MCP/database operation; lock_timeout remains 5s. Client timeout/disconnect alone does not prove cancellation or rollback: reconcile operation and history before retrying.",
});

const routineNames =
  "'get_crm_routines', 'save_crm_routine', 'get_crm_routine_completions', 'set_crm_routine_completion'";
const policyTables =
  "'crm_dashboard_snapshots', 'crm_dashboard_metrics', 'crm_funnel_goals', 'crm_point_settings', 'crm_point_metrics'";
const routineState = `select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition,
  p.proacl, p.proowner, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in (${routineNames})`;
const policyState = `select * from pg_policies where schemaname = 'public' and tablename in (${policyTables})`;

// Test-only SQL strings. The runner supplies an isolated DB and a SINGLE session.
// Setup is committed before the single DO; temp evidence survives its failure.
export function buildRollbackRehearsal(loaded, expectedSnapshot) {
  const body = buildActivationBody(loaded, expectedSnapshot);
  const states = [
    ...TABLES.map((table) => [table, `select * from public.${table}`]),
    ["routines", routineState],
    ["policies", policyState],
  ];
  const fixtureSql = states
    .map(
      ([name, sql]) =>
        `create temporary table catalog_rollback_${name} on commit preserve rows as ${sql};`,
    )
    .join("\n");
  const changed = (name, sql) => `exists (
    (select to_jsonb(old_row) from catalog_rollback_${name} old_row except select to_jsonb(new_row) from (${sql}) new_row)
    union all
    (select to_jsonb(new_row) from (${sql}) new_row except select to_jsonb(old_row) from catalog_rollback_${name} old_row)
  )`;
  const verify = states
    .map(
      ([name, sql]) =>
        `  if ${changed(name, sql)} then raise exception 'rollback mismatch: ${name}' using errcode = '23514'; end if;`,
    )
    .join("\n");
  const catalogChanged = TABLES.map((table) =>
    changed(table, `select * from public.${table}`),
  ).join(" or ");
  const failureSql = `do $catalog_injected_failure$
begin
  if not (${catalogChanged})
    or not ${changed("routines", routineState)}
    or not ${changed("policies", policyState)} then
    raise exception 'rehearsal fixture must exercise catalog, routine and policy mutations' using errcode = 'P0236';
  end if;
  raise exception 'catalog rehearsal: injected failure after final policy DDL' using errcode = 'P0235';
end;
$catalog_injected_failure$;\n`;
  const boundary = body.indexOf("do $catalog_preserved$");
  if (boundary < 0) throw new Error("Missing rehearsal injection boundary");
  return {
    fixtureSql,
    query: atomicStatement(body.slice(0, boundary) + failureSql + body.slice(boundary)),
    expectedSqlState: "P0235",
    verifyRollbackSql: `do $catalog_rollback_verified$\nbegin\n${verify}\nend;\n$catalog_rollback_verified$;`,
    instructions:
      "Disposable local/CI database only, after compact baseline and before trio. Seed synthetic allow/deny overrides, role defaults and inactive app_pages first. Same connection in AUTOCOMMIT: run fixtureSql and commit setup; obtain snapshotSql; run query UNCHANGED with NO external BEGIN/ROLLBACK; require SQLSTATE P0235; run verifyRollbackSql. P0235 is emitted only after observing changes to catalog rows, routine definitions and policy definitions; P0236 rejects a no-op baseline. Missing prerequisites or any other error is a failed rehearsal, not proof of rollback. Also run buildActivation.query unchanged in autocommit successfully on a fresh fixture. Never send rehearsal SQL to production.",
  };
}
