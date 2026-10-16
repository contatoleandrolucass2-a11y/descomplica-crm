import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  acquireProbeLease,
  gatewayRequest,
  classifyEvidence,
  observationSchema,
  probeMetaAdsConnection,
  readVisibleSessionEvidence,
  runConnectionMonitor,
  sendConnectionObservation,
  statusDestination,
  STATUS_INTERVAL_MS,
  withDeadline,
} from "./connection-monitor.mjs";
import {
  assertCdpConfiguration,
  inspectPageUrl,
  META_ADS_ACCOUNT_ID,
  META_ADS_BUSINESS_ID,
  META_ADS_CDP_URL,
  META_ADS_MANAGER_URL,
} from "./session-contract.mjs";
import {
  metaAdsObservationSchema,
  META_ADS_MANAGER_URL as BACKEND_MANAGER_URL,
} from "../../lib/crm/meta-ads/connection-contract.ts";

const complete = {
  login: false,
  campaigns: true,
  adSets: true,
  ads: true,
  accountControl: true,
  denied: false,
  editing: false,
};
const observation = {
  version: 1,
  observedAt: "2026-10-16T20:28:00.000Z",
  state: "connected",
  accountId: META_ADS_ACCOUNT_ID,
  businessId: META_ADS_BUSINESS_ID,
};

test("workspace identity requires exact HTTPS host, account and business", () => {
  assert.deepEqual(inspectPageUrl(META_ADS_MANAGER_URL), { kind: "workspace" });
  for (const url of [
    "https://evil.test/adsmanager/?act=1080988750909489",
    META_ADS_MANAGER_URL.replace("https:", "http:"),
    META_ADS_MANAGER_URL.replace("adsmanager.facebook.com", "adsmanager.facebook.com.evil.test"),
    META_ADS_MANAGER_URL.replace("https://", "https://user:pass@"),
  ])
    assert.equal(inspectPageUrl(url), null);
  assert.deepEqual(
    inspectPageUrl(META_ADS_MANAGER_URL.replace(META_ADS_ACCOUNT_ID, "1234567890123456")),
    { kind: "wrong_account" },
  );
  assert.deepEqual(
    inspectPageUrl(META_ADS_MANAGER_URL.replaceAll(META_ADS_BUSINESS_ID, "123456789012345")),
    { kind: "wrong_account" },
  );
  assert.deepEqual(inspectPageUrl(`${META_ADS_MANAGER_URL}&act=${META_ADS_ACCOUNT_ID}`), {
    kind: "ambiguous",
  });
  assert.deepEqual(inspectPageUrl("https://adsmanager.facebook.com/adsmanager/manage/campaigns/"), {
    kind: "ambiguous",
  });
  for (const url of [
    "https://www.facebook.com/login.php",
    "https://www.facebook.com/checkpoint/",
    "https://business.facebook.com/business/loginpage/?next=private",
    "https://www.facebook.com/two_step_verification/",
  ])
    assert.deepEqual(inspectPageUrl(url), { kind: "login" });
});

test("CDP is fixed to the dedicated port, with no credentials, paths or other origins", () => {
  assert.equal(assertCdpConfiguration({}), META_ADS_CDP_URL);
  assert.equal(assertCdpConfiguration({ META_ADS_CDP_URL }), META_ADS_CDP_URL);
  for (const endpoint of [
    "http://127.0.0.1:9222",
    "http://localhost:9224",
    "https://evil.test",
    "http://127.0.0.1:9224/",
    "http://user:pass@127.0.0.1:9224",
  ])
    assert.throws(() => assertCdpConfiguration({ META_ADS_CDP_URL: endpoint }));
});

test("URL or partial DOM evidence never proves connection; login and denied override tabs", () => {
  assert.equal(classifyEvidence({ kind: "workspace" }, complete), "connected");
  assert.equal(classifyEvidence({ kind: "workspace" }), "unavailable");
  for (const key of ["campaigns", "adSets", "ads", "accountControl"])
    assert.equal(
      classifyEvidence({ kind: "workspace" }, { ...complete, [key]: false }),
      "unavailable",
    );
  assert.equal(
    classifyEvidence({ kind: "workspace" }, { ...complete, login: true }),
    "reauth_required",
  );
  assert.equal(
    classifyEvidence({ kind: "workspace" }, { ...complete, denied: true }),
    "unavailable",
  );
  assert.equal(classifyEvidence({ kind: "wrong_account" }, complete), "wrong_account");
  assert.equal(classifyEvidence({ kind: "ambiguous" }, complete), "unavailable");
});

function domEvidence(labels, { password = false } = {}) {
  const element = ({ label, role = "tab", hidden = false }) => ({
    innerText: label,
    getAttribute: (name) => (name === "aria-hidden" && hidden ? "true" : null),
    getClientRects: () => (hidden ? [] : [{}]),
    matches: () => ["button", "combobox"].includes(role),
  });
  const nodes = labels.map(element);
  return vm.runInNewContext(
    `(${readVisibleSessionEvidence.toString()})({accountId: '${META_ADS_ACCOUNT_ID}'})`,
    {
      document: {
        querySelectorAll: (selector) =>
          selector.startsWith("input")
            ? password
              ? [element({ label: "", role: "input" })]
              : []
            : selector.startsWith('[role="dialog"]')
              ? []
              : nodes,
      },
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
  );
}

test("visible DOM probe emits booleans only and requires exact account identity in a control", () => {
  const labels = ["Campanhas", "Conjuntos de anúncios", "Anúncios"].map((label) => ({ label }));
  const identity = { role: "button", label: `Conta de anúncios (${META_ADS_ACCOUNT_ID})` };
  const result = domEvidence([...labels, identity]);
  assert.equal(classifyEvidence({ kind: "workspace" }, result), "connected");
  assert.ok(Object.values(result).every((value) => typeof value === "boolean"));
  for (const invalidIdentity of [
    { ...identity, label: `${META_ADS_ACCOUNT_ID}9` },
    { ...identity, hidden: true },
    { ...identity, role: "heading" },
  ]) {
    assert.equal(domEvidence([...labels, invalidIdentity]).accountControl, false);
  }
  assert.equal(domEvidence([...labels, identity], { password: true }).login, true);
  assert.equal(domEvidence([{ label: "Continuar com o Facebook", role: "button" }]).login, true);
});

function browserFixture(
  urls,
  { evidence = complete, evaluate, close, reload, afterReloadUrl } = {},
) {
  let disconnected = false;
  let reads = 0;
  let reloads = 0;
  return {
    browser: {
      contexts: () => [
        {
          pages: () =>
            urls.map((url) => ({
              url: () => (reloads && afterReloadUrl ? afterReloadUrl : url),
              reload: async (options) => {
                reloads++;
                assert.deepEqual(options, { waitUntil: "domcontentloaded", timeout: 8000 });
                await reload?.();
              },
              evaluate: async (reader, input) => {
                reads++;
                assert.equal(reader, readVisibleSessionEvidence);
                assert.deepEqual(input, { accountId: META_ADS_ACCOUNT_ID });
                return evaluate ? evaluate({ reads, reloads }) : evidence;
              },
            })),
          cookies: () => assert.fail("Cookies must never be read"),
        },
      ],
      close: async () => {
        disconnected = true;
        await close?.();
      },
    },
    disconnected: () => disconnected,
    reads: () => reads,
    reloads: () => reloads,
  };
}

const leaseOptions = { acquireLease: async () => "a".repeat(48), releaseLease: async () => {} };

test("probe refreshes a read-only workspace under lease, disconnects and preserves browser", async () => {
  const f = browserFixture([META_ADS_MANAGER_URL]);
  assert.equal(
    await probeMetaAdsConnection(
      {},
      {
        ...leaseOptions,
        connect: async (url, options) => {
          assert.equal(url, META_ADS_CDP_URL);
          assert.equal(options.timeout, 10000);
          return f.browser;
        },
      },
    ),
    "connected",
  );
  assert.equal(f.reads(), 3);
  assert.equal(f.reloads(), 1);
  assert.equal(f.disconnected(), true);
});

test("probe fails closed for unavailable, login, wrong-account and ambiguous tabs", async () => {
  for (const [urls, expected] of [
    [[], "unavailable"],
    [["https://business.facebook.com/business/loginpage/?next=private"], "reauth_required"],
    [[META_ADS_MANAGER_URL.replace(META_ADS_ACCOUNT_ID, "987654321098765")], "wrong_account"],
    [[META_ADS_MANAGER_URL, META_ADS_MANAGER_URL], "unavailable"],
    [[META_ADS_MANAGER_URL, "https://www.facebook.com/checkpoint/"], "reauth_required"],
  ]) {
    const f = browserFixture(urls);
    assert.equal(await probeMetaAdsConnection({}, { connect: async () => f.browser }), expected);
    assert.equal(f.reads(), 0);
    assert.equal(f.disconnected(), true);
  }
  assert.equal(
    await probeMetaAdsConnection(
      {},
      {
        connect: async () => {
          throw new Error("private failure");
        },
      },
    ),
    "unavailable",
  );
});

test("probe deadline closes hung DOM and handles connections arriving after timeout", async () => {
  const f = browserFixture([META_ADS_MANAGER_URL], { evaluate: () => new Promise(() => {}) });
  // Keep Node alive while AbortSignal.timeout (an unref timer) expires.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.equal(
      await probeMetaAdsConnection({}, { connect: async () => f.browser, timeoutMs: 25 }),
      "unavailable",
    );
    assert.equal(f.disconnected(), true);
    let connect;
    const late = browserFixture([META_ADS_MANAGER_URL]);
    const result = probeMetaAdsConnection(
      {},
      {
        connect: () =>
          new Promise((resolve) => {
            connect = resolve;
          }),
        timeoutMs: 25,
      },
    );
    assert.equal(await result, "unavailable");
    connect(late.browser);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(late.disconnected(), true);
  } finally {
    clearInterval(keepAlive);
  }
});

test("deadline cancellation is bounded even if a dependency ignores its signal", async () => {
  const controller = new AbortController();
  const pending = withDeadline(() => new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
});

async function privateFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "meta-status-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const secretFile = path.join(directory, "bearer");
  await writeFile(secretFile, "a".repeat(96) + "\n", { mode: 0o600 });
  return {
    directory,
    secretFile,
    environment: {
      META_ADS_STATUS_ENABLED: "true",
      META_ADS_CRM_ORIGIN: "https://crm.example.test",
      META_ADS_STATUS_SECRET_FILE: secretFile,
    },
  };
}

test("status destination requires opt-in, HTTPS origin and private regular bearer file", async (t) => {
  assert.equal(await statusDestination({}), null);
  const f = await privateFixture(t);
  const destination = await statusDestination(f.environment);
  assert.equal(destination.url.href, "https://crm.example.test/api/meta-ads/status");
  assert.equal(destination.secret.length, 96);
  for (const origin of [
    "http://crm.example.test",
    "https://user:password@crm.example.test",
    "https://crm.example.test/private",
    "https://crm.example.test?token=private",
  ])
    await assert.rejects(statusDestination({ ...f.environment, META_ADS_CRM_ORIGIN: origin }));
  await chmod(f.secretFile, 0o640);
  await assert.rejects(statusDestination(f.environment), /private owner-only/);
  await chmod(f.secretFile, 0o600);
  const link = path.join(f.directory, "link");
  await symlink(f.secretFile, link);
  await assert.rejects(statusDestination({ ...f.environment, META_ADS_STATUS_SECRET_FILE: link }));
  await writeFile(f.secretFile, "a".repeat(96) + "\nextra");
  await assert.rejects(statusDestination(f.environment), /secret is invalid/);
  for (const invalid of ["a".repeat(257), "á".repeat(32), "a".repeat(31), "a".repeat(32) + " "]) {
    await writeFile(f.secretFile, invalid);
    await assert.rejects(statusDestination(f.environment), /secret/);
  }
  await writeFile(f.secretFile, "a".repeat(256));
  assert.equal((await statusDestination(f.environment)).secret.length, 256);
});

test("heartbeat contract rejects personal data, unknown fields, foreign identities and bad time", () => {
  assert.deepEqual(observationSchema.parse(observation), observation);
  for (const value of [
    { ...observation, campaign: "private" },
    { ...observation, accountId: "1" },
    { ...observation, businessId: "1" },
    { ...observation, observedAt: "today" },
    { ...observation, version: 2 },
    { ...observation, state: "authenticated" },
  ])
    assert.equal(observationSchema.safeParse(value).success, false);
});

test("heartbeat uses authenticated POST, no redirect, bounded cancellation and accepted receipt", async () => {
  const destination = {
    url: new URL("https://crm.example.test/api/meta-ads/status"),
    secret: "synthetic-secret",
  };
  await sendConnectionObservation(destination, observation, {
    fetch: async (url, options) => {
      assert.equal(url, destination.url);
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.authorization, "Bearer synthetic-secret");
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(JSON.parse(options.body), observation);
      return Response.json({ ok: true }, { status: 202 });
    },
  });
  for (const response of [
    Response.json({ ok: true }),
    Response.json({ ok: false }, { status: 202 }),
  ])
    await assert.rejects(
      sendConnectionObservation(destination, observation, { fetch: async () => response }),
    );
  let requests = 0;
  await assert.rejects(
    sendConnectionObservation(
      destination,
      { ...observation, token: "private" },
      {
        fetch: () => {
          requests++;
        },
      },
    ),
  );
  assert.equal(requests, 0);
});

test("monitor sends only session heartbeat every 45 seconds and sanitizes failures", async (t) => {
  const f = await privateFixture(t);
  const controller = new AbortController();
  const sent = [],
    logs = [];
  await runConnectionMonitor(f.environment, {
    signal: controller.signal,
    now: () => Date.parse(observation.observedAt),
    probe: async () => "connected",
    send: async (_destination, value) => {
      sent.push(value);
      throw new Error("private credentials must not appear");
    },
    log: (value) => logs.push(value),
    wait: async (milliseconds) => {
      assert.equal(milliseconds, STATUS_INTERVAL_MS);
      controller.abort();
    },
  });
  assert.equal(STATUS_INTERVAL_MS, 45000);
  assert.deepEqual(sent, [observation]);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /credentials|synthetic-secret/);
});

test("operational monitor does not include extraction, storage or Meta API access", async () => {
  const source = await readFile(new URL("./connection-monitor.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /context\.cookies|document\.cookie|localStorage|sessionStorage|graph\.facebook\.com|page\.click|page\.goto/,
  );
});

test("local heartbeat schema stays in parity with the backend strict contract", () => {
  assert.equal(META_ADS_MANAGER_URL, BACKEND_MANAGER_URL);
  for (const value of [
    observation,
    ...["connected", "reauth_required", "unavailable", "wrong_account"].map((state) => ({
      ...observation,
      state,
    })),
    { ...observation, accountId: "1" },
    { ...observation, businessId: "2" },
    { ...observation, observedAt: "yesterday" },
    { ...observation, unexpected: "private" },
    { ...observation, version: 2 },
  ]) {
    assert.equal(
      observationSchema.safeParse(value).success,
      metaAdsObservationSchema.safeParse(value).success,
    );
  }
});

test("console active, gateway unavailable and lease denied prevent refresh and new connected proof", async () => {
  for (const gatewayResult of [{ active: true }, null, {}, { active: "false" }]) {
    const calls = [];
    assert.equal(
      await acquireProbeLease({
        gatewayRequest: async (...args) => {
          calls.push(args);
          return gatewayResult;
        },
      }),
      null,
    );
    assert.equal(calls.length, 1);
  }
  const f = browserFixture([META_ADS_MANAGER_URL]);
  assert.equal(
    await probeMetaAdsConnection(
      {},
      { connect: async () => f.browser, acquireLease: async () => null },
    ),
    "unavailable",
  );
  assert.equal(f.reloads(), 0);
  const methods = [];
  assert.equal(
    await acquireProbeLease({
      gatewayRequest: async (method) => {
        methods.push(method);
        return method === "GET" ? { active: false } : { lease: "b".repeat(48) };
      },
    }),
    "b".repeat(48),
  );
  assert.deepEqual(methods, ["GET", "POST"]);
});

test("editing or unexpected query prevents refresh even with old connected DOM", async () => {
  for (const [url, evidence] of [
    [META_ADS_MANAGER_URL, { ...complete, editing: true }],
    [`${META_ADS_MANAGER_URL}&selected_campaign_ids=123`, complete],
  ]) {
    const f = browserFixture([url], { evidence });
    assert.equal(
      await probeMetaAdsConnection({}, { ...leaseOptions, connect: async () => f.browser }),
      "unavailable",
    );
    assert.equal(f.reloads(), 0);
  }
});

test("fresh UI and redirects supersede stale connected DOM; exclusive lease is always released", async () => {
  for (const [afterReloadUrl, evidence, expected] of [
    [null, { ...complete, denied: true }, "unavailable"],
    ["https://business.facebook.com/business/loginpage/", complete, "reauth_required"],
    [
      META_ADS_MANAGER_URL.replace(META_ADS_ACCOUNT_ID, "987654321098765"),
      complete,
      "wrong_account",
    ],
  ]) {
    const f = browserFixture([META_ADS_MANAGER_URL], {
      afterReloadUrl,
      evaluate: ({ reloads }) => (reloads ? evidence : complete),
    });
    let released = 0;
    assert.equal(
      await probeMetaAdsConnection(
        {},
        {
          ...leaseOptions,
          connect: async () => f.browser,
          releaseLease: async (lease) => {
            released++;
            assert.equal(lease, "a".repeat(48));
            assert.equal(f.disconnected(), true);
          },
        },
      ),
      expected,
    );
    assert.equal(f.reloads(), 1);
    assert.equal(released, 1);
  }
});

test("gateway coordination uses fixed loopback without cookies, redirects or oversized replies", async (t) => {
  let status = 200;
  let body = JSON.stringify({ active: false });
  const server = http.createServer((_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json", Location: "https://evil.test" });
    res.end(body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  let calls = 0;
  const request = (options, callback) => {
    calls++;
    assert.equal(options.hostname, "127.0.0.1");
    assert.equal(options.port, 6083);
    assert.equal(options.path, "/session-active");
    assert.equal(options.method, "GET");
    assert.equal(options.agent, false);
    assert.deepEqual(options.headers, { Accept: "application/json", "Content-Length": "0" });
    return http.request({ ...options, port: server.address().port }, callback);
  };
  assert.deepEqual(await gatewayRequest("GET", "/session-active", { request }), { active: false });
  status = 302;
  assert.equal(await gatewayRequest("GET", "/session-active", { request }), null);
  status = 200;
  body = "x".repeat(2049);
  assert.equal(await gatewayRequest("GET", "/session-active", { request }), null);
  assert.equal(calls, 3);
});
