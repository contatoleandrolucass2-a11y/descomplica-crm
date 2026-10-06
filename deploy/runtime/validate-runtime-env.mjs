import { createPrivateKey } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAXIMUM_SECRET_FILE_BYTES = 4_096;
const REQUIRED_SECRET_PATH = "/run/secrets/auth_session_cookie_secret";

function fail(message) {
  process.stderr.write(`Runtime configuration invalid: ${message}.\n`);
  process.exit(1);
}

function exactBoolean(name, value) {
  if (value !== "true" && value !== "false") fail(`${name} must be true or false`);
  return value === "true";
}

function rootUrl(name, value) {
  try {
    const url = new URL(value ?? "");
    if (
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      fail(`${name} must be an origin without credentials, path, query or fragment`);
    }
    return url;
  } catch {
    fail(`${name} must be a valid URL origin`);
  }
}

function validateSecretFile(filePath) {
  if (filePath !== REQUIRED_SECRET_PATH || !path.isAbsolute(filePath)) {
    fail("AUTH_SESSION_COOKIE_SECRET_FILE must reference the mounted runtime secret");
  }

  try {
    const metadata = statSync(filePath);
    if (!metadata.isFile() || metadata.size < 32 || metadata.size > MAXIMUM_SECRET_FILE_BYTES) {
      fail("AUTH_SESSION_COOKIE_SECRET_FILE has an invalid size or type");
    }
    const secret = readFileSync(filePath, "utf8").replace(/\r?\n$/, "");
    if (Buffer.byteLength(secret, "utf8") < 32 || /[\r\n\0]/u.test(secret)) {
      fail("AUTH_SESSION_COOKIE_SECRET_FILE has invalid content");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Runtime configuration invalid:")) {
      throw error;
    }
    fail("AUTH_SESSION_COOKIE_SECRET_FILE is unreadable");
  }
}

function validateRepasseGoogleCredentials() {
  const email = process.env.REPASSE_GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  if (!/^[a-z0-9._-]+@[a-z0-9-]+[.]iam[.]gserviceaccount[.]com$/u.test(email)) {
    fail("REPASSE_GOOGLE_SERVICE_ACCOUNT_EMAIL is invalid");
  }

  const encodedPrivateKey = process.env.REPASSE_GOOGLE_PRIVATE_KEY_BASE64 ?? "";
  try {
    if (
      encodedPrivateKey.length < 1 ||
      encodedPrivateKey.length > 32_768 ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(encodedPrivateKey)
    ) {
      fail("REPASSE_GOOGLE_PRIVATE_KEY_BASE64 is invalid");
    }
    const privateKey = Buffer.from(encodedPrivateKey, "base64");
    if (
      privateKey.toString("base64").replace(/=+$/u, "") !== encodedPrivateKey.replace(/=+$/u, "")
    ) {
      fail("REPASSE_GOOGLE_PRIVATE_KEY_BASE64 is invalid");
    }
    const key = createPrivateKey(privateKey);
    if (key.type !== "private" || key.asymmetricKeyType !== "rsa") {
      fail("REPASSE_GOOGLE_PRIVATE_KEY_BASE64 is invalid");
    }
    privateKey.fill(0);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Runtime configuration invalid:")) {
      throw error;
    }
    fail("REPASSE_GOOGLE_PRIVATE_KEY_BASE64 is invalid");
  }
}

const homologationMode = exactBoolean("HOMOLOGATION_MODE", process.env.HOMOLOGATION_MODE);
const publicSignupEnabled = exactBoolean(
  "PUBLIC_SIGNUP_ENABLED",
  process.env.PUBLIC_SIGNUP_ENABLED,
);

if (homologationMode && publicSignupEnabled) {
  fail("PUBLIC_SIGNUP_ENABLED must be false in homologation");
}

if (!/^[a-f0-9]{40}$/.test(process.env.DEPLOYMENT_VERSION ?? "")) {
  fail("DEPLOYMENT_VERSION must be a full Git SHA");
}

const applicationOrigin = rootUrl("APP_ORIGIN", process.env.APP_ORIGIN);
if (applicationOrigin.protocol !== "https:") fail("APP_ORIGIN must use HTTPS");

const supabaseUrl = rootUrl("SUPABASE_URL", process.env.SUPABASE_URL);
if (homologationMode) {
  const allowedInternalOrigin =
    supabaseUrl.protocol === "http:" && supabaseUrl.host === "kong:8000";
  if (!allowedInternalOrigin && supabaseUrl.protocol !== "https:") {
    fail("SUPABASE_URL must use HTTPS or the isolated Kong origin in homologation");
  }
} else if (
  supabaseUrl.protocol !== "https:" ||
  !/^[a-z0-9][a-z0-9-]*[.]supabase[.](?:co|com)$/u.test(supabaseUrl.hostname)
) {
  fail("production SUPABASE_URL must be an HTTPS Supabase project origin");
}

if (!homologationMode) validateRepasseGoogleCredentials();

if (!/^[A-Za-z0-9._-]{20,2048}$/.test(process.env.SUPABASE_PUBLISHABLE_KEY ?? "")) {
  fail("SUPABASE_PUBLISHABLE_KEY is invalid");
}

if (process.env.AUTH_SESSION_COOKIE_SECRET) {
  fail("AUTH_SESSION_COOKIE_SECRET must not be injected directly into the container environment");
}
validateSecretFile(process.env.AUTH_SESSION_COOKIE_SECRET_FILE ?? "");

process.stdout.write("Runtime configuration valid; secret values not printed.\n");
