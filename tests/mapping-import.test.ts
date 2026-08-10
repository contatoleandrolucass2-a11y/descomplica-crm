import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  canonicalizeMappingImportManifest,
  hashMappingImportManifest,
  mappingImportManifestSchema,
  serializeCanonicalMappingImportManifest,
  type MappingImportManifest,
  type MappingImportRpcResult,
} from "@/lib/crm/mappings/import-contract";
import { runMappingImportCli } from "@/ops/mappings/import";

const EXPECTED_MANIFEST_HASH = "509d42b1dce12df202e578b156b4be03dd70edbebdbc698ea10d79dcac32c3fe";
const PLAN_HASH = "c".repeat(64);

function fixtureManifest(): MappingImportManifest {
  return {
    schemaVersion: 1,
    batchRequestId: "10000000-0000-4000-8000-000000000001",
    generatedAt: "2026-08-10T12:00:00.000Z",
    evidenceReference: "ticket:FIXTURE-001",
    mappings: [
      {
        requestId: "30000000-0000-4000-8000-000000000002",
        source: "qlik",
        entityKind: "organization",
        externalId: "fixture-org-b",
        ownerKey: "fixture-stewards",
        targetId: "20000000-0000-4000-8000-000000000002",
        decision: "verify",
        effectiveFrom: "2026-08-01T00:00:00.000Z",
        evidenceReference: "ticket:FIXTURE-002",
        reason: "official_id_confirmed",
      },
      {
        requestId: "30000000-0000-4000-8000-000000000001",
        source: "qlik",
        entityKind: "organization",
        externalId: "fixture-org-a",
        decision: "reject",
        reason: "owner_not_confirmed",
      },
    ],
  };
}

function fixtureJwt(claims: Record<string, string>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "fixture-signature",
  ].join(".");
}

const fixtureEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixtureJwt({ role: "anon" }),
  CRM_MAPPING_IMPORT_ACCESS_TOKEN: fixtureJwt({
    role: "authenticated",
    sub: "40000000-0000-4000-8000-000000000001",
  }),
};

function rpcResult(
  manifest: MappingImportManifest,
  mode: "preview" | "apply",
  manifestHash: string,
): MappingImportRpcResult {
  return {
    ok: true,
    mode,
    ready: true,
    manifestHash,
    planHash: PLAN_HASH,
    mappingCount: manifest.mappings.length,
    conflictCount: 0,
    appliedCount: mode === "apply" ? manifest.mappings.length : 0,
    noop: false,
    items: canonicalizeMappingImportManifest(manifest).mappings.map((mapping) => ({
      requestId: mapping.requestId,
      source: mapping.source,
      entityKind: mapping.entityKind,
      externalId: mapping.externalId,
      disposition:
        mapping.decision === "verify"
          ? ("create_verified" as const)
          : ("record_rejection" as const),
      reasonCode: null,
      sourceIdentityId: null,
      reconciliationItemId: null,
    })),
  };
}

function captureOutput() {
  let stdout = "";
  let stderr = "";

  return {
    output: {
      stdout: (value: string) => {
        stdout += value;
      },
      stderr: (value: string) => {
        stderr += value;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

describe("mapping import contract", () => {
  it("canonicalizes mapping order and produces a stable SHA-256", () => {
    const manifest = fixtureManifest();
    const reversed = { ...manifest, mappings: [...manifest.mappings].reverse() };

    expect(
      canonicalizeMappingImportManifest(manifest).mappings.map((item) => item.externalId),
    ).toEqual(["fixture-org-a", "fixture-org-b"]);
    expect(serializeCanonicalMappingImportManifest(reversed)).toBe(
      serializeCanonicalMappingImportManifest(manifest),
    );
    expect(hashMappingImportManifest(reversed)).toBe(EXPECTED_MANIFEST_HASH);
  });

  it("rejects duplicate request IDs and duplicate source identities", () => {
    const manifest = fixtureManifest();
    const repeatedRequest = {
      ...manifest,
      mappings: [
        manifest.mappings[0],
        { ...manifest.mappings[1], requestId: manifest.mappings[0]!.requestId },
      ],
    };
    const repeatedIdentity = {
      ...manifest,
      mappings: [
        manifest.mappings[0],
        {
          ...manifest.mappings[1],
          source: manifest.mappings[0]!.source,
          entityKind: manifest.mappings[0]!.entityKind,
          externalId: manifest.mappings[0]!.externalId,
        },
      ],
    };

    expect(mappingImportManifestSchema.safeParse(repeatedRequest).success).toBe(false);
    expect(mappingImportManifestSchema.safeParse(repeatedIdentity).success).toBe(false);
    expect(
      mappingImportManifestSchema.safeParse({
        ...manifest,
        mappings: [{ ...manifest.mappings[0], externalId: "unsafe\nidentity" }],
      }).success,
    ).toBe(false);
  });

  it("canonicalizes UUID casing before hashing and detects case-insensitive duplicates", () => {
    const manifest = fixtureManifest();
    const uppercaseRequestId = "A0000000-0000-4000-8000-00000000000A";
    const parsed = mappingImportManifestSchema.parse({
      ...manifest,
      batchRequestId: "B0000000-0000-4000-8000-00000000000B",
      mappings: [{ ...manifest.mappings[0], requestId: uppercaseRequestId }],
    });

    expect(parsed.batchRequestId).toBe("b0000000-0000-4000-8000-00000000000b");
    expect(parsed.mappings[0]?.requestId).toBe(uppercaseRequestId.toLowerCase());

    expect(
      mappingImportManifestSchema.safeParse({
        ...manifest,
        mappings: [
          { ...manifest.mappings[0], requestId: uppercaseRequestId },
          { ...manifest.mappings[1], requestId: uppercaseRequestId.toLowerCase() },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("mapping import CLI", () => {
  let temporaryDirectory: string;
  let manifestPath: string;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mapping-import-test-"));
    manifestPath = join(temporaryDirectory, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(fixtureManifest()), { mode: 0o600 });
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true });
  });

  it("uses preview by default, emits no mapping IDs, and writes detail with mode 0600", async () => {
    const detailPath = join(temporaryDirectory, "preview-detail.json");
    const capture = captureOutput();
    const fetchSpy = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const parameters = JSON.parse(String(init?.body)) as {
        p_manifest_hash: string;
      };
      return new Response(
        JSON.stringify(rpcResult(fixtureManifest(), "preview", parameters.p_manifest_hash)),
        { status: 200 },
      );
    });

    const exitCode = await runMappingImportCli(
      ["--manifest", manifestPath, "--detail", detailPath],
      {
        environment: fixtureEnvironment,
        fetchImplementation: fetchSpy as typeof fetch,
        output: capture.output,
      },
    );

    expect(exitCode).toBe(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [endpoint, request] = fetchSpy.mock.calls[0]!;
    expect(String(endpoint)).toBe(
      "https://project.supabase.co/rest/v1/rpc/preview_crm_source_identity_mapping_import",
    );
    const parameters = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(Object.keys(parameters).sort()).toEqual(["p_manifest_hash", "p_payload"]);
    expect(parameters.p_manifest_hash).toBe(EXPECTED_MANIFEST_HASH);
    expect(capture.stderr()).toBe("");
    expect(capture.stdout()).toContain(EXPECTED_MANIFEST_HASH);
    for (const mapping of fixtureManifest().mappings) {
      expect(capture.stdout()).not.toContain(mapping.requestId);
      expect(capture.stdout()).not.toContain(mapping.externalId);
      if (mapping.decision === "verify") expect(capture.stdout()).not.toContain(mapping.targetId);
    }

    expect((await stat(detailPath)).mode & 0o777).toBe(0o600);
    expect(await readFile(detailPath, "utf8")).toContain("fixture-org-a");
  });

  it("blocks apply unless the feature flag and both reviewed hashes are present", async () => {
    const fetchSpy = vi.fn();

    const disabled = captureOutput();
    expect(
      await runMappingImportCli(["--manifest", manifestPath, "--apply"], {
        environment: fixtureEnvironment,
        fetchImplementation: fetchSpy as typeof fetch,
        output: disabled.output,
      }),
    ).toBe(1);
    expect(disabled.stderr()).toContain("apply is disabled");

    const missingHashes = captureOutput();
    expect(
      await runMappingImportCli(["--manifest", manifestPath, "--apply"], {
        environment: { ...fixtureEnvironment, CRM_MAPPING_IMPORT_APPLY_ENABLED: "true" },
        fetchImplementation: fetchSpy as typeof fetch,
        output: missingHashes.output,
      }),
    ).toBe(1);
    expect(missingHashes.stderr()).toContain("are required lowercase SHA-256 values");

    const wrongConfirmation = captureOutput();
    expect(
      await runMappingImportCli(
        [
          "--manifest",
          manifestPath,
          "--apply",
          "--expected-plan-hash",
          PLAN_HASH,
          "--confirm-sha256",
          "d".repeat(64),
        ],
        {
          environment: { ...fixtureEnvironment, CRM_MAPPING_IMPORT_APPLY_ENABLED: "true" },
          fetchImplementation: fetchSpy as typeof fetch,
          output: wrongConfirmation.output,
        },
      ),
    ).toBe(1);
    expect(wrongConfirmation.stderr()).toContain("does not match the canonical manifest");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to send reviewer credentials to a non-Supabase origin", async () => {
    const capture = captureOutput();
    const fetchSpy = vi.fn();

    expect(
      await runMappingImportCli(["--manifest", manifestPath], {
        environment: {
          ...fixtureEnvironment,
          NEXT_PUBLIC_SUPABASE_URL: "https://credential-collector.example.invalid",
        },
        fetchImplementation: fetchSpy as typeof fetch,
        output: capture.output,
      }),
    ).toBe(1);
    expect(capture.stderr()).toContain("not an allowed origin");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("applies only the exact confirmed manifest and preview plan", async () => {
    const capture = captureOutput();
    const fetchSpy = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const parameters = JSON.parse(String(init?.body)) as {
        p_manifest_hash: string;
        p_expected_plan_hash: string;
      };
      return new Response(
        JSON.stringify(rpcResult(fixtureManifest(), "apply", parameters.p_manifest_hash)),
        { status: 200 },
      );
    });

    const exitCode = await runMappingImportCli(
      [
        "--manifest",
        manifestPath,
        "--apply",
        "--expected-plan-hash",
        PLAN_HASH,
        "--confirm-sha256",
        EXPECTED_MANIFEST_HASH,
      ],
      {
        environment: { ...fixtureEnvironment, CRM_MAPPING_IMPORT_APPLY_ENABLED: "true" },
        fetchImplementation: fetchSpy as typeof fetch,
        output: capture.output,
      },
    );

    expect(exitCode).toBe(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [endpoint, request] = fetchSpy.mock.calls[0]!;
    expect(String(endpoint)).toBe(
      "https://project.supabase.co/rest/v1/rpc/apply_crm_source_identity_mapping_import",
    );
    expect(JSON.parse(String(request?.body))).toMatchObject({
      p_manifest_hash: EXPECTED_MANIFEST_HASH,
      p_expected_plan_hash: PLAN_HASH,
    });
    expect(capture.stderr()).toBe("");
  });
});
