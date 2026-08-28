import { createHash, timingSafeEqual } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { z } from "zod";

import type {
  MappingImportDisposition,
  MappingImportManifest,
  MappingImportRpcResult,
} from "../../lib/crm/mappings/import-contract";

const MAX_MANIFEST_BYTES = 2_000_000;
const RPC_TIMEOUT_MS = 30_000;
const PREVIEW_RPC = "preview_crm_source_identity_mapping_import";
const APPLY_RPC = "apply_crm_source_identity_mapping_import";
const CONTRACT_MODULE_URL = new URL("../../lib/crm/mappings/import-contract.ts", import.meta.url);

const dispositionOrder: readonly MappingImportDisposition[] = [
  "create_verified",
  "promote_pending",
  "record_rejection",
  "reject_pending",
  "close_verified",
  "conflict",
];

type ContractModule = typeof import("../../lib/crm/mappings/import-contract");
type RuntimeEnvironment = {
  SUPABASE_URL?: string | undefined;
  SUPABASE_PUBLISHABLE_KEY?: string | undefined;
  CRM_MAPPING_IMPORT_ACCESS_TOKEN?: string | undefined;
  CRM_MAPPING_IMPORT_APPLY_ENABLED?: string | undefined;
};

type CliOutput = {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

type CliDependencies = {
  environment?: RuntimeEnvironment;
  fetchImplementation?: typeof fetch;
  output?: CliOutput;
};

type JwtClaims = {
  role?: unknown;
  sub?: unknown;
};

class SafeCliError extends Error {}

function cliHelp(): string {
  return `Usage: node ops/mappings/import.ts --manifest <file> [options]

Default mode is a read-only preview.

Options:
  -m, --manifest <file>          Version 1 mapping manifest
      --dry-run                  Explicitly select preview mode
      --apply                    Apply a previously reviewed plan
      --expected-plan-hash <sha> Required with --apply
      --confirm-sha256 <sha>     Required with --apply; must match manifest
      --detail <file>            Write restricted detailed result (mode 0600)
  -h, --help                     Show this help

Credentials are accepted only through environment variables:
  SUPABASE_URL
  SUPABASE_PUBLISHABLE_KEY
  CRM_MAPPING_IMPORT_ACCESS_TOKEN

Apply additionally requires CRM_MAPPING_IMPORT_APPLY_ENABLED=true.
`;
}

function parseCliArguments(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: false,
      strict: true,
      options: {
        manifest: { type: "string", short: "m" },
        "dry-run": { type: "boolean", default: false },
        apply: { type: "boolean", default: false },
        "expected-plan-hash": { type: "string" },
        "confirm-sha256": { type: "string" },
        detail: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch {
    throw new SafeCliError("invalid command-line options; use --help");
  }
}

function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return null;
    return decoded as JwtClaims;
  } catch {
    return null;
  }
}

function validPublishableKey(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/u.test(value) || value.length > 8_192) return false;
  if (value.startsWith("sb_publishable_")) return value.length >= 32;
  return decodeJwtClaims(value)?.role === "anon";
}

function validReviewerToken(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/u.test(value) || value.length > 16_384) return false;
  const claims = decodeJwtClaims(value);
  return (
    claims?.role === "authenticated" && typeof claims.sub === "string" && claims.sub.length > 0
  );
}

function requiredCredentials(environment: RuntimeEnvironment): {
  baseUrl: URL;
  publishableKey: string;
  accessToken: string;
} {
  const rawUrl = environment.SUPABASE_URL?.trim() ?? "";
  const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const accessToken = environment.CRM_MAPPING_IMPORT_ACCESS_TOKEN?.trim() ?? "";

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    throw new SafeCliError("Supabase URL is missing or invalid");
  }

  const localHostname = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
  const hostedSupabaseHostname = /^[a-z0-9][a-z0-9-]*\.supabase\.co$/.test(baseUrl.hostname);
  const transportIsAllowed =
    (hostedSupabaseHostname && baseUrl.protocol === "https:" && !baseUrl.port) ||
    (localHostname && ["http:", "https:"].includes(baseUrl.protocol));
  if (
    !transportIsAllowed ||
    !baseUrl.hostname ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    (baseUrl.pathname !== "/" && baseUrl.pathname !== "")
  ) {
    throw new SafeCliError("Supabase URL is not an allowed origin");
  }
  if (!validPublishableKey(publishableKey)) {
    throw new SafeCliError("Supabase publishable key is missing or invalid");
  }
  if (!validReviewerToken(accessToken) || accessToken === publishableKey) {
    throw new SafeCliError("authenticated reviewer token is missing or invalid");
  }

  return { baseUrl, publishableKey, accessToken };
}

function sha256Equal(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function zodIssueSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`)
    .join(", ");
}

async function loadManifest(
  filePath: string,
  contract: ContractModule,
): Promise<{ manifest: MappingImportManifest; manifestHash: string }> {
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new SafeCliError("manifest could not be read");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new SafeCliError("manifest size is outside the allowed range");
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SafeCliError("manifest is not valid JSON");
  }

  try {
    const manifest = contract.canonicalizeMappingImportManifest(input);
    const canonical = contract.serializeCanonicalMappingImportManifest(manifest);
    return {
      manifest,
      manifestHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SafeCliError(`manifest validation failed: ${zodIssueSummary(error)}`);
    }
    throw new SafeCliError("manifest validation failed");
  }
}

async function callImportRpc(input: {
  apply: boolean;
  manifest: MappingImportManifest;
  manifestHash: string;
  expectedPlanHash?: string;
  credentials: ReturnType<typeof requiredCredentials>;
  fetchImplementation: typeof fetch;
  contract: ContractModule;
}): Promise<MappingImportRpcResult> {
  const rpcName = input.apply ? APPLY_RPC : PREVIEW_RPC;
  const endpoint = new URL(`/rest/v1/rpc/${rpcName}`, input.credentials.baseUrl);
  const parameters: Record<string, unknown> = {
    p_payload: input.manifest,
    p_manifest_hash: input.manifestHash,
  };
  if (input.apply) parameters.p_expected_plan_hash = input.expectedPlanHash;

  let response: Response;
  try {
    response = await input.fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        apikey: input.credentials.publishableKey,
        authorization: `Bearer ${input.credentials.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parameters),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    throw new SafeCliError("mapping import RPC request failed");
  }

  if (!response.ok) {
    throw new SafeCliError(`mapping import RPC failed with HTTP ${response.status}`);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new SafeCliError("mapping import RPC returned invalid JSON");
  }

  const parsed = input.contract.mappingImportRpcResultSchema.safeParse(responseBody);
  if (!parsed.success) {
    throw new SafeCliError(`mapping import RPC contract failed: ${zodIssueSummary(parsed.error)}`);
  }

  const result = parsed.data;
  const expectedMode = input.apply ? "apply" : "preview";
  if (result.mode !== expectedMode || !sha256Equal(result.manifestHash, input.manifestHash)) {
    throw new SafeCliError("mapping import RPC returned mismatched execution evidence");
  }
  const manifestItems = new Set(
    input.manifest.mappings.map((mapping) =>
      JSON.stringify([mapping.requestId, mapping.source, mapping.entityKind, mapping.externalId]),
    ),
  );
  const plannedItems = new Set(
    result.items.map((item) =>
      JSON.stringify([item.requestId, item.source, item.entityKind, item.externalId]),
    ),
  );
  if (
    result.mappingCount !== input.manifest.mappings.length ||
    manifestItems.size !== plannedItems.size ||
    [...manifestItems].some((item) => !plannedItems.has(item))
  ) {
    throw new SafeCliError("mapping import RPC returned a plan for a different manifest");
  }
  if (
    input.apply &&
    (!input.expectedPlanHash || !sha256Equal(result.planHash, input.expectedPlanHash))
  ) {
    throw new SafeCliError("mapping import RPC returned an unexpected plan hash");
  }

  return result;
}

function publicSummary(result: MappingImportRpcResult): Record<string, unknown> {
  const dispositionCounts = Object.fromEntries(
    dispositionOrder.map((disposition) => [
      disposition,
      result.items.filter((item) => item.disposition === disposition).length,
    ]),
  );

  return {
    mode: result.mode,
    ok: result.ok,
    ready: result.ready,
    manifestSha256: result.manifestHash,
    planSha256: result.planHash,
    mappingCount: result.mappingCount,
    conflictCount: result.conflictCount,
    appliedCount: result.appliedCount,
    noop: result.noop,
    dispositionCounts,
  };
}

async function writeRestrictedDetail(
  filePath: string,
  result: MappingImportRpcResult,
): Promise<void> {
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8" });
  } catch {
    throw new SafeCliError("restricted detail file could not be created");
  } finally {
    await handle?.close();
  }
}

export async function runMappingImportCli(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  const output = dependencies.output ?? {
    stdout: (value: string) => void process.stdout.write(value),
    stderr: (value: string) => void process.stderr.write(value),
  };

  try {
    const options = parseCliArguments(argv);
    if (options.help) {
      output.stdout(cliHelp());
      return 0;
    }
    if (!options.manifest) throw new SafeCliError("--manifest is required");
    if (options.apply && options["dry-run"]) {
      throw new SafeCliError("--apply and --dry-run are mutually exclusive");
    }
    if (!options.apply && (options["expected-plan-hash"] || options["confirm-sha256"])) {
      throw new SafeCliError("plan and confirmation hashes are accepted only with --apply");
    }

    const contract = (await import(CONTRACT_MODULE_URL.href)) as ContractModule;
    const { manifest, manifestHash } = await loadManifest(options.manifest, contract);
    const environment: RuntimeEnvironment = dependencies.environment ?? {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      CRM_MAPPING_IMPORT_ACCESS_TOKEN: process.env.CRM_MAPPING_IMPORT_ACCESS_TOKEN,
      CRM_MAPPING_IMPORT_APPLY_ENABLED: process.env.CRM_MAPPING_IMPORT_APPLY_ENABLED,
    };

    let expectedPlanHash: string | undefined;
    if (options.apply) {
      if (environment.CRM_MAPPING_IMPORT_APPLY_ENABLED?.trim() !== "true") {
        throw new SafeCliError("mapping import apply is disabled");
      }
      const expectedHashResult = contract.sha256Schema.safeParse(options["expected-plan-hash"]);
      const confirmationResult = contract.sha256Schema.safeParse(options["confirm-sha256"]);
      if (!expectedHashResult.success || !confirmationResult.success) {
        throw new SafeCliError(
          "--expected-plan-hash and --confirm-sha256 are required lowercase SHA-256 values",
        );
      }
      if (!sha256Equal(confirmationResult.data, manifestHash)) {
        throw new SafeCliError("--confirm-sha256 does not match the canonical manifest");
      }
      expectedPlanHash = expectedHashResult.data;
    }

    const result = await callImportRpc({
      apply: options.apply,
      manifest,
      manifestHash,
      ...(expectedPlanHash ? { expectedPlanHash } : {}),
      credentials: requiredCredentials(environment),
      fetchImplementation: dependencies.fetchImplementation ?? fetch,
      contract,
    });

    if (options.detail) await writeRestrictedDetail(options.detail, result);
    output.stdout(`${JSON.stringify(publicSummary(result), null, 2)}\n`);
    return result.ok && result.ready ? 0 : 2;
  } catch (error) {
    const message = error instanceof SafeCliError ? error.message : "mapping import failed";
    output.stderr(`Error: ${message}\n`);
    return 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  process.exitCode = await runMappingImportCli();
}
