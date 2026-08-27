import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, describe, expect, it, vi } from "vitest";

import { COMMERCIAL_ENGINE_KEYS, SIMULATOR_ENGINE_KEYS } from "@/lib/crm/commercial-engine/catalog";
import { hashCanonicalJson, serializeCanonicalJson } from "@/lib/crm/commercial-engine/canonical";
import { getCommercialEngineRuntimeConfiguration } from "@/lib/crm/commercial-engine/config";
import { commercialExpressionSchema } from "@/lib/crm/commercial-engine/contract";
import { verifyLoadedCommercialEnginePolicy } from "@/lib/crm/commercial-engine/data";
import {
  addCommercialDecimals,
  commercialDecimalToString,
  commercialDecimalToOutputString,
  divideCommercialDecimals,
  multiplyCommercialDecimals,
  parseCommercialDecimal,
  roundCommercialDecimal,
} from "@/lib/crm/commercial-engine/decimal";
import {
  handleCommercialEnginePost,
  type CommercialEngineHandlerDependencies,
} from "@/lib/crm/commercial-engine/handler";
import {
  commercialPolicyInputHash,
  CommercialPolicyIntegrityError,
  CommercialPolicyRuntimeError,
  executeVerifiedCommercialPolicy,
  verifyCommercialPolicyDocument,
} from "@/lib/crm/commercial-engine/runtime";
import { emitCommercialEngineTelemetry } from "@/lib/crm/commercial-engine/telemetry";
import { runCommercialPolicyVerifyCli } from "@/ops/commercial-policies/verify";

const ENDPOINT = "https://crm.example.com/api/commercial-engine/simulator.wf13";
const REQUEST_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_USER_ID = "10000000-0000-4000-8000-000000000002";
const DATABASE_URL =
  "postgresql://crm_commercial_engine:local-test-password@127.0.0.1:54322/postgres?sslmode=verify-full";
const SUPABASE_PROJECT_REF = "abcdefghijklmnopqrst";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const execFileAsync = promisify(execFile);

function structuralPolicyFixture() {
  return {
    schemaVersion: 1,
    engineKey: "simulator.wf13",
    version: 1,
    effectiveFrom: "2026-08-10T00:00:00.000Z",
    effectiveUntil: null,
    timezone: "America/Sao_Paulo",
    ownerKey: "qa.fixture.owner",
    backupOwnerKey: "qa.fixture.backup",
    evidenceReference: "test-fixture:structural-only-no-commercial-authority",
    changeReason: "Exercise deterministic runtime boundaries without a commercial rule.",
    definition: {
      schemaVersion: 1,
      runtimeVersion: 1,
      inputs: [
        { key: "approved", valueType: "boolean" },
        { key: "fixture_amount", valueType: "decimal" },
        { key: "fixture_date", valueType: "date" },
        { key: "fixture_label", valueType: "string" },
      ],
      outputs: [
        {
          key: "allowed",
          valueType: "boolean",
          expression: {
            op: "and",
            args: [
              { op: "input", key: "approved" },
              {
                op: "compare",
                comparator: "gte",
                left: { op: "input", key: "fixture_amount" },
                right: { op: "literal", valueType: "decimal", value: "0" },
              },
            ],
          },
        },
        {
          key: "fixture_date_next_month",
          valueType: "date",
          expression: {
            op: "date_add_months",
            date: { op: "input", key: "fixture_date" },
            amount: { op: "literal", valueType: "decimal", value: "1" },
            overflow: "clamp",
          },
        },
        {
          key: "fixture_echo",
          valueType: "decimal",
          expression: {
            op: "round",
            value: { op: "input", key: "fixture_amount" },
            scale: 2,
            rounding: "half_even",
          },
        },
        {
          key: "fixture_label_echo",
          valueType: "string",
          expression: {
            op: "concat",
            args: [
              { op: "input", key: "fixture_label" },
              { op: "literal", valueType: "string", value: "-verified" },
            ],
          },
        },
      ],
    },
    goldenCases: [
      {
        caseKey: "structural.boundary",
        input: {
          approved: true,
          fixture_amount: "2.345",
          fixture_date: "2024-01-31",
          fixture_label: "qa",
        },
        expected: {
          allowed: true,
          fixture_date_next_month: "2024-02-29",
          fixture_echo: "2.34",
          fixture_label_echo: "qa-verified",
        },
      },
      {
        caseKey: "structural.negative",
        input: {
          approved: true,
          fixture_amount: "-1.005",
          fixture_date: "2025-01-31",
          fixture_label: "fixture",
        },
        expected: {
          allowed: false,
          fixture_date_next_month: "2025-02-28",
          fixture_echo: "-1",
          fixture_label_echo: "fixture-verified",
        },
      },
    ],
  };
}

// Kept byte-for-byte equivalent to pg_temp.qa_commercial_manifest's default
// policy in commercial_engine_policy_runtime.test.sql. It is technical only.
function databaseParityPolicyFixture() {
  return {
    schemaVersion: 1,
    engineKey: "simulator.wf13",
    version: 1,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: "2099-01-01T00:00:00.000Z",
    timezone: "America/Sao_Paulo",
    ownerKey: "qa-policy-owner",
    backupOwnerKey: "qa-policy-backup",
    evidenceReference: "test://commercial/structural-only",
    changeReason: "QA structural identity fixture; no commercial authority",
    definition: {
      schemaVersion: 1,
      runtimeVersion: 1,
      inputs: [{ key: "qa_value", valueType: "decimal" }],
      outputs: [
        {
          key: "qa_echo",
          valueType: "decimal",
          expression: { op: "input", key: "qa_value" },
        },
      ],
    },
    goldenCases: [
      {
        caseKey: "qa.identity.zero",
        input: { qa_value: "0" },
        expected: { qa_echo: "0" },
      },
    ],
  };
}

function executionInput() {
  return {
    approved: true,
    fixture_amount: "2.345",
    fixture_date: "2024-01-31",
    fixture_label: "qa",
  };
}

function request(input: Record<string, unknown> = executionInput(), init: RequestInit = {}) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: "https://crm.example.com",
      ...init.headers,
    },
    body: JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, input }),
    ...init,
  });
}

function handlerHarness(mode: "shadow" | "active" = "shadow") {
  const verified = verifyCommercialPolicyDocument(structuralPolicyFixture());
  const authorize = vi.fn<CommercialEngineHandlerDependencies["authorize"]>(async () => ({
    ok: true,
    context: {
      userId: ACTOR_USER_ID,
      roleKey: "user",
      level: 10,
      permissions: ["crm.simulators.execute"],
    },
  }));
  const loadPolicy = vi.fn<CommercialEngineHandlerDependencies["loadPolicy"]>(async () =>
    Object.assign(verified, {
      policyId: "20000000-0000-4000-8000-000000000001",
      engineKey: "simulator.wf13" as const,
      version: 1,
      gateState: mode,
      effectiveFrom: "2026-08-10T00:00:00.000Z",
      effectiveUntil: null,
    }),
  );
  const recordExecution = vi.fn<CommercialEngineHandlerDependencies["recordExecution"]>(
    async () => ({
      status: "recorded",
      replay: false,
      executionId: "30000000-0000-4000-8000-000000000001",
    }),
  );
  const emit = vi.fn();
  const dependencies: CommercialEngineHandlerDependencies = {
    configuration: () => ({
      mode,
      available: true,
      enabledKeys: ["simulator.wf13"],
      databaseUrl: DATABASE_URL,
    }),
    authorize,
    loadPolicy,
    recordExecution,
    emit,
  };
  return { authorize, dependencies, emit, loadPolicy, recordExecution, verified };
}

describe("commercial engine catalog and flags", () => {
  it("registers every scoped engine without enabling one implicitly", () => {
    expect(COMMERCIAL_ENGINE_KEYS).toHaveLength(14);
    expect(new Set(COMMERCIAL_ENGINE_KEYS).size).toBe(14);
    expect(Object.values(SIMULATOR_ENGINE_KEYS)).toEqual([
      "simulator.wf13",
      "simulator.wf16",
      "simulator.caixa",
      "simulator.wf14",
      "simulator.wf15",
    ]);
    expect(getCommercialEngineRuntimeConfiguration({})).toEqual({
      mode: "off",
      available: false,
      enabledKeys: [],
    });
  });

  it("fails closed for an invalid mode, empty allowlist, duplicates, or unknown keys", () => {
    expect(
      getCommercialEngineRuntimeConfiguration({
        COMMERCIAL_ENGINE_RUNTIME_MODE: "true",
        COMMERCIAL_ENGINE_ENABLED_KEYS: "simulator.wf13",
      }).available,
    ).toBe(false);
    for (const enabledKeys of [
      "",
      "simulator.wf13,simulator.wf13",
      "simulator.unknown",
      "simulator.wf13,",
    ]) {
      expect(
        getCommercialEngineRuntimeConfiguration({
          COMMERCIAL_ENGINE_RUNTIME_MODE: "active",
          COMMERCIAL_ENGINE_ENABLED_KEYS: enabledKeys,
        }).available,
      ).toBe(false);
    }
  });

  it("requires both an explicit mode and exact engine allowlist", () => {
    expect(
      getCommercialEngineRuntimeConfiguration({
        COMMERCIAL_ENGINE_RUNTIME_MODE: "shadow",
        COMMERCIAL_ENGINE_ENABLED_KEYS: "simulator.wf13,goals.dv",
        COMMERCIAL_ENGINE_DATABASE_URL: DATABASE_URL,
      }),
    ).toEqual({
      mode: "shadow",
      available: true,
      enabledKeys: ["simulator.wf13", "goals.dv"],
      databaseUrl: DATABASE_URL,
    });
  });

  it("requires a distinct least-privilege direct database credential", () => {
    const base = {
      COMMERCIAL_ENGINE_RUNTIME_MODE: "active",
      COMMERCIAL_ENGINE_ENABLED_KEYS: "simulator.wf13",
    };
    for (const databaseUrl of [
      "",
      "postgresql://postgres:local-test-password@127.0.0.1:54322/postgres?sslmode=verify-full",
      "postgresql://crm_commercial_engine:short@127.0.0.1:54322/postgres?sslmode=verify-full",
      "postgresql://crm_commercial_engine:local-test-password@127.0.0.1:54322/postgres?sslmode=require",
      `${DATABASE_URL}&application_name=override`,
    ]) {
      expect(
        getCommercialEngineRuntimeConfiguration({
          ...base,
          COMMERCIAL_ENGINE_DATABASE_URL: databaseUrl,
        }).available,
      ).toBe(false);
    }
    expect(
      getCommercialEngineRuntimeConfiguration({
        ...base,
        COMMERCIAL_ENGINE_DATABASE_URL: DATABASE_URL,
        QLIK_RELAY_HMAC_SECRET: "local-test-password",
      }).available,
    ).toBe(false);

    const matchingDatabaseUrl = `postgresql://crm_commercial_engine:production-test-password@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=verify-full`;
    expect(
      getCommercialEngineRuntimeConfiguration({
        ...base,
        NODE_ENV: "production",
        SUPABASE_URL,
        COMMERCIAL_ENGINE_DATABASE_URL: matchingDatabaseUrl,
      }).available,
    ).toBe(true);
    expect(
      getCommercialEngineRuntimeConfiguration({
        ...base,
        NODE_ENV: "production",
        SUPABASE_URL: "https://differentproject.supabase.co",
        COMMERCIAL_ENGINE_DATABASE_URL: matchingDatabaseUrl,
      }).available,
    ).toBe(false);
    expect(
      getCommercialEngineRuntimeConfiguration({
        ...base,
        NODE_ENV: "production",
        SUPABASE_URL,
        COMMERCIAL_ENGINE_DATABASE_URL: `postgresql://crm_commercial_engine.${SUPABASE_PROJECT_REF}:production-test-password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`,
      }).available,
    ).toBe(true);
  });

  it("keeps every shipped environment surface fail-closed", async () => {
    const [developmentExample, productionExample, compose, configurator, dataBoundary] =
      await Promise.all([
        readFile(new URL("../.env.example", import.meta.url), "utf8"),
        readFile(new URL("../deploy/production.env.example", import.meta.url), "utf8"),
        readFile(new URL("../compose.yaml", import.meta.url), "utf8"),
        readFile(new URL("../deploy/system/descomplica-configure-env", import.meta.url), "utf8"),
        readFile(new URL("../lib/crm/commercial-engine/data.ts", import.meta.url), "utf8"),
      ]);

    expect(developmentExample).toContain("COMMERCIAL_ENGINE_RUNTIME_MODE=off");
    expect(developmentExample).toContain("COMMERCIAL_ENGINE_ENABLED_KEYS=\n");
    expect(developmentExample).toContain("COMMERCIAL_ENGINE_DATABASE_URL=\n");
    expect(productionExample).toContain("COMMERCIAL_ENGINE_RUNTIME_MODE=off");
    expect(productionExample).toContain("COMMERCIAL_ENGINE_DATABASE_URL=\n");
    expect(compose).toContain(
      "COMMERCIAL_ENGINE_RUNTIME_MODE: ${COMMERCIAL_ENGINE_RUNTIME_MODE:-off}",
    );
    expect(compose).toContain(
      'COMMERCIAL_ENGINE_DATABASE_URL: "${COMMERCIAL_ENGINE_DATABASE_URL:-}"',
    );
    expect(configurator).toContain('values[COMMERCIAL_ENGINE_RUNTIME_MODE]="off"');
    expect(configurator).toContain('values[COMMERCIAL_ENGINE_ENABLED_KEYS]=""');
    expect(configurator).toContain('values[COMMERCIAL_ENGINE_DATABASE_URL]=""');
    expect(configurator).not.toContain("ATIVAR-MOTOR-COMERCIAL");
    expect(dataBoundary).toContain('from "postgres"');
    expect(dataBoundary).toContain("commercial_engine.get_policy");
    expect(dataBoundary).not.toContain("createClient");
    expect(dataBoundary).not.toContain("service_role");
  });
});

describe("commercial decimal and policy runtime", () => {
  it("uses exact decimal strings and explicit signed rounding", () => {
    expect(
      commercialDecimalToString(
        addCommercialDecimals(parseCommercialDecimal("0.1"), parseCommercialDecimal("0.2")),
      ),
    ).toBe("0.3");
    expect(
      commercialDecimalToString(
        divideCommercialDecimals(
          parseCommercialDecimal("1"),
          parseCommercialDecimal("8"),
          2,
          "half_even",
        ),
      ),
    ).toBe("0.12");
    expect(
      commercialDecimalToString(
        roundCommercialDecimal(parseCommercialDecimal("2.5"), 0, "half_even"),
      ),
    ).toBe("2");
    expect(
      commercialDecimalToString(
        roundCommercialDecimal(parseCommercialDecimal("-2.5"), 0, "half_up"),
      ),
    ).toBe("-3");
  });

  it("supports 18-place division and bounded high-scale intermediates", () => {
    expect(
      commercialDecimalToOutputString(
        divideCommercialDecimals(
          parseCommercialDecimal("1"),
          parseCommercialDecimal("7"),
          18,
          "down",
        ),
      ),
    ).toBe("0.142857142857142857");

    const intermediate = multiplyCommercialDecimals(
      parseCommercialDecimal("0.100000000000000001"),
      parseCommercialDecimal("0.100000000000000001"),
    );
    expect(() => commercialDecimalToOutputString(intermediate)).toThrow(/output scale/);
    expect(
      commercialDecimalToOutputString(roundCommercialDecimal(intermediate, 18, "half_even")),
    ).toBe("0.01");

    const oversizedOutput = multiplyCommercialDecimals(
      parseCommercialDecimal("999999999999999999999999999999"),
      parseCommercialDecimal("999999999999999999999999999999"),
    );
    expect(() => commercialDecimalToOutputString(oversizedOutput)).toThrow(/output precision/);
  });

  it("rejects policy execution that exceeds the 30-digit output contract", () => {
    const policy = structuredClone(structuralPolicyFixture());
    policy.definition.outputs[2]!.expression = {
      op: "multiply",
      args: [
        { op: "input", key: "fixture_amount" },
        { op: "input", key: "fixture_amount" },
      ],
    };
    policy.goldenCases[0]!.expected.fixture_echo = "5.499025";
    policy.goldenCases[1]!.expected.fixture_echo = "1.010025";
    const verified = verifyCommercialPolicyDocument(policy);

    expect(() =>
      executeVerifiedCommercialPolicy(verified, {
        ...executionInput(),
        fixture_amount: "999999999999999999999999999999",
      }),
    ).toThrow(CommercialPolicyRuntimeError);
  });

  it.each([
    ["down", "-2.1", "-2", "2"],
    ["up", "-2.1", "-3", "3"],
    ["floor", "-2.1", "-3", "2"],
    ["ceil", "-2.1", "-2", "3"],
    ["half_up", "-2.5", "-3", "3"],
    ["half_even", "-2.5", "-2", "2"],
  ] as const)("rounds signed decimals with %s", (mode, input, expected, quotientExpected) => {
    expect(
      commercialDecimalToOutputString(
        roundCommercialDecimal(parseCommercialDecimal(input), 0, mode),
      ),
    ).toBe(expected);
    expect(
      commercialDecimalToOutputString(
        divideCommercialDecimals(
          parseCommercialDecimal(input),
          parseCommercialDecimal("-1"),
          0,
          mode,
        ),
      ),
    ).toBe(quotientExpected);
  });

  it("verifies all mandatory golden cases before execution", () => {
    const verified = verifyCommercialPolicyDocument(structuralPolicyFixture());
    expect(verified.goldenCaseCount).toBe(2);
    expect(verified.policyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verified.goldenReportHash).toMatch(/^[0-9a-f]{64}$/);
    expect({
      policyHash: verified.policyHash,
      goldenReportHash: verified.goldenReportHash,
    }).toEqual({
      policyHash: "0f9f224014b3c3c782558d9f9a4451134dda81059e0cd1df91c18de6df03e5da",
      goldenReportHash: "0574cf74f2ac963980e2ddb5c4c4a0c9e455c3e0ccbb2864380712b83266c671",
    });
    expect(executeVerifiedCommercialPolicy(verified, executionInput())).toEqual({
      allowed: true,
      fixture_date_next_month: "2024-02-29",
      fixture_echo: "2.34",
      fixture_label_echo: "qa-verified",
    });
  });

  it("pins the shared TypeScript and SQL structural fixture hashes", () => {
    const verified = verifyCommercialPolicyDocument(databaseParityPolicyFixture());
    expect(verified.policyHash).toBe(
      "79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774",
    );
    expect(verified.goldenReportHash).toBe(
      "fcf45056ed2df1bcf392ff842ef30e2818ac297ae3467e44ccde5001043cdf0a",
    );
  });

  it("rejects a failed golden case and any input-contract drift", () => {
    const policy = structuredClone(structuralPolicyFixture());
    policy.goldenCases[0]!.expected.fixture_echo = "999";
    expect(() => verifyCommercialPolicyDocument(policy)).toThrow(/golden case/);

    const verified = verifyCommercialPolicyDocument(structuralPolicyFixture());
    expect(() =>
      executeVerifiedCommercialPolicy(verified, { ...executionInput(), extra: "1" }),
    ).toThrow(CommercialPolicyRuntimeError);
    expect(() =>
      executeVerifiedCommercialPolicy(verified, { ...executionInput(), fixture_amount: 2.345 }),
    ).toThrow(/exact strings/);

    const noncanonical = structuredClone(structuralPolicyFixture());
    noncanonical.goldenCases[0]!.expected.fixture_echo = "2.340";
    expect(() => verifyCommercialPolicyDocument(noncanonical)).toThrow(/canonical decimal/);

    expect(() =>
      executeVerifiedCommercialPolicy(
        {
          document: verified.document,
          policyHash: verified.policyHash,
          goldenReportHash: verified.goldenReportHash,
          goldenCaseCount: verified.goldenCaseCount,
        } as never,
        executionInput(),
      ),
    ).toThrow(CommercialPolicyIntegrityError);
    expect(Object.isFrozen(verified.document.definition.outputs[0]!.expression)).toBe(true);
  });

  it("bounds concatenation, complexity, and date operation contracts", () => {
    const oversized = structuredClone(structuralPolicyFixture());
    oversized.definition.outputs[3]!.expression = {
      op: "concat",
      args: [
        { op: "literal", valueType: "string", value: "a".repeat(600) },
        { op: "literal", valueType: "string", value: "b".repeat(600) },
      ],
    };
    expect(() => verifyCommercialPolicyDocument(oversized)).toThrow(/concat result/);

    let nested: Record<string, unknown> = { op: "input", key: "approved" };
    for (let index = 0; index < 25; index += 1) nested = { op: "not", value: nested };
    const tooDeep = structuredClone(structuralPolicyFixture());
    tooDeep.definition.outputs[0]!.expression = nested as never;
    expect(() => verifyCommercialPolicyDocument(tooDeep)).toThrow(/complexity/);

    expect(
      commercialExpressionSchema.safeParse({
        op: "date_add_days",
        date: { op: "literal", valueType: "date", value: "2026-08-10" },
        amount: { op: "literal", valueType: "decimal", value: "1" },
        overflow: "clamp",
      }).success,
    ).toBe(false);
  });

  it("rejects non-JSON canonical values", () => {
    expect(() => serializeCanonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => serializeCanonicalJson(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => serializeCanonicalJson({ missing: undefined })).toThrow(TypeError);
    expect(() => serializeCanonicalJson(new Array(1))).toThrow(TypeError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => hashCanonicalJson(cyclic)).toThrow(TypeError);
  });

  it("revalidates policy and golden hashes loaded from the database", () => {
    const verified = verifyCommercialPolicyDocument(structuralPolicyFixture());
    const loaded = {
      policyId: "20000000-0000-4000-8000-000000000001",
      engineKey: "simulator.wf13",
      version: 1,
      policyHash: verified.policyHash,
      goldenReportHash: verified.goldenReportHash,
      gateState: "shadow",
      effectiveFrom: "2026-08-10T00:00:00.000Z",
      effectiveUntil: null,
      policy: structuralPolicyFixture(),
    };
    expect(verifyLoadedCommercialEnginePolicy(loaded, "simulator.wf13").policyHash).toBe(
      verified.policyHash,
    );
    expect(() =>
      verifyLoadedCommercialEnginePolicy(
        { ...loaded, policyHash: "f".repeat(64) },
        "simulator.wf13",
      ),
    ).toThrow(/integrity/);
  });

  it("hashes canonical input without leaking it into the identifier", () => {
    const hash = commercialPolicyInputHash({ beta: true, alpha: "1.00" });
    expect(hash).toBe(commercialPolicyInputHash({ alpha: "1.00", beta: true }));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("alpha");
  });
});

describe("commercial engine HTTP boundary", () => {
  it("short-circuits default-off before auth, body, policy, or audit", async () => {
    let bodyTouched = false;
    const disabledRequest = {
      url: ENDPOINT,
      headers: new Headers(),
      get body() {
        bodyTouched = true;
        throw new Error("body must remain unread");
      },
    } as unknown as Request;
    const harness = handlerHarness();
    harness.dependencies.configuration = () => ({ mode: "off", available: false, enabledKeys: [] });

    const response = await handleCommercialEnginePost(
      disabledRequest,
      "simulator.wf13",
      harness.dependencies,
    );

    expect(response.status).toBe(404);
    expect(bodyTouched).toBe(false);
    expect(harness.authorize).not.toHaveBeenCalled();
    expect(harness.loadPolicy).not.toHaveBeenCalled();
    expect(harness.recordExecution).not.toHaveBeenCalled();
  });

  it("reports non-off runtime misconfiguration as unavailable", async () => {
    const harness = handlerHarness();
    harness.dependencies.configuration = () => ({
      mode: "active",
      available: false,
      enabledKeys: [],
    });

    const response = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      harness.dependencies,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "engine_unavailable" });
    expect(harness.authorize).not.toHaveBeenCalled();
    expect(harness.loadPolicy).not.toHaveBeenCalled();
  });

  it("requires the dedicated execution permission before parsing", async () => {
    const harness = handlerHarness();
    harness.authorize.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    });

    const response = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      harness.dependencies,
    );

    expect(response.status).toBe(403);
    expect(harness.authorize).toHaveBeenCalledWith("crm.simulators.execute");
    expect(harness.loadPolicy).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, non-JSON, query, and invalid contracts", async () => {
    const cases = [
      request(executionInput(), {
        headers: { origin: "https://attacker.invalid", "content-type": "application/json" },
      }),
      request(executionInput(), {
        headers: { origin: "https://crm.example.com", "content-type": "text/plain" },
      }),
      new Request(`${ENDPOINT}?force=1`, {
        method: "POST",
        headers: { origin: "https://crm.example.com", "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, input: executionInput() }),
      }),
      new Request(ENDPOINT, {
        method: "POST",
        headers: { origin: "https://crm.example.com", "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 2 }),
      }),
    ];
    for (const invalidRequest of cases) {
      const harness = handlerHarness();
      const response = await handleCommercialEnginePost(
        invalidRequest,
        "simulator.wf13",
        harness.dependencies,
      );
      expect([400, 403, 415]).toContain(response.status);
      expect(harness.loadPolicy).not.toHaveBeenCalled();
    }
  });

  it("bounds a streamed body even without Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200_000));
        controller.enqueue(new Uint8Array(60_001));
        controller.close();
      },
    });
    const streamedRequest = new Request(ENDPOINT, {
      method: "POST",
      headers: { origin: "https://crm.example.com", "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const harness = handlerHarness();
    const response = await handleCommercialEnginePost(
      streamedRequest,
      "simulator.wf13",
      harness.dependencies,
    );
    expect(response.status).toBe(413);
    expect(harness.loadPolicy).not.toHaveBeenCalled();
  });

  it("evaluates shadow without returning commercial output", async () => {
    const harness = handlerHarness("shadow");
    const response = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      harness.dependencies,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ ok: true, status: "shadow_evaluated", requestId: REQUEST_ID });
    expect(body).not.toHaveProperty("output");
    expect(body).not.toHaveProperty("policyHash");
    expect(harness.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_USER_ID,
        databaseUrl: DATABASE_URL,
        engineKey: "simulator.wf13",
        mode: "shadow",
      }),
    );
  });

  it("returns output only in active mode after the immutable audit succeeds", async () => {
    const harness = handlerHarness("active");
    const response = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      harness.dependencies,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.output).toEqual({
      allowed: true,
      fixture_date_next_month: "2024-02-29",
      fixture_echo: "2.34",
      fixture_label_echo: "qa-verified",
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("suppresses output on audit failure or replay conflict", async () => {
    const failed = handlerHarness("active");
    failed.recordExecution.mockRejectedValueOnce(new Error("private database detail"));
    const unavailable = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      failed.dependencies,
    );
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain("private database detail");

    const conflict = handlerHarness("active");
    conflict.recordExecution.mockResolvedValueOnce({ status: "conflict" });
    const rejected = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      conflict.dependencies,
    );
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({ error: "request_conflict" });
  });

  it("fails closed on a policy-attestation integrity error", async () => {
    const harness = handlerHarness("active");
    const verified = verifyCommercialPolicyDocument(structuralPolicyFixture());
    harness.loadPolicy.mockResolvedValueOnce({
      document: verified.document,
      policyHash: verified.policyHash,
      goldenReportHash: verified.goldenReportHash,
      goldenCaseCount: verified.goldenCaseCount,
      policyId: "20000000-0000-4000-8000-000000000001",
      engineKey: "simulator.wf13",
      version: 1,
      gateState: "active",
      effectiveFrom: "2026-08-10T00:00:00.000Z",
      effectiveUntil: null,
    } as never);

    const response = await handleCommercialEnginePost(
      request(),
      "simulator.wf13",
      harness.dependencies,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "engine_unavailable" });
    expect(harness.recordExecution).not.toHaveBeenCalled();
  });

  it("does not expose noninteractive engines through the browser endpoint", async () => {
    const harness = handlerHarness("active");
    harness.dependencies.configuration = () => ({
      mode: "active",
      available: true,
      enabledKeys: ["awards.calculation"],
      databaseUrl: DATABASE_URL,
    });
    const response = await handleCommercialEnginePost(
      request(),
      "awards.calculation",
      harness.dependencies,
    );
    expect(response.status).toBe(404);
    expect(harness.authorize).not.toHaveBeenCalled();
  });
});

describe("commercial policy verifier CLI and telemetry", () => {
  let directory: string;

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true });
  });

  it("creates a verified 0600 manifest without network access", async () => {
    directory = await mkdtemp(join(tmpdir(), "commercial-policy-test-"));
    const policyPath = join(directory, "policy.json");
    const manifestPath = join(directory, "manifest.json");
    await writeFile(policyPath, JSON.stringify(structuralPolicyFixture()), { mode: 0o600 });
    let stdout = "";
    let stderr = "";

    const exitCode = await runCommercialPolicyVerifyCli(
      ["--policy", policyPath, "--manifest-out", manifestPath],
      {
        requestId: () => REQUEST_ID,
        output: {
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          },
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain('"goldenCaseCount": 2');
    expect((await stat(manifestPath)).mode & 0o777).toBe(0o600);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    expect(manifest.requestId).toBe(REQUEST_ID);
    expect(manifest).toHaveProperty("policyHash");
    expect(manifest).toHaveProperty("goldenReportHash");
  });

  it("runs the packaged CLI through the real Node process", async () => {
    const { stdout, stderr } = await execFileAsync("pnpm", ["commercial-policy:verify", "--help"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      timeout: 10_000,
    });

    expect(stderr).toContain("ops/commercial-policies/verify.ts --help");
    expect(stderr).not.toMatch(/(?:error|warning):/i);
    expect(stdout).toContain("Usage: pnpm commercial-policy:verify");
    expect(stdout).toContain("No database or remote service is contacted.");
  });

  it("logs only sanitized engine metadata and a policy fingerprint", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    emitCommercialEngineTelemetry({
      correlationId: "40000000-0000-4000-8000-000000000001",
      requestId: REQUEST_ID,
      engineKey: "simulator.wf13",
      mode: "shadow",
      outcome: "shadow_succeeded",
      httpStatus: 202,
      durationMs: 2.6,
      policyHash: "a".repeat(64),
      replay: false,
    });

    const serialized = String(info.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      event: "crm.commercial_engine",
      correlationId: "40000000-0000-4000-8000-000000000001",
      requestId: REQUEST_ID,
      engineKey: "simulator.wf13",
      mode: "shadow",
      outcome: "shadow_succeeded",
      httpStatus: 202,
      durationMs: 3,
      policyFingerprint: "a".repeat(12),
      replay: false,
    });
    expect(serialized).not.toContain("fixture_amount");
    expect(serialized).not.toContain("fixture_echo");
  });
});
