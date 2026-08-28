import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "../lib/security/headers";
import nextConfig from "../next.config";

describe("security headers regression", () => {
  it("keeps the production CSP and transport protections", () => {
    const headers = new Headers();

    applySecurityHeaders(headers, { isProd: true });

    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("payment=()");
  });

  it("keeps local development usable without weakening cache ownership", () => {
    const headers = new Headers({ "Cache-Control": "private, no-store" });

    applySecurityHeaders(headers, { isProd: false });

    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("adds a crawler deny header only for isolated homologation", () => {
    const homologationHeaders = new Headers();
    const regularHeaders = new Headers();

    applySecurityHeaders(homologationHeaders, { isProd: true, noIndex: true });
    applySecurityHeaders(regularHeaders, { isProd: true });

    expect(homologationHeaders.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(regularHeaders.has("X-Robots-Tag")).toBe(false);
  });

  it("suppresses the referrer for recovery callback responses", () => {
    const headers = new Headers({ "Referrer-Policy": "strict-origin-when-cross-origin" });

    applySecurityHeaders(headers, { isProd: true, suppressReferrer: true });

    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("keeps recovery callback query strings out of Nginx access and error logs", async () => {
    const templates = [
      ["deploy/nginx/crm.descomplicapro.com.br.http.conf", 1],
      ["deploy/nginx/crm.descomplicapro.com.br.https.conf.example", 2],
      ["deploy/nginx/homolog.descomplicapro.com.br.http.conf", 1],
      ["deploy/nginx/homolog.descomplicapro.com.br.https.conf.example", 2],
    ] as const;

    for (const [filename, callbackLocations] of templates) {
      const source = await readFile(path.join(process.cwd(), filename), "utf8");
      expect(source.match(/location = \/auth\/callback/g)).toHaveLength(callbackLocations);
      expect(source.match(/access_log off;/g)).toHaveLength(callbackLocations);
      expect(source.match(/error_log \/dev\/null crit;/g)).toHaveLength(callbackLocations);
    }
  });

  it("supports no-log token-hash and hosted PKCE recovery callbacks", async () => {
    const [
      callback,
      template,
      localConfig,
      homologationConfig,
      qaLauncher,
      hostedQaLauncher,
      releaseCandidate,
    ] = await Promise.all([
      readFile(path.join(process.cwd(), "app/auth/callback/route.ts"), "utf8"),
      readFile(path.join(process.cwd(), "supabase/templates/recovery.html"), "utf8"),
      readFile(path.join(process.cwd(), "supabase/config.toml"), "utf8"),
      readFile(path.join(process.cwd(), "deploy/homologation/supabase.config.toml"), "utf8"),
      readFile(path.join(process.cwd(), "scripts/qa/local-rls-api.mjs"), "utf8"),
      readFile(path.join(process.cwd(), "scripts/homologation/run-remote-qa.mjs"), "utf8"),
      readFile(path.join(process.cwd(), "e2e/release-candidate.spec.ts"), "utf8"),
    ]);

    expect(callback).toContain("supabase.auth.verifyOtp({");
    expect(callback).toContain('type: "recovery"');
    expect(callback).toContain("isRecoveryTokenHash(tokenHash)");
    expect(callback).toContain("isSupabasePkceAuthCode(code)");
    expect(callback).toContain("exchangeCodeForSession(code)");
    expect(callback).toContain("isRecoveryRedirect(data)");
    expect(template).toContain("{{ .RedirectTo }}?token_hash={{ .TokenHash }}");
    expect(template).not.toContain("{{ .ConfirmationURL }}");
    expect(template).not.toContain("/auth/v1/verify");
    expect(localConfig).toContain('content_path = "./supabase/templates/recovery.html"');
    expect(homologationConfig).toContain('content_path = "./supabase/templates/recovery.html"');
    expect(homologationConfig).toMatch(/\[local_smtp\]\s+enabled = true\s+port = 55324/u);
    expect(homologationConfig).toContain('site_url = "https://homolog.descomplicapro.com.br"');
    expect(homologationConfig).toContain(
      'additional_redirect_urls = ["https://homolog.descomplicapro.com.br/auth/callback"]',
    );
    expect(qaLauncher).toContain('PLAYWRIGHT_NO_COPY_PROMPT: "1"');
    expect(qaLauncher).toContain(
      "await rm(playwrightOutputRoot, { recursive: true, force: true })",
    );
    expect(hostedQaLauncher).toContain('const mailpitOrigin = "http://127.0.0.1:55324"');
    expect(hostedQaLauncher).toContain("verifyProxyPrivacyContract()");
    expect(hostedQaLauncher).toContain("callbackBlocks.length !== 2");
    expect(hostedQaLauncher).toContain("verifyRepositoryState()");
    expect(hostedQaLauncher).toContain("verifyHomologationNetworkIsolation()");
    expect(hostedQaLauncher).toContain('const dockerSocketPath = "/var/run/docker.sock"');
    expect(hostedQaLauncher).toContain('const dockerCommand = "/usr/bin/docker"');
    expect(hostedQaLauncher).toContain("await verifyLocalDockerSocket()");
    expect(hostedQaLauncher).toContain("metadata.isSocket()");
    expect(hostedQaLauncher).toContain('["--host", dockerSocketUri, ...arguments_]');
    expect(hostedQaLauncher).not.toContain('"DOCKER_HOST"');
    expect(hostedQaLauncher).not.toContain('"DOCKER_CONTEXT"');
    expect(hostedQaLauncher).not.toContain('"HOME"');
    expect(hostedQaLauncher).toContain("verifyHostedHealth(head, access)");
    expect(hostedQaLauncher).toContain('"{{json .Mounts}}"');
    expect(hostedQaLauncher).toContain('environment.has("AUTH_SESSION_COOKIE_SECRET")');
    expect(hostedQaLauncher).toContain("assertHostedAccessLogSafety(callbackLogSnapshot)");
    expect(hostedQaLauncher).toContain("assertHostedApplicationLogSafety(applicationLogSince)");
    expect(hostedQaLauncher).toContain("delete from auth.sessions where user_id =");
    expect(hostedQaLauncher).toContain(
      'const errorLogPath = "/var/log/nginx/homolog.descomplicapro.com.br.error.log"',
    );
    expect(hostedQaLauncher).toContain("containsSensitiveCallbackMaterial(errorLogTail)");
    expect(hostedQaLauncher).toContain("runtimeRecoveryTemplate !== versionedRecoveryTemplate");
    expect(hostedQaLauncher).toContain(
      '["homologation:migrate:legacy-canary", "verify", "--expected-sha", expectedHead]',
    );
    expect(hostedQaLauncher).toContain("verifyAuthMfaAndLegacyCanaryMigrationContracts(head)");
    expect(hostedQaLauncher.match(/QA_E2E_MAILPIT_ORIGIN: mailpitOrigin/g)).toHaveLength(1);
    expect(hostedQaLauncher).toContain("async function createEphemeralAccount(");
    expect(hostedQaLauncher).toContain("email_confirm: true");
    expect(hostedQaLauncher).toContain("termsVersion: legalDocumentVersions.terms");
    expect(hostedQaLauncher).toContain("privacyVersion: legalDocumentVersions.privacy");
    expect(hostedQaLauncher).toContain("clearEphemeralPasswords(ephemeralAccounts)");
    expect(hostedQaLauncher).toContain("auth.admin.deleteUser(assertUuid(account.id), false)");
    expect(hostedQaLauncher).toContain("or exists (select 1 from auth.mfa_factors");
    expect(hostedQaLauncher).toContain("or exists (select 1 from auth.sessions");
    expect(hostedQaLauncher).toContain("or exists (select 1 from private.legal_acceptances");
    expect(releaseCandidate).toContain("expect(cookie?.secure).toBe(targetUsesHttps)");
    expect(releaseCandidate).toContain(
      'mask: [page.locator("[data-session-identity], [data-account-identity]")]',
    );

    const restoration = hostedQaLauncher.slice(
      hostedQaLauncher.indexOf("async function restorePersistentVisualIdentity("),
      hostedQaLauncher.indexOf("function mailMatchesRecipient("),
    );
    expect(restoration).not.toContain("auth.admin.updateUserById");
    expect(restoration.indexOf("auth.admin.mfa.deleteFactor")).toBeGreaterThan(-1);
    expect(restoration.indexOf("revokeQaSessions(localModule, database, [user])")).toBeGreaterThan(
      restoration.indexOf("auth.admin.mfa.deleteFactor"),
    );

    const cleanup = hostedQaLauncher.slice(
      hostedQaLauncher.indexOf("async function cleanupPersistentVisualState("),
      hostedQaLauncher.indexOf("async function snapshotHostedLog("),
    );
    expect(cleanup.indexOf("restorePersistentVisualIdentity(")).toBeGreaterThan(-1);
    expect(cleanup.indexOf("verifyQaCredential(")).toBeGreaterThan(
      cleanup.indexOf("restorePersistentVisualIdentity("),
    );
    expect(cleanup.indexOf("revokeQaSessions(")).toBeGreaterThan(
      cleanup.indexOf("verifyQaCredential("),
    );
    expect(cleanup.indexOf("purgeQaMail([master.email])")).toBeGreaterThan(
      cleanup.indexOf("revokeQaSessions("),
    );

    const ephemeralCleanup = hostedQaLauncher.slice(
      hostedQaLauncher.indexOf("async function removeEphemeralQaState("),
      hostedQaLauncher.indexOf("async function snapshotHostedLog("),
    );
    expect(ephemeralCleanup.indexOf("auth.admin.mfa.deleteFactor")).toBeGreaterThan(-1);
    expect(ephemeralCleanup.indexOf("revokeQaSessions(")).toBeGreaterThan(
      ephemeralCleanup.indexOf("auth.admin.mfa.deleteFactor"),
    );
    expect(ephemeralCleanup.indexOf("ephemeralDatabaseCleanupSql(")).toBeGreaterThan(
      ephemeralCleanup.indexOf("revokeQaSessions("),
    );
    expect(ephemeralCleanup.indexOf("auth.admin.deleteUser")).toBeGreaterThan(
      ephemeralCleanup.indexOf("restorePersistentMasterSql("),
    );
    expect(ephemeralCleanup.indexOf("proveEphemeralAbsenceSql(")).toBeGreaterThan(
      ephemeralCleanup.indexOf("auth.admin.deleteUser"),
    );
  });

  it("disables sensitive Server Function arguments and callback URLs in Next dev logs", () => {
    const logging = nextConfig.logging;
    expect(logging).toBeTruthy();
    expect(logging).not.toBe(false);
    if (!logging) throw new Error("Next logging protections are missing.");

    expect(logging.serverFunctions).toBe(false);
    expect(logging.incomingRequests).not.toBe(false);
    expect(logging.incomingRequests).toBeTruthy();
    if (!logging.incomingRequests || logging.incomingRequests === true) {
      throw new Error("Incoming request filtering is missing.");
    }

    expect(
      logging.incomingRequests.ignore?.some((pattern: RegExp) =>
        pattern.test(`/auth/callback?token_hash=${"a".repeat(56)}&type=recovery`),
      ),
    ).toBe(true);
    expect(
      logging.incomingRequests.ignore?.some((pattern: RegExp) =>
        pattern.test("/auth/callback-unsafe"),
      ),
    ).toBe(false);
  });
});
