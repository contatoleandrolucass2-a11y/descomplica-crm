import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { readSessionPersistenceSecret } from "@/lib/auth/session-persistence";
import { getSupabaseRuntimeConfiguration } from "@/lib/auth/supabase/runtime";
import { parseOfficialSimulatorRuntime } from "@/scripts/homologation/configure-app-env.mjs";

const repositoryRoot = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("promotable image contract", () => {
  it("keeps environment-specific values out of the Docker build", async () => {
    const [dockerfile, productionCompose, homologationCompose, browserClient] = await Promise.all([
      readFile(path.join(repositoryRoot, "Dockerfile"), "utf8"),
      readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "deploy/homologation/compose.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "lib/auth/supabase/client.ts"), "utf8"),
    ]);

    expect(dockerfile).toContain("ARG DEPLOYMENT_VERSION");
    expect(dockerfile).not.toMatch(
      /ARG (?:NEXT_PUBLIC_SUPABASE|SUPABASE_|APP_ORIGIN|HOMOLOGATION_MODE|PUBLIC_SIGNUP)/u,
    );
    expect(productionCompose).not.toContain("build:");
    expect(homologationCompose).not.toContain("build:");
    expect(productionCompose).toContain(
      "image: descomplica-crm:${IMAGE_TAG:?IMAGE_TAG is required}",
    );
    expect(homologationCompose).toContain(
      "image: descomplica-crm:${IMAGE_TAG:?IMAGE_TAG is required}",
    );
    expect(browserClient).not.toContain("process.env");
    expect(browserClient).toContain("createClient(configuration: SupabaseBrowserConfiguration)");
  });

  it("mounts the session HMAC through a runtime secret in both environments", async () => {
    const [productionCompose, homologationCompose, productionExample, homologationExample] =
      await Promise.all([
        readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
        readFile(path.join(repositoryRoot, "deploy/homologation/compose.yaml"), "utf8"),
        readFile(path.join(repositoryRoot, "deploy/production.env.example"), "utf8"),
        readFile(path.join(repositoryRoot, "deploy/homologation/homologation.env.example"), "utf8"),
      ]);

    for (const compose of [productionCompose, homologationCompose]) {
      expect(compose).toContain(
        "AUTH_SESSION_COOKIE_SECRET_FILE: /run/secrets/auth_session_cookie_secret",
      );
      expect(compose).toContain(
        "source: ${AUTH_SESSION_COOKIE_SECRET_SOURCE:?AUTH_SESSION_COOKIE_SECRET_SOURCE is required}",
      );
      expect(compose).toContain("target: /run/secrets/auth_session_cookie_secret");
      expect(compose).toContain("create_host_path: false");
      expect(compose).toContain('group_add:\n      - "0"');
      expect(compose).not.toMatch(/^\s+AUTH_SESSION_COOKIE_SECRET:/mu);
    }
    expect(productionExample).toContain(
      "AUTH_SESSION_COOKIE_SECRET_SOURCE=/etc/descomplica-crm/secrets/production-auth-session-cookie-secret",
    );
    expect(homologationExample).toContain(
      "AUTH_SESSION_COOKIE_SECRET_SOURCE=/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret",
    );

    const wrapper = await readFile(
      path.join(repositoryRoot, "scripts/release/compose-with-runtime-secret.mjs"),
      "utf8",
    );
    expect(wrapper).toContain("Runtime secret directory must be root-owned with mode 0710.");
    expect(wrapper.match(/environmentMode: 0o600/gu)).toHaveLength(2);
    expect(wrapper.match(/environmentGroup: "root"/gu)).toHaveLength(2);
    expect(wrapper).toContain("path must not be a symlink.");
    expect(wrapper).toContain(
      'validateOwnedFile(configuration.secret, 0o640, 0, "Runtime secret file")',
    );
    expect(wrapper).toContain("secretBytes.fill(0)");
    expect(wrapper).toContain("delete childEnvironment.AUTH_SESSION_COOKIE_SECRET");
    expect(wrapper).toContain('["up", ["-d", "--no-build", "--remove-orphans"]]');
    expect(wrapper).toContain('["config", ["--quiet"]]');
    expect(wrapper).toContain('["down", ["--remove-orphans"]]');
    expect(wrapper).toContain('["ps", []]');
    expect(wrapper).toContain('["stop", []]');
    expect(wrapper).toContain("Runtime Compose arguments are not allowlisted.");
    expect(wrapper).not.toContain("AUTH_SESSION_COOKIE_SECRET: source");
    expect(wrapper).not.toContain("console.log");
  });
});

describe("runtime Supabase configuration", () => {
  it("accepts public Supabase values only when supplied at server runtime", () => {
    expect(
      getSupabaseRuntimeConfiguration({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"A".repeat(32)}`,
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      publishableKey: `sb_publishable_${"A".repeat(32)}`,
    });
  });

  it.each([
    {},
    { SUPABASE_URL: "javascript:alert(1)", SUPABASE_PUBLISHABLE_KEY: "A".repeat(32) },
    {
      SUPABASE_URL: "https://user:secret@project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "A".repeat(32),
    },
    { SUPABASE_URL: "https://project.supabase.co/path", SUPABASE_PUBLISHABLE_KEY: "A".repeat(32) },
    { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "short" },
  ])("rejects incomplete or malformed configuration %#", (environment) => {
    expect(() => getSupabaseRuntimeConfiguration(environment)).toThrow(
      "Supabase runtime configuration is unavailable.",
    );
  });
});

describe("session-persistence secret store", () => {
  it("reads a newline-terminated mounted secret without exposing it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "crm-session-secret-test-"));
    temporaryDirectories.push(directory);
    const secretPath = path.join(directory, "secret");
    const secret = "S".repeat(64);
    await writeFile(secretPath, `${secret}\n`, { mode: 0o600 });

    expect(readSessionPersistenceSecret({ AUTH_SESSION_COOKIE_SECRET_FILE: secretPath })).toBe(
      secret,
    );
  });

  it("fails closed for unreadable, relative or malformed secret files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "crm-session-secret-test-"));
    temporaryDirectories.push(directory);
    const malformed = path.join(directory, "malformed");
    await writeFile(malformed, `${"S".repeat(32)}\nsecond-line`, { mode: 0o600 });

    expect(readSessionPersistenceSecret({ AUTH_SESSION_COOKIE_SECRET_FILE: "relative" })).toBe(
      undefined,
    );
    expect(
      readSessionPersistenceSecret({ AUTH_SESSION_COOKIE_SECRET_FILE: "/missing/secret" }),
    ).toBe(undefined);
    expect(readSessionPersistenceSecret({ AUTH_SESSION_COOKIE_SECRET_FILE: malformed })).toBe(
      undefined,
    );
  });
});

describe("homologation official simulator preservation", () => {
  it("defaults an absent gate to off and preserves a valid active allowlist", () => {
    expect(parseOfficialSimulatorRuntime()).toEqual({ mode: "off", enabledKeys: "" });
    expect(
      parseOfficialSimulatorRuntime(
        [
          "OFFICIAL_SIMULATOR_RUNTIME_MODE=active",
          "OFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13, simulator.wf16",
        ].join("\n"),
      ),
    ).toEqual({ mode: "active", enabledKeys: "simulator.wf13,simulator.wf16" });
  });

  it.each([
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=canary\nOFFICIAL_SIMULATOR_ENABLED_KEYS=",
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=active\nOFFICIAL_SIMULATOR_ENABLED_KEYS=",
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=off\nOFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13",
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=active\nOFFICIAL_SIMULATOR_ENABLED_KEYS=unknown",
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=active\nOFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13,simulator.wf13",
    "OFFICIAL_SIMULATOR_RUNTIME_MODE=active\nOFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13\nOFFICIAL_SIMULATOR_RUNTIME_MODE=active",
  ])("fails closed for an invalid existing gate %#", (contents) => {
    expect(() => parseOfficialSimulatorRuntime(contents)).toThrow();
  });
});
