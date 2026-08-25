import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const imageTag = process.env.IMAGE_TAG?.trim();
const publishableFixture = `sb_publishable_${"A".repeat(32)}`;

async function run(command, arguments_, options = {}) {
  return execFileAsync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

async function renderedImage(composePath, environmentPath) {
  const { stdout } = await run("docker", [
    "compose",
    "--env-file",
    environmentPath,
    "-f",
    composePath,
    "config",
    "--images",
  ]);
  const images = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (images.length !== 1) throw new Error("Compose must resolve exactly one application image.");
  return images[0];
}

async function validateProfile(image, proofComposePath, secretSource, environment) {
  const environmentLines = Object.entries(environment).map(
    ([name, value]) => `      ${name}: ${JSON.stringify(value)}`,
  );
  const proofCompose = [
    "services:",
    "  app:",
    `    image: ${image}`,
    "    network_mode: none",
    "    read_only: true",
    '    group_add: ["0"]',
    '    cap_drop: ["ALL"]',
    '    security_opt: ["no-new-privileges:true"]',
    '    entrypoint: ["node", "/app/validate-runtime-env.mjs"]',
    "    environment:",
    ...environmentLines,
    "    volumes:",
    "      - type: bind",
    `        source: ${JSON.stringify(secretSource)}`,
    "        target: /run/secrets/auth_session_cookie_secret",
    "        read_only: true",
    "        bind:",
    "          create_host_path: false",
    "",
  ].join("\n");
  await writeFile(proofComposePath, proofCompose, { mode: 0o600 });
  const { stdout } = await run("docker", [
    "compose",
    "-f",
    proofComposePath,
    "run",
    "--rm",
    "--no-deps",
    "app",
  ]);
  if (!stdout.includes("Runtime configuration valid; secret values not printed.")) {
    throw new Error("Container runtime validation did not complete.");
  }
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(imageTag ?? "")) {
    throw new Error("IMAGE_TAG must be a full immutable Git SHA.");
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "crm-image-proof-"));
  await chmod(temporaryDirectory, 0o710);
  const productionEnvironment = path.join(temporaryDirectory, "production.env");
  const homologationEnvironment = path.join(temporaryDirectory, "homologation.env");
  const proofCompose = path.join(temporaryDirectory, "runtime-proof.compose.yaml");
  const secretSource = path.join(temporaryDirectory, "auth-session-secret");

  try {
    await writeFile(secretSource, `${randomBytes(48).toString("base64url")}\n`, { mode: 0o640 });
    await chmod(secretSource, 0o640);
    const shared = [
      `IMAGE_TAG=${imageTag}`,
      `SUPABASE_PUBLISHABLE_KEY=${publishableFixture}`,
      `AUTH_SESSION_COOKIE_SECRET_SOURCE=${secretSource}`,
    ];
    await writeFile(
      productionEnvironment,
      [
        ...shared,
        "SUPABASE_URL=https://project.supabase.co",
        "APP_ORIGIN=https://crm.example.test",
        "PUBLIC_SIGNUP_ENABLED=true",
        "SALESFORCE_INGEST_ENABLED=false",
        "SALESFORCE_REFRESH_ENABLED=false",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    await writeFile(
      homologationEnvironment,
      [
        ...shared,
        "SUPABASE_URL=http://kong:8000",
        "APP_ORIGIN=https://homolog.example.test",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    const productionImage = await renderedImage("compose.yaml", productionEnvironment);
    const homologationImage = await renderedImage(
      "deploy/homologation/compose.yaml",
      homologationEnvironment,
    );
    if (productionImage !== homologationImage) {
      throw new Error("Homologation and production do not resolve the same image reference.");
    }

    const { stdout } = await run("docker", [
      "image",
      "inspect",
      "--format",
      '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}',
      productionImage,
    ]);
    const [imageId, revision] = stdout.trim().split(/\s+/u);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId ?? "") || revision !== imageTag) {
      throw new Error("Image ID or OCI revision label does not match the release SHA.");
    }

    const commonRuntime = {
      AUTH_SESSION_COOKIE_SECRET_FILE: "/run/secrets/auth_session_cookie_secret",
      DEPLOYMENT_VERSION: imageTag,
      SUPABASE_PUBLISHABLE_KEY: publishableFixture,
    };
    await validateProfile(productionImage, proofCompose, secretSource, {
      ...commonRuntime,
      APP_ORIGIN: "https://crm.example.test",
      HOMOLOGATION_MODE: "false",
      PUBLIC_SIGNUP_ENABLED: "true",
      SUPABASE_URL: "https://project.supabase.co",
    });
    await validateProfile(homologationImage, proofCompose, secretSource, {
      ...commonRuntime,
      APP_ORIGIN: "https://homolog.example.test",
      HOMOLOGATION_MODE: "true",
      PUBLIC_SIGNUP_ENABLED: "false",
      SUPABASE_URL: "http://kong:8000",
    });

    process.stdout.write(
      `${JSON.stringify({
        environments: ["homologation", "production"],
        image: productionImage,
        imageId,
        runtimeProfilesValidated: 2,
        sameImage: true,
        secretValuesPrinted: false,
      })}\n`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Image proof failed."}\n`);
  process.exitCode = 1;
}
