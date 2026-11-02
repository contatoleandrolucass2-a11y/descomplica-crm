import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { dashboardAnalysisSliceSchema } from "../../lib/crm/dashboard/analysis-contract.ts";

const root = path.resolve(import.meta.dirname, "../..");
export const baselineFile =
  "supabase/migrations/20261025180000_appointments_funnels_regional_filter.sql";
export const candidateFile = "supabase/migrations/20261102131119_appointments_projection_sets.sql";
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function localConnection(raw) {
  if (!raw)
    return {
      host: "127.0.0.1",
      port: 54322,
      database: "postgres",
      user: "postgres",
      password: "postgres",
      ssl: false,
    };
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== "54322" ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash ||
    decodeURIComponent(url.username) !== "postgres"
  ) {
    throw new Error("Projection benchmark accepts only the isolated local Supabase database.");
  }
  return {
    host: url.hostname.replace(/^\[|\]$/gu, ""),
    port: 54322,
    database: "postgres",
    user: "postgres",
    password: decodeURIComponent(url.password),
    ssl: false,
  };
}

export function projectionDefinition(source) {
  const matches = [
    ...source.matchAll(
      /create or replace function private\.project_crm_appointments_analysis\([\s\S]+?\n\$\$;/gu,
    ),
  ];
  assert.equal(matches.length, 1, "Expected exactly one historical/candidate projector definition");
  return matches[0][0];
}

export function temporaryDefinition(definition, name, noSort = false) {
  assert.ok(["appointments_baseline", "appointments_no_sort"].includes(name));
  let result = definition.replace(
    "create or replace function private.project_crm_appointments_analysis(",
    `create function pg_temp.${name}(`,
  );
  if (noSort) {
    assert.equal(result.split("jsonb_agg(f order by f)").length, 2);
    assert.equal(result.split("'-1'::jsonb)) order by f)").length, 2);
    result = result
      .replace("jsonb_agg(f order by f)", "jsonb_agg(f)")
      .replace("'-1'::jsonb)) order by f)", "'-1'::jsonb)))");
  }
  return result;
}

export function syntheticPayload(rows, labels) {
  assert.ok([5000, 20000].includes(rows) && [30, 300].includes(labels));
  const dictionary = Array.from({ length: labels }, (_, index) => `Synthetic label ${index}`);
  const facts = Array.from({ length: rows }, (_, i) => [
    i % 5,
    `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    Math.floor(i / labels) % labels,
    i % labels,
    Math.floor(i / labels ** 2) % labels,
    i % 2,
    (i * 11) % labels,
    1,
    i % 5 === 4 ? 100 : 0,
    i % 5 === 3 && i % 2 === 1 ? 1 : 0,
    i % 5 === 1 ? i % labels : -1,
  ]);
  const appointments = Array.from({ length: Math.floor(rows / 5) }, (_, i) => ({
    createdAt: new Date(Date.UTC(2026, 0, 2, 12, 0, i)).toISOString(),
    scheduledAt: null,
    attendedAt: null,
    visitPerformed: false,
    regionalManager: "Synthetic regional",
    salesManager: dictionary[Math.floor(i / labels) % labels],
    owner: dictionary[i % labels],
    accountName: `Protected synthetic account ${i}`,
    accountRanking: "Synthetic classification",
    channel: 1,
    company: dictionary[0],
    registeredBroker: true,
  }));
  return dashboardAnalysisSliceSchema.parse({
    version: 4,
    viewKey: "all",
    coverageStart: "2026-01-01",
    referenceDate: "2026-10-31",
    brokerCount: labels,
    brokerManagerCount: labels,
    dimensions: {
      managers: dictionary,
      owners: dictionary,
      companies: dictionary,
      developments: dictionary,
      stores: dictionary,
    },
    facts,
    appointments,
  });
}

const measurementFunction = `create function pg_temp.measure_appointments_projection(
  p_variant text,p_payload jsonb,p_can_rank boolean
) returns jsonb language plpgsql as $$
declare v_start timestamptz; v_result jsonb; v_duration numeric;
begin
  v_start := clock_timestamp();
  case p_variant
    when 'baseline' then v_result := pg_temp.appointments_baseline(p_payload,p_can_rank);
    when 'no_sort' then v_result := pg_temp.appointments_no_sort(p_payload,p_can_rank);
    when 'set_based' then v_result := private.project_crm_appointments_analysis(p_payload,p_can_rank);
    else raise exception 'unknown benchmark variant';
  end case;
  v_duration := extract(epoch from (clock_timestamp()-v_start))*1000;
  return jsonb_build_object('durationMs',v_duration,'payload',v_result);
end; $$;`;

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export async function benchmark(client) {
  const [baselineSource, candidateSource] = await Promise.all([
    readFile(path.join(root, baselineFile), "utf8"),
    readFile(path.join(root, candidateFile), "utf8"),
  ]);
  const baseline = projectionDefinition(baselineSource);
  const candidate = projectionDefinition(candidateSource);
  const candidateBody = candidate.match(/\$\$([\s\S]*)\$\$;/u)[1];
  const report = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    node: process.version,
    baselineFile,
    candidateFile,
    hashes: { baseline: hash(baselineSource), candidate: hash(candidateSource) },
    method:
      "Isolated loopback PostgreSQL only; synthetic schema-validated v4 payloads. Server clock_timestamp around the projector excludes queue/network/serialization. First call and three warm repetitions, rotated order; no OS or PostgreSQL cache flush. Not production latency or a page benchmark.",
    scenarios: [],
    equivalent: false,
  };
  await client.query("begin");
  try {
    await client.query("set local statement_timeout='120s'; set local lock_timeout='1s'");
    const installed = await client.query(
      "select prosrc,provolatile,prosecdef,current_setting('server_version') as version from pg_proc where oid='private.project_crm_appointments_analysis(jsonb,boolean)'::regprocedure",
    );
    assert.equal(
      installed.rows[0]?.prosrc,
      candidateBody,
      "Installed projector differs from the candidate migration",
    );
    assert.equal(installed.rows[0].provolatile, "s");
    assert.equal(installed.rows[0].prosecdef, false);
    report.postgres = installed.rows[0].version;
    report.hashes.installedBody = hash(installed.rows[0].prosrc);
    await client.query(temporaryDefinition(baseline, "appointments_baseline"));
    await client.query(temporaryDefinition(baseline, "appointments_no_sort", true));
    await client.query(measurementFunction);
    for (const [rows, labels] of [
      [5000, 30],
      [20000, 300],
    ]) {
      const payload = syntheticPayload(rows, labels);
      const serialized = JSON.stringify(payload);
      for (const canRank of [true, false]) {
        const scenario = {
          facts: rows,
          labelsPerDimension: labels,
          operations: payload.appointments.length,
          canRank,
          payloadHash: hash(serialized),
          firstCallMs: {},
          warmMs: { baseline: [], no_sort: [], set_based: [] },
        };
        let expected;
        for (let repetition = 0; repetition < 4; repetition++) {
          const order =
            repetition % 2
              ? ["set_based", "no_sort", "baseline"]
              : ["baseline", "no_sort", "set_based"];
          for (const variant of order) {
            const result = await client.query(
              "select pg_temp.measure_appointments_projection($1,$2::jsonb,$3) as measurement",
              [variant, serialized, canRank],
            );
            const measured = result.rows[0].measurement;
            expected ??= measured.payload;
            assert.deepEqual(measured.payload, expected, `Projection mismatch: ${variant}`);
            if (repetition === 0) scenario.firstCallMs[variant] = measured.durationMs;
            else scenario.warmMs[variant].push(measured.durationMs);
          }
        }
        scenario.warmMedianMs = Object.fromEntries(
          Object.entries(scenario.warmMs).map(([name, values]) => [name, median(values)]),
        );
        report.scenarios.push(scenario);
      }
    }
    report.equivalent = true;
    report.observations = {
      noSortLowerWarmMedianInEveryScenario: report.scenarios.every(
        (s) => s.warmMedianMs.no_sort < s.warmMedianMs.baseline,
      ),
      setBasedLowerWarmMedianInEveryScenario: report.scenarios.every(
        (s) => s.warmMedianMs.set_based < s.warmMedianMs.baseline,
      ),
      automaticPromotion: false,
    };
    return report;
  } finally {
    await client.query("rollback");
  }
}

async function main() {
  assert.equal(process.env.CI, "true", "SQL benchmark requires an isolated CI runner");
  assert.equal(
    process.env.CRM_APPOINTMENTS_BENCHMARK_ISOLATED,
    "true",
    "Explicit isolated benchmark scope is required",
  );
  const config = localConnection(process.env.APPOINTMENTS_BENCHMARK_DATABASE_URL);
  const client = new pg.Client({
    ...config,
    application_name: "appointments-synthetic-benchmark",
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const report = await benchmark(client);
    const directory = path.join(root, "test-results/appointments-projection");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "benchmark.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `Isolated appointments projection benchmark failed (${typeof error?.code === "string" ? error.code : "validation"}).`,
    );
    process.exitCode = 1;
  });
}
