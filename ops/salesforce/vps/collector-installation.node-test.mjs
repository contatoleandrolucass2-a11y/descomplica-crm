import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertFileMetadata,
  assertHost,
  assertSecret,
  browser,
  collector,
  collectorPreflight,
  installCollector,
  liveApproval,
  monitor,
  parseArguments,
  readCollectorUnit,
  releasePath,
  renderUnit,
  validateState,
} from "./install-collector.mjs";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const runId = 123;
const repository = "contatoleandrolucass2-a11y/descomplica-crm";
const template = await readFile(new URL(`./${collector}`, import.meta.url), "utf8");
const prepare = { operation: "prepare", sha, runId };
const activate = { operation: "activate", sha };
const rollback = { operation: "rollback", sha };
const clone = (value) => structuredClone(value);

test("unit IO recovers only its known staging hardlink after a crash without mutating files", async () => {
  const unit = renderUnit(template, sha);
  const info = {
    uid: 0,
    mode: 0o100644,
    nlink: 2,
    ino: 7,
    dev: 2,
    size: unit.length,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
  let staged = { ...info };
  let closed = 0;
  let contents = unit;
  const io = {
    open: async () => ({
      stat: async () => info,
      readFile: async () => contents,
      close: async () => {
        closed++;
      },
    }),
    lstat: async (filename) => {
      assert.ok(filename.endsWith(".collector-install-staged"));
      return staged;
    },
  };
  assert.equal(await readCollectorUnit(unit, io), unit);
  await assert.rejects(readCollectorUnit(undefined, io));
  for (const change of [
    { ino: 8 },
    { dev: 8 },
    { uid: 999 },
    { nlink: 3 },
    { isSymbolicLink: () => true },
  ]) {
    staged = { ...info, ...change };
    await assert.rejects(readCollectorUnit(unit, io));
  }
  staged = { ...info };
  contents = "external edit";
  await assert.rejects(readCollectorUnit(unit, io), /contents changed/u);
  assert.equal(closed, 8);
  assert.equal(
    await readCollectorUnit(unit, {
      open: async () => {
        throw Object.assign(new Error(), { code: "ENOENT" });
      },
    }),
    null,
  );
});

function approval() {
  return {
    mainSha: sha,
    run: {
      id: runId,
      name: "CI",
      path: ".github/workflows/ci.yml",
      run_attempt: 2,
      status: "completed",
      conclusion: "success",
      event: "push",
      head_branch: "main",
      head_sha: sha,
      repository: { full_name: repository },
      head_repository: { full_name: repository },
    },
    jobs: ["validate", "release-gates", "isolated-restore", "promotable-image"].map((name) => ({
      name,
      run_id: runId,
      status: "completed",
      conclusion: "success",
    })),
  };
}

function fixture(enabled = "enabled", active = "active") {
  const context = {
    state: null,
    unit: null,
    locked: false,
    override: false,
    foreignCollector: false,
    monitor: {
      enabled,
      active,
      sub: active === "active" ? "running" : "dead",
      fingerprint: "c".repeat(64),
    },
    collector: { enabled: "disabled", active: "inactive" },
    events: [],
    failure: null,
    candidate: approval(),
  };
  const event = async (label, action = () => {}) => {
    assert.equal(context.locked, true, `lock missing: ${label}`);
    context.events.push(label);
    if (context.failure === `${label}:before`) throw new Error("injected before");
    const result = await action();
    if (context.failure === `${label}:after`) throw new Error("injected after");
    return result;
  };
  const io = {
    platform: "linux",
    uid: 0,
    version: "24.19.0",
    async withLock(action) {
      assert.equal(context.locked, false, "concurrent installation");
      context.locked = true;
      try {
        return await action();
      } finally {
        context.locked = false;
      }
    },
    readState: () => event("read-state", () => clone(context.state)),
    writeState: (expected, next) =>
      event(`save:${next.phase}`, () => {
        assert.deepEqual(context.state, expected, "state CAS mismatch");
        context.state = clone(validateState(next));
      }),
    verifyRelease: (value) =>
      event("verify-release", () => {
        assert.equal(value, sha);
        return template;
      }),
    approval: (value) =>
      event("approval", () => {
        assert.equal(value, runId);
        return clone(context.candidate);
      }),
    readUnit: () => event("read-unit", () => context.unit),
    compareUnit: (expected, next) =>
      event(next === null ? "remove-unit" : "install-unit", () => {
        assert.equal(context.unit, expected, "unit CAS mismatch");
        context.unit = next;
      }),
    assertCollectorAbsent: () =>
      event("collector-absent", () => {
        assert.equal(context.unit, null);
        assert.equal(context.foreignCollector, false);
        assert.equal(context.override, false);
        assert.deepEqual(context.collector, { enabled: "disabled", active: "inactive" });
      }),
    assertCollectorConfiguration: () =>
      event("collector-configuration", () => {
        assert.equal(context.foreignCollector, false);
        assert.equal(context.override, false);
      }),
    assertCollectorStopped: () =>
      event("collector-stopped", () => {
        assert.deepEqual(context.collector, { enabled: "disabled", active: "inactive" });
      }),
    monitorSnapshot: () => event("monitor-snapshot", () => clone(context.monitor)),
    preflight: () => event("preflight"),
    verifyUnit: () => event("verify-unit"),
    assertService: (name, wantedEnabled, wantedActive) =>
      event(`assert:${name}`, () => {
        const service = name === monitor ? context.monitor : context.collector;
        assert.equal(service.enabled, wantedEnabled);
        assert.equal(service.active, wantedActive);
      }),
    systemctl: (operation, name) =>
      event(`systemctl:${operation}:${name ?? ""}`, () => {
        if (operation === "daemon-reload") return;
        assert.ok([collector, monitor].includes(name), "must never mutate browser/CRM/n8n");
        const service = name === monitor ? context.monitor : context.collector;
        if (operation === "enable") service.enabled = "enabled";
        if (operation === "disable") service.enabled = "disabled";
        if (operation === "start") {
          if (name === collector) assert.equal(context.monitor.active, "inactive", "two producers");
          else assert.equal(context.collector.active, "inactive", "two producers");
          service.active = "active";
        }
        if (operation === "stop" && service.active !== "failed") service.active = "inactive";
        if (operation === "reset-failed") {
          assert.equal(name, collector);
          if (service.active === "failed") service.active = "inactive";
        }
        if (name === monitor) service.sub = service.active === "active" ? "running" : "dead";
      }),
  };
  return { io, context };
}

test("unit pins destinations, credentials and a nonroot immutable release without restarting browser", () => {
  const unit = renderUnit(template, sha);
  assert.equal(renderUnit(template.replace(/\r?\n/gu, "\r\n"), sha), unit);
  for (const directive of [
    `WorkingDirectory=${releasePath(sha)}`,
    "User=descomplica-salesforce",
    "Group=descomplica-salesforce",
    `Conflicts=${monitor}`,
    `Requisite=${browser}`,
    "ExecStart=/usr/local/bin/node ops/salesforce/run-every-30-minutes.mjs",
    "LoadCredential=n8n-bearer:/srv/descomplica-n8n/salesforce-test.token",
    "LoadCredential=status-bearer:/var/lib/descomplica-salesforce/status-bearer",
    "Environment=SALESFORCE_N8N_SECRET_FILE=%d/n8n-bearer",
    "Environment=SALESFORCE_STATUS_SECRET_FILE=%d/status-bearer",
    "Environment=SALESFORCE_CDP_URL=http://127.0.0.1:9222",
    "Environment=SALESFORCE_CRM_ORIGIN=https://crm.descomplicapro.com.br",
    "Environment=SALESFORCE_STATUS_ENABLED=true",
    "Environment=SALESFORCE_N8N_PUBLISH_ENABLED=true",
    "Environment=SALESFORCE_N8N_WEBHOOK_URL=https://n8n-crm.descomplicapro.com.br/webhook/descomplica-crm-salesforce-candidate",
    "Environment=SALESFORCE_CANDIDATE_OUTPUT=/var/lib/descomplica-salesforce/candidate.json",
    "ReadWritePaths=/var/lib/descomplica-salesforce",
    "MemoryMax=768M",
    "TimeoutStopSec=90",
    "Restart=on-failure",
    "StartLimitBurst=3",
    "StartLimitIntervalSec=300",
    "NoNewPrivileges=true",
    "ProtectSystem=strict",
    "ProtectHome=true",
    "UMask=0077",
    "KillMode=control-group",
    "CapabilityBoundingSet=",
    "LimitCORE=0",
  ])
    assert.ok(unit.split("\n").includes(directive), directive);
  assert.match(unit, new RegExp(`^After=.*${monitor.replaceAll(".", "\\.")}$`, "m"));
  assert.doesNotMatch(
    unit,
    /EnvironmentFile|ExecStartPre|ExecStopPost|PartOf=|Requires=|Listen|@RELEASE@/u,
  );
  assert.throws(() => renderUnit(template, "main"));
});

test("CLI accepts only first-install operations, exact SHA and positive CI run", () => {
  assert.deepEqual(parseArguments(["prepare", sha, String(runId)]), prepare);
  assert.deepEqual(parseArguments(["activate", sha]), activate);
  assert.deepEqual(parseArguments(["rollback", sha]), rollback);
  for (const args of [
    ["upgrade", sha],
    ["prepare", "main", "1"],
    ["prepare", sha, "0"],
    ["prepare", sha, "1e2"],
    ["activate", sha, "extra"],
    ["prepare", sha, "9007199254740992"],
  ])
    assert.throws(() => parseArguments(args));
});

test("root/Linux/Node guard precedes IO", async () => {
  for (const overrides of [{ platform: "win32" }, { uid: 999 }, { version: "24.18.0" }]) {
    const { io, context } = fixture();
    Object.assign(io, overrides);
    await assert.rejects(installCollector(prepare, io));
    assert.deepEqual(context.events, []);
  }
  assert.doesNotThrow(() => assertHost("linux", 0, "24.19.1"));
});

test("private file metadata refuses wrong owner, links and unsafe permissions", () => {
  const info = {
    uid: 999,
    mode: 0o100600,
    nlink: 1,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
  assert.doesNotThrow(() => assertFileMetadata(info, { owner: 999, privateFile: true }));
  for (const changes of [
    { uid: 0 },
    { mode: 0o100640 },
    { mode: 0o100400 },
    { nlink: 2 },
    { isFile: () => false },
    { isSymbolicLink: () => true },
  ]) {
    assert.throws(() =>
      assertFileMetadata({ ...info, ...changes }, { owner: 999, privateFile: true }),
    );
  }
  assert.throws(() => assertFileMetadata({ ...info, uid: 0, mode: 0o100666 }));
});

test("credential validation accepts a single LF or CRLF, never embedded whitespace or secret output", () => {
  for (const suffix of ["", "\n", "\r\n"])
    assert.doesNotThrow(() => assertSecret(`${"a".repeat(48)}${suffix}`));
  for (const secret of [
    "short",
    `${"x".repeat(40)}\r`,
    `${"x".repeat(40)}\n\n`,
    `${"x".repeat(40)}\r\n\r\n`,
    ` ${"x".repeat(40)}`,
    `${"x".repeat(40)}\0`,
    "x".repeat(5000),
    "x\ny".repeat(40),
  ]) {
    assert.throws(
      () => assertSecret(secret),
      (error) => error.message === "Private credential format is invalid.",
    );
  }
});

test("prepare persists a private backup and never changes services or the unit", async () => {
  const { io, context } = fixture();
  const baseline = clone(context.monitor);
  assert.equal(await installCollector(prepare, io), "prepared");
  assert.deepEqual(context.state.backup, { collector: null, monitor: baseline });
  assert.equal(context.unit, null);
  assert.ok(
    !context.events.some((event) => event.startsWith("systemctl:") || event === "install-unit"),
  );
  await assert.rejects(installCollector(prepare, io), /First installation/u);
});

test("activation validates unit before stopping monitor and starts only one producer", async () => {
  const { io, context } = fixture();
  await installCollector(prepare, io);
  assert.equal(await installCollector(activate, io), "active");
  const index = (event) => context.events.indexOf(event);
  assert.ok(index("preflight") < index("install-unit"));
  assert.ok(index("save:installing") < index("install-unit"));
  assert.ok(index("verify-unit") < index(`systemctl:stop:${monitor}`));
  assert.ok(index("save:switching") < index(`systemctl:stop:${monitor}`));
  assert.ok(index(`systemctl:disable:${monitor}`) < index(`systemctl:start:${collector}`));
  assert.deepEqual(context.collector, { active: "active", enabled: "enabled" });
  assert.equal(context.monitor.active, "inactive");
  assert.equal(context.monitor.enabled, "disabled");
});

for (const enabled of ["enabled", "disabled"]) {
  for (const active of ["active", "inactive"]) {
    test(`rollback restores ${enabled}/${active} monitor and is idempotent`, async () => {
      const { io, context } = fixture(enabled, active);
      const baseline = clone(context.monitor);
      await installCollector(prepare, io);
      await installCollector(activate, io);
      assert.equal(await installCollector(rollback, io), "rolled-back");
      assert.deepEqual(context.monitor, baseline);
      assert.equal(context.unit, null);
      const commands = context.events.filter((event) => event.startsWith("systemctl:"));
      assert.equal(await installCollector(rollback, io), "rolled-back");
      assert.deepEqual(
        context.events.filter((event) => event.startsWith("systemctl:")),
        commands,
      );
      assert.deepEqual(context.collector, { active: "inactive", enabled: "disabled" });
    });
  }
}

for (const event of [
  "save:installing",
  "install-unit",
  "verify-unit",
  "systemctl:daemon-reload:",
  "save:switching",
  `systemctl:stop:${monitor}`,
  `systemctl:disable:${monitor}`,
  `systemctl:enable:${collector}`,
  `systemctl:start:${collector}`,
  "save:active",
]) {
  for (const side of ["before", "after"]) {
    test(`rollback recovers activation interruption ${event}:${side}`, async () => {
      const { io, context } = fixture();
      const baseline = clone(context.monitor);
      await installCollector(prepare, io);
      context.failure = `${event}:${side}`;
      await assert.rejects(installCollector(activate, io), /injected/u);
      context.failure = null;
      assert.equal(await installCollector(rollback, io), "rolled-back");
      assert.deepEqual(context.monitor, baseline);
      assert.equal(context.unit, null);
      assert.deepEqual(context.collector, { active: "inactive", enabled: "disabled" });
    });
  }
}

for (const event of [
  `systemctl:disable:${collector}`,
  `systemctl:stop:${collector}`,
  `systemctl:reset-failed:${collector}`,
  "remove-unit",
  "systemctl:daemon-reload:",
  `systemctl:enable:${monitor}`,
  `systemctl:start:${monitor}`,
  "save:rolled-back",
]) {
  for (const side of ["before", "after"]) {
    test(`rollback retries interruption ${event}:${side} with durable state`, async () => {
      const { io, context } = fixture();
      const baseline = clone(context.monitor);
      await installCollector(prepare, io);
      await installCollector(activate, io);
      context.failure = `${event}:${side}`;
      await assert.rejects(installCollector(rollback, io), /injected/u);
      assert.ok(context.state.backup);
      context.failure = null;
      assert.equal(await installCollector(rollback, io), "rolled-back");
      assert.deepEqual(context.monitor, baseline);
      assert.equal(context.unit, null);
    });
  }
}

test("rollback resets failure only on collector before restoring monitor", async () => {
  const { io, context } = fixture();
  await installCollector(prepare, io);
  await installCollector(activate, io);
  context.collector.active = "failed";
  await installCollector(rollback, io);
  assert.equal(context.monitor.active, "active");
  assert.deepEqual(
    context.events.filter((event) => event.includes("reset-failed")),
    [`systemctl:reset-failed:${collector}`],
  );
});

test("rollback never touches a foreign or edited unit and retains recovery state", async () => {
  const { io, context } = fixture();
  await installCollector(prepare, io);
  await installCollector(activate, io);
  context.unit += "# external edit\n";
  const previousEvents = context.events.length;
  await assert.rejects(installCollector(rollback, io), /CAS/u);
  assert.ok(!context.events.slice(previousEvents).some((event) => event.startsWith("systemctl:")));
  assert.equal(context.state.phase, "active");
});

test("monitor drift blocks activation; configuration drift during rollback leaves collector stopped", async () => {
  const { io, context } = fixture();
  await installCollector(prepare, io);
  context.monitor.enabled = "disabled";
  await assert.rejects(installCollector(activate, io), /baseline/u);
  assert.equal(context.unit, null);
  context.monitor.enabled = "enabled";
  await installCollector(activate, io);
  const fingerprint = context.monitor.fingerprint;
  context.monitor.fingerprint = "d".repeat(64);
  await assert.rejects(installCollector(rollback, io), /configuration changed/u);
  assert.equal(context.state.phase, "rolling-back");
  assert.deepEqual(context.collector, { active: "inactive", enabled: "disabled" });
  context.monitor.fingerprint = fingerprint;
  await installCollector(rollback, io);
});

test("preflight and approval failure cannot mutate the existing services", async () => {
  for (const event of [
    "verify-release",
    "approval",
    "preflight",
    "collector-configuration",
    "collector-absent",
  ]) {
    const { io, context } = fixture();
    await installCollector(prepare, io);
    context.failure = `${event}:before`;
    await assert.rejects(installCollector(activate, io));
    assert.equal(context.state.phase, "prepared");
    assert.equal(context.unit, null);
    assert.ok(!context.events.some((value) => value.startsWith("systemctl:")));
  }
});

test("existing collector, overrides, invalid baseline, stale SHA and concurrent install are refused", async () => {
  for (const change of [
    (context) => {
      context.unit = "existing";
    },
    (context) => {
      context.foreignCollector = true;
    },
    (context) => {
      context.override = true;
    },
    (context) => {
      context.monitor.enabled = "masked";
    },
    (context) => {
      context.locked = true;
    },
  ]) {
    const { io, context } = fixture();
    change(context);
    await assert.rejects(installCollector(prepare, io));
    assert.equal(context.state, null);
  }
  const { io, context } = fixture();
  await installCollector(prepare, io);
  await assert.rejects(installCollector({ ...activate, sha: otherSha }, io), /another SHA/u);
  context.state.schemaVersion = 9;
  await assert.rejects(installCollector(rollback, io), /Invalid private/u);
});

test("the CI gate is refreshed at activation and rejects missing/failed/skipped jobs", async () => {
  const changes = [
    (value) => {
      value.mainSha = otherSha;
    },
    (value) => {
      value.run.event = "pull_request";
    },
    (value) => {
      value.run.head_sha = otherSha;
    },
    (value) => {
      value.run.head_branch = "feature";
    },
    (value) => {
      value.run.conclusion = "failure";
    },
    (value) => {
      value.jobs.pop();
    },
    (value) => {
      value.jobs[0].conclusion = "skipped";
    },
    (value) => {
      value.jobs.push(clone(value.jobs[0]));
    },
  ];
  for (const change of changes) {
    const { io, context } = fixture();
    await installCollector(prepare, io);
    change(context.candidate);
    await assert.rejects(installCollector(activate, io));
    assert.equal(context.unit, null);
    assert.equal(context.monitor.active, "active");
  }
});

test("live CI loader binds GitHub repository/workflow/attempt/jobs and accepts no local evidence", async () => {
  const candidate = approval();
  const urls = [];
  const json = async (url) => {
    urls.push(url);
    if (url.includes("/commits/main?")) return { sha: candidate.mainSha };
    if (url.includes("/jobs?")) return { jobs: candidate.jobs, total_count: candidate.jobs.length };
    return candidate.run;
  };
  assert.deepEqual(await liveApproval(runId, json), candidate);
  assert.ok(urls.every((url) => url.startsWith(`https://api.github.com/repos/${repository}/`)));
  assert.ok(urls.some((url) => url.includes(`/attempts/${candidate.run.run_attempt}/jobs?`)));
  for (const change of [
    (value) => {
      value.run.path = ".github/workflows/fake.yml";
    },
    (value) => {
      value.run.head_repository.full_name = "some/fork";
    },
    (value) => {
      value.run.run_attempt = 0;
    },
    (value) => {
      value.jobs[0].run_id = 456;
    },
  ]) {
    const bad = approval();
    change(bad);
    await assert.rejects(
      liveApproval(runId, async (url) =>
        url.includes("/commits/")
          ? { sha }
          : url.includes("/jobs?")
            ? { jobs: bad.jobs, total_count: bad.jobs.length }
            : bad.run,
      ),
    );
  }
  await assert.rejects(
    liveApproval(runId, async (url) =>
      url.includes("/commits/")
        ? { sha }
        : url.includes("/jobs?")
          ? { jobs: candidate.jobs, total_count: 101 }
          : candidate.run,
    ),
    /incomplete/u,
  );
});

function preflightFixture() {
  const calls = [];
  const context = {
    node: "v24.19.0\n",
    uid: "999\n",
    status: `${"s".repeat(48)}\r\n`,
    input: `${"n".repeat(48)}\n`,
    browser: { ActiveState: "active", SubState: "running", MainPID: "10" },
    failDependencies: false,
    failImport: false,
  };
  const io = {
    run: async (command, args, options) => {
      calls.push({ command, args, options });
      if (args[0] === "--version") return context.node;
      if (command.endsWith("/id")) return context.uid;
      if (context.failImport) throw new Error("import failed");
      return "";
    },
    directory: async (...args) => {
      calls.push({ directory: args });
    },
    parents: async (...args) => {
      calls.push({ parents: args });
    },
    read: async (filename, options) => {
      calls.push({ filename, options });
      return Buffer.from(filename.endsWith("status-bearer") ? context.status : context.input);
    },
    dependencies: async (directory) => {
      calls.push({ dependencies: directory });
      if (context.failDependencies) throw new Error("shared dependency store");
    },
    show: async (name) => {
      assert.equal(name, browser);
      return clone(context.browser);
    },
  };
  return { io, context, calls };
}

test("preflight reads private credentials under their real owners and imports as dedicated user", async () => {
  const { io, calls } = preflightFixture();
  await collectorPreflight(sha, io);
  assert.ok(
    calls.some(
      (call) =>
        call.filename?.endsWith("status-bearer") &&
        call.options.owner === 999 &&
        call.options.privateFile,
    ),
  );
  assert.ok(
    calls.some(
      (call) =>
        call.filename?.endsWith("salesforce-test.token") &&
        call.options.owner === undefined &&
        call.options.privateFile,
    ),
  );
  const invocation = calls.find((call) => call.command === "/usr/sbin/runuser");
  assert.deepEqual(invocation.args.slice(0, 6), [
    "-u",
    "descomplica-salesforce",
    "--",
    "/usr/local/bin/node",
    "--input-type=module",
    "--eval",
  ]);
  assert.equal(invocation.options.cwd, releasePath(sha));
  assert.match(invocation.args[6], /import\('@playwright\/test'\)/u);
  assert.match(invocation.args[6], /import\('zod'\)/u);
  assert.match(invocation.args[6], /import\('\.\/ops\/salesforce\/run-every-30-minutes\.mjs'\)/u);
  assert.match(invocation.args[6], /127\.0\.0\.1:9222\/json\/version/u);
  assert.doesNotMatch(JSON.stringify(calls), /ssssssss|nnnnnnnn|chmod|chown|restart|systemctl/u);
});

test("preflight blocks invalid runtime, root account, malformed secrets, stopped browser and inaccessible dependencies", async () => {
  for (const change of [
    (value) => {
      value.node = "v22.0.0";
    },
    (value) => {
      value.uid = "0";
    },
    (value) => {
      value.status = "bad";
    },
    (value) => {
      value.input = value.status;
    },
    (value) => {
      value.browser.ActiveState = "inactive";
    },
    (value) => {
      value.failDependencies = true;
    },
    (value) => {
      value.failImport = true;
    },
  ]) {
    const { io, context } = preflightFixture();
    change(context);
    await assert.rejects(collectorPreflight(sha, io));
  }
  const { io } = preflightFixture();
  let calls = 0;
  io.show = async () => ({ ActiveState: "active", SubState: "running", MainPID: String(++calls) });
  await assert.rejects(collectorPreflight(sha, io), /Browser changed/u);
});
