import { randomUUID } from "node:crypto";
import { link, open, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  commercialPolicyImportManifestSchema,
  type CommercialPolicyImportManifest,
} from "../../lib/crm/commercial-engine/contract.ts";
import {
  commercialPolicyDefinitionNodeCount,
  verifyCommercialPolicyDocument,
} from "../../lib/crm/commercial-engine/runtime.ts";

const MAX_POLICY_BYTES = 2_000_000;

type CliOutput = {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

type CliDependencies = {
  output?: CliOutput;
  requestId?: () => string;
};

class SafeCliError extends Error {}

function help(): string {
  return `Usage: pnpm commercial-policy:verify --policy <file> [options]

Validates one policy document and executes every mandatory golden case locally.
No database or remote service is contacted.

Options:
  -p, --policy <file>        Policy document JSON
      --manifest-out <file>  Create verified import manifest with mode 0600
  -h, --help                 Show this help
`;
}

function parseCliArguments(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: false,
      strict: true,
      options: {
        policy: { type: "string", short: "p" },
        "manifest-out": { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch {
    throw new SafeCliError("invalid command-line options; use --help");
  }
}

async function readPolicy(filePath: string): Promise<unknown> {
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new SafeCliError("policy document could not be read");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_POLICY_BYTES) {
    throw new SafeCliError("policy document size is outside the allowed range");
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SafeCliError("policy document is not valid JSON");
  }
}

async function writeManifest(
  filePath: string,
  manifest: CommercialPolicyImportManifest,
): Promise<void> {
  const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, filePath);
  } catch {
    throw new SafeCliError("verified manifest could not be created");
  } finally {
    await handle?.close();
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function runCommercialPolicyVerifyCli(
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
      output.stdout(help());
      return 0;
    }
    if (!options.policy) throw new SafeCliError("--policy is required");

    const verified = verifyCommercialPolicyDocument(await readPolicy(options.policy));
    const manifest = commercialPolicyImportManifestSchema.parse({
      schemaVersion: 1,
      requestId: (dependencies.requestId ?? randomUUID)(),
      policy: verified.document,
      policyHash: verified.policyHash,
      goldenReportHash: verified.goldenReportHash,
    });
    if (options["manifest-out"]) await writeManifest(options["manifest-out"], manifest);

    output.stdout(
      `${JSON.stringify(
        {
          ok: true,
          engineKey: verified.document.engineKey,
          version: verified.document.version,
          policyHash: verified.policyHash,
          goldenReportHash: verified.goldenReportHash,
          goldenCaseCount: verified.goldenCaseCount,
          expressionNodeCount: commercialPolicyDefinitionNodeCount(verified.document.definition),
          manifestCreated: Boolean(options["manifest-out"]),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof SafeCliError ? error.message : "commercial policy failed";
    output.stderr(`Error: ${message}\n`);
    return 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  process.exitCode = await runCommercialPolicyVerifyCli();
}
