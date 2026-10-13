import { readFileSync, type Stats } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error Operational ESM entrypoint has no TypeScript declaration.
import { prepare, resolveImage, IMAGES, PROJECT, DESTINATION } from "../ops/n8n/prepare.mjs";

// Reuse ESLint's existing YAML parser without adding a dependency.
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve("eslint/package.json"))("js-yaml");
const source = readFileSync(new URL("../ops/n8n/compose.yaml", import.meta.url), "utf8");
const compose = load(source);
const hash = "a".repeat(64);
const id = `sha256:${"b".repeat(64)}`;

function fixture() {
  const files = new Map<string, string>();
  let created = false;
  const io = {
    lstatSync: vi.fn(
      (path: string): Partial<Pick<Stats, "uid" | "mode" | "isDirectory" | "isSymbolicLink">> => {
        if (path === "/srv")
          return { uid: 0, mode: 0o40755, isDirectory: () => true, isSymbolicLink: () => false };
        if (path === DESTINATION && created) return {};
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
    ),
    readFileSync: vi.fn(() => source),
    mkdirSync: vi.fn(() => {
      if (created) throw new Error("EEXIST");
      created = true;
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      files.set(path, content);
    }),
  };
  const run = vi.fn((program: string, args: string[]) => {
    if (program === "ss") return "";
    expect(program).toBe("docker");
    expect(args.slice(0, 2)).toEqual(["--host", "unix:///var/run/docker.sock"]);
    const command = args.slice(2);
    if (command[0] === "image") {
      const image = command[2]!;
      if (image.includes("@")) return JSON.stringify([{ Id: id }]);
      return JSON.stringify([
        {
          Id: id,
          RepoTags: [image],
          RepoDigests: [`${image.slice(0, image.lastIndexOf(":"))}@sha256:${hash}`],
        },
      ]);
    }
    return "";
  });
  return {
    files,
    io,
    run,
    options: { platform: "linux", uid: 0, nodeVersion: "24.19.0", io, run },
  };
}

describe("isolated n8n bootstrap", () => {
  it("prepares only private files, new independent secrets and locally verified digests", () => {
    const f = fixture();
    expect(prepare(f.options)).toEqual({
      directory: DESTINATION,
      project: PROJECT,
      started: false,
    });
    expect(f.io.mkdirSync).toHaveBeenCalledWith(DESTINATION, { mode: 0o700 });
    expect(f.io.writeFileSync).toHaveBeenCalledTimes(2);
    for (const call of f.io.writeFileSync.mock.calls)
      expect(call[0]).toMatch(/^\/srv\/descomplica-n8n\//);
    expect(f.io.writeFileSync).toHaveBeenCalledWith(`${DESTINATION}/.env`, expect.any(String), {
      mode: 0o600,
      flag: "wx",
    });
    expect(f.files.get(`${DESTINATION}/compose.yaml`)).toBe(source);
    const env = f.files.get(`${DESTINATION}/.env`)!;
    for (const key of Object.keys(IMAGES))
      expect(env).toMatch(new RegExp(`${key}=.+@sha256:${hash}`));
    const secrets = env
      .split("\n")
      .filter((line) =>
        /^(POSTGRES_PASSWORD|N8N_ENCRYPTION_KEY|N8N_RUNNERS_AUTH_TOKEN)=/.test(line),
      );
    expect(secrets).toHaveLength(3);
    expect(new Set(secrets.map((line) => line.split("=")[1])).size).toBe(3);
    secrets.forEach((line) => expect(line).toMatch(/=[a-f0-9]{64}$/));
    for (const [program, args] of f.run.mock.calls) {
      expect(
        program === "ss" || (program === "docker" && ["ls", "inspect"].includes(args[3]!)),
      ).toBe(true);
    }
    expect(() => prepare(f.options)).toThrow(/already exists/);
    expect(f.io.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it.each([
    { platform: "win32" },
    { uid: 1000 },
    { nodeVersion: "25.0.0" },
    { nodeVersion: "24.18.0" },
  ])("rejects unsupported execution %j before inspections", (override) => {
    const f = fixture();
    expect(() => prepare({ ...f.options, ...override })).toThrow();
    expect(f.run).not.toHaveBeenCalled();
    expect(f.io.mkdirSync).not.toHaveBeenCalled();
  });

  it.each([DESTINATION, "/.git", "/srv/.git"])(
    "refuses existing paths, including dangling symlinks: %s",
    (blocked) => {
      const f = fixture();
      const original = f.io.lstatSync.getMockImplementation()!;
      f.io.lstatSync.mockImplementation((path) => (path === blocked ? {} : original(path)));
      expect(() => prepare(f.options)).toThrow();
      expect(f.io.mkdirSync).not.toHaveBeenCalled();
    },
  );

  it.each([
    { uid: 1000 },
    { mode: 0o40777 },
    { isSymbolicLink: () => true },
    { isDirectory: () => false },
  ])("refuses unsafe parent %j", (override) => {
    const f = fixture();
    const original = f.io.lstatSync.getMockImplementation()!;
    f.io.lstatSync.mockImplementation((path) =>
      path === "/srv" ? { ...original(path), ...override } : original(path),
    );
    expect(() => prepare(f.options)).toThrow(/root-owned/);
    expect(f.io.mkdirSync).not.toHaveBeenCalled();
  });

  it.each(["container", "volume", "network"])("refuses %s by project name or label", (kind) => {
    for (const label of [false, true]) {
      const f = fixture();
      const original = f.run.getMockImplementation()!;
      f.run.mockImplementation((program, args) =>
        args[2] === kind && args.includes(label ? "--filter" : "--format")
          ? label
            ? "resource-id"
            : `${PROJECT}-existing`
          : original(program, args),
      );
      expect(() => prepare(f.options)).toThrow(/already exists/);
      expect(f.io.mkdirSync).not.toHaveBeenCalled();
    }
  });

  it("fails closed on unavailable tools and occupied IPv4/IPv6 port", () => {
    for (const unavailable of ["docker", "ss", "occupied"]) {
      const f = fixture();
      const original = f.run.getMockImplementation()!;
      f.run.mockImplementation((program, args) => {
        if (program === unavailable) throw new Error("unavailable");
        if (program === "ss" && unavailable === "occupied") return "LISTEN 0 128 [::]:5678 [::]:*";
        return original(program, args);
      });
      expect(() => prepare(f.options)).toThrow();
      expect(f.io.mkdirSync).not.toHaveBeenCalled();
    }
  });

  it.each(["reserved", "incomplete", "invalid"])(
    "refuses Docker port inventory: %s",
    (scenario) => {
      const f = fixture();
      const original = f.run.getMockImplementation()!;
      f.run.mockImplementation((program, args) => {
        if (args[2] === "container" && args.includes("json"))
          return JSON.stringify({ ID: scenario === "invalid" ? "--option" : "abc123" });
        if (args[2] === "container" && args[3] === "inspect") {
          expect(args.slice(4, 6)).toEqual(["--format", "{{json .HostConfig.PortBindings}}"]);
          return scenario === "incomplete"
            ? ""
            : JSON.stringify({ "80/tcp": [{ HostPort: "5678" }] });
        }
        return original(program, args);
      });
      expect(() => prepare(f.options)).toThrow();
      expect(f.io.mkdirSync).not.toHaveBeenCalled();
    },
  );

  it("leaves partial preparation blocked and never overwrites", () => {
    const f = fixture();
    f.io.writeFileSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    expect(() => prepare(f.options)).toThrow(/disk full/);
    expect(() => prepare(f.options)).toThrow(/already exists/);
    expect(f.io.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it("refuses a concurrent mkdir winner without writing secrets", () => {
    const f = fixture();
    f.io.mkdirSync.mockImplementation(() => {
      throw new Error("EEXIST");
    });
    expect(() => prepare(f.options)).toThrow("EEXIST");
    expect(f.io.writeFileSync).not.toHaveBeenCalled();
  });

  it("does not treat inaccessible filesystem paths as absent", () => {
    const f = fixture();
    f.io.lstatSync.mockImplementation(() => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    });
    expect(() => prepare(f.options)).toThrow("denied");
    expect(f.run).not.toHaveBeenCalled();
    expect(f.io.mkdirSync).not.toHaveBeenCalled();
  });

  it("allows unrelated containers and inspects only port bindings", () => {
    const f = fixture();
    const original = f.run.getMockImplementation()!;
    f.run.mockImplementation((program, args) => {
      if (args[2] === "container" && args.includes("json"))
        return '{"ID":"abc123"}\n{"ID":"def456"}';
      if (args[2] === "container" && args[3] === "inspect") {
        expect(args.slice(4)).toEqual([
          "--format",
          "{{json .HostConfig.PortBindings}}",
          "abc123",
          "def456",
        ]);
        return 'null\n{"443/tcp":[{"HostPort":"443"}]}';
      }
      return original(program, args);
    });
    expect(prepare(f.options).started).toBe(false);
  });

  it("accepts Docker Hub's normalized postgres tag and digest", () => {
    const docker = (args: string[]) =>
      JSON.stringify([
        args[2]!.includes("@")
          ? { Id: id }
          : {
              Id: id,
              RepoTags: ["postgres:17"],
              RepoDigests: [`postgres@sha256:${hash}`],
            },
      ]);
    expect(resolveImage(IMAGES.POSTGRES_IMAGE, docker)).toBe(
      `docker.io/library/postgres@sha256:${hash}`,
    );
  });

  it("does not create files when an image inspection fails", () => {
    const f = fixture();
    const original = f.run.getMockImplementation()!;
    f.run.mockImplementation((program, args) => {
      if (args[2] === "image") throw new Error("image unavailable");
      return original(program, args);
    });
    expect(() => prepare(f.options)).toThrow("image unavailable");
    expect(f.io.mkdirSync).not.toHaveBeenCalled();
  });

  it.each(["missing", "foreign", "ambiguous", "mismatch", "tag", "malformed"])(
    "rejects invalid image evidence: %s",
    (scenario) => {
      const image = IMAGES.N8N_IMAGE;
      const repo = "n8nio/n8n";
      const record = {
        Id: id,
        RepoTags: scenario === "tag" ? [] : [image],
        RepoDigests: [`${repo}@sha256:${hash}`],
      };
      if (scenario === "missing") record.RepoDigests = [];
      if (scenario === "foreign") record.RepoDigests = [`evil/n8n@sha256:${hash}`];
      if (scenario === "ambiguous") record.RepoDigests.push(`${repo}@sha256:${"c".repeat(64)}`);
      if (scenario === "malformed") record.RepoDigests = [`${repo}@sha256:invalid`];
      const docker = (args: string[]) =>
        JSON.stringify([
          args[2]!.includes("@") ? { Id: scenario === "mismatch" ? "wrong" : id } : record,
        ]);
      expect(() => resolveImage(image, docker)).toThrow();
    },
  );
});

describe("isolated Compose security contract", () => {
  it.each(["ready", "unready", "unreachable"])(
    "readiness exits appropriately when %s",
    async (state) => {
      const exit = vi.fn();
      const fetch = vi.fn(() =>
        state === "unreachable"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({ ok: state === "ready" }),
      );
      await runInNewContext(compose.services.n8n.healthcheck.test[3], {
        fetch,
        process: { exit },
        AbortSignal,
      });
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:5678/healthz/readiness",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(exit).toHaveBeenCalledWith(state === "ready" ? 0 : 1);
    },
  );

  it("pins the intended official source tags and requires bootstrap digests", () => {
    expect(IMAGES).toEqual({
      N8N_IMAGE: "n8nio/n8n:2.42.7",
      POSTGRES_IMAGE: "docker.io/library/postgres:17",
      RUNNERS_IMAGE: "n8nio/runners:2.42.7",
    });
    expect(compose.name).toBe(PROJECT);
    expect(Object.keys(compose.services)).toEqual(["postgres", "n8n", "runner"]);
    for (const service of Object.values(compose.services) as Record<string, unknown>[]) {
      expect(service.image).toMatch(/^\$\{[A-Z0-9_]+:\?/);
      expect(service.pull_policy).toBe("never");
      expect(service.privileged).toBeUndefined();
      expect(service.network_mode).toBeUndefined();
      expect(service.env_file).toBeUndefined();
      expect(service.security_opt).toContain("no-new-privileges:true");
      expect(service.mem_limit).toBeTruthy();
      expect(Number(service.cpus)).toBeGreaterThan(0);
      expect(Number(service.pids_limit)).toBeGreaterThan(0);
      expect(service.logging).toEqual({
        driver: "json-file",
        options: { "max-size": "10m", "max-file": "3" },
      });
    }
  });

  it("publishes only loopback and isolates persistent data and networks", () => {
    const { postgres, n8n, runner } = compose.services;
    expect(n8n.ports).toEqual(["127.0.0.1:5678:5678"]);
    expect(postgres.ports).toBeUndefined();
    expect(runner.ports).toBeUndefined();
    expect(postgres.networks).toEqual(["database"]);
    expect(runner.networks).toEqual(["runners"]);
    expect(compose.networks.database.internal).toBe(true);
    expect(compose.networks.runners.internal).toBe(true);
    for (const resource of [
      ...Object.values(compose.volumes),
      ...Object.values(compose.networks),
    ] as Record<string, unknown>[]) {
      expect(resource.name).toMatch(/^descomplica-n8n-crm-/);
      expect(resource.external).toBeUndefined();
    }
    expect(postgres.volumes).toEqual(["postgres_data:/var/lib/postgresql/data"]);
    expect(n8n.volumes).toEqual(["n8n_data:/home/node/.n8n"]);
    expect(runner.volumes).toBeUndefined();
    expect(source).not.toMatch(/docker\.sock|salesforce|supabase|hostnet/i);
  });

  it("uses external authenticated runners, local owner access, readiness and no execution retention", () => {
    const { n8n, runner } = compose.services;
    const env = n8n.environment;
    expect(env.N8N_RUNNERS_MODE).toBe("external");
    expect(env.N8N_RUNNERS_AUTH_TOKEN).toBe(runner.environment.N8N_RUNNERS_AUTH_TOKEN);
    expect(Object.keys(runner.environment).sort()).toEqual([
      "GENERIC_TIMEZONE",
      "N8N_RUNNERS_AUTH_TOKEN",
      "N8N_RUNNERS_TASK_BROKER_URI",
      "TZ",
    ]);
    expect(env.N8N_SECURE_COOKIE).toBe("true");
    expect(env.N8N_HOST).toBe("localhost");
    expect(env.N8N_EDITOR_BASE_URL).toBe("http://localhost:5678");
    expect(env.GENERIC_TIMEZONE).toBe("America/Sao_Paulo");
    for (const key of [
      "N8N_DIAGNOSTICS_ENABLED",
      "N8N_VERSION_NOTIFICATIONS_ENABLED",
      "N8N_TEMPLATES_ENABLED",
      "N8N_PERSONALIZATION_ENABLED",
      "EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS",
      "EXECUTIONS_DATA_SAVE_ON_PROGRESS",
    ])
      expect(env[key]).toBe("false");
    expect(env.EXECUTIONS_DATA_SAVE_ON_ERROR).toBe("none");
    expect(env.EXECUTIONS_DATA_SAVE_ON_SUCCESS).toBe("none");
    expect(n8n.healthcheck.test.slice(0, 3)).toEqual(["CMD", "node", "-e"]);
    expect(n8n.healthcheck.test[3]).toContain("/healthz/readiness");
    expect(n8n.healthcheck.test[3]).toContain("AbortSignal.timeout");
    expect(runner.depends_on.n8n.condition).toBe("service_healthy");
  });
});
