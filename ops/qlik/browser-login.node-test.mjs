import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { chromium } from "@playwright/test";
import { renewBrowserLogin } from "./browser-login.mjs";

const QLIK = "https://direcional.us.qlikcloud.com";
const MS = "https://login.microsoftonline.com";
const TENANT = "8c139cd3-f1d3-4761-a3b9-076a7d958d19";
const SYNTHETIC = { username: "synthetic@example.invalid", password: "Synthetic-only-45!" };
const SYNTHETIC_OVERLAP = {
  username: "analystContract123@example.invalid",
  password: "Contract123",
};
const required = (reason) => ({
  status: [
    "invalid_options",
    "already_running",
    "cancelled",
    "deadline_exceeded",
    "browser_login_unavailable",
    "attempt_state_unavailable",
  ].includes(reason)
    ? "unavailable"
    : "reauth_required",
  reason,
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture(options = {}) {
  const events = [];
  const finishes = [];
  const page = new EventEmitter();
  const frame = { url: () => pageUrl };
  let phase = options.initialPhase ?? "other";
  let pageUrl = options.initialUrl ?? `${MS}/${TENANT}/saml2`;
  let handler;
  let now = 0;
  let reading = 0;
  let claimed = 0;
  let probeCalls = 0;
  const pendingTimers = new Map();
  let timerId = 0;
  const request = (url, previous = null, body = null) => ({
    url: () => url,
    redirectedFrom: () => previous,
    method: () => (body === null ? "GET" : "POST"),
    postData: () => body,
    frame: () => frame,
    isNavigationRequest: () => true,
  });
  const routed = (url, body) =>
    handler({
      request: () => request(url, null, body),
      abort: async () => events.push("request_blocked"),
      fallback: async () => events.push("request_allowed"),
    });
  const form = { action: `${MS}/${TENANT}/login`, method: "post", target: "", ...options.form };
  const attributes = options.submitAttributes ?? {};
  class Input {
    constructor(kind) {
      this.kind = kind;
      this.form = form;
    }
    get value() {
      return this.content ?? "";
    }
    set value(value) {
      this.content = value;
      events.push(`${this.kind}_set`);
    }
    getClientRects() {
      return [1];
    }
    dispatchEvent() {
      options.onInput?.(form);
    }
  }
  const email = new Input("username");
  const password = new Input("password");
  const node = (extra = {}) =>
    Object.defineProperties({ getClientRects: () => [1] }, Object.getOwnPropertyDescriptors(extra));
  const submit = node({
    form,
    get value() {
      return phase === "stay" ? (options.yesLabel ?? "Sim") : "submit";
    },
    getAttribute: (attribute) => attributes[attribute] ?? null,
    click: () => {
      events.push(`${phase}_submit`);
      if (phase === "username") phase = "password";
      else if (phase === "password") {
        if (options.passwordRequest) void routed(...options.passwordRequest);
        phase = options.afterPassword ?? "stay";
        if (phase === "qlik") pageUrl = `${QLIK}/insights/home`;
      } else if (phase === "stay") {
        phase = "qlik";
        pageUrl = `${QLIK}/insights/home`;
      }
    },
  });
  const other = node({
    click: () => {
      events.push("other_click");
      phase = "username";
    },
  });
  const document = {
    querySelectorAll: (selector) => {
      if (selector.startsWith("#i0116")) return phase === "username" ? [email] : [];
      if (selector.startsWith("#i0118")) return phase === "password" ? [password] : [];
      if (selector.startsWith('input[name="loginfmt"]'))
        return phase === "password" && options.displayName
          ? [node({ textContent: options.displayName })]
          : [];
      if (selector === "#idSIButton9")
        return ["username", "password", "stay"].includes(phase) ? [submit] : [];
      if (selector === "#otherTile") return phase === "other" ? [other] : [];
      if (selector.includes("#kmsiTitle"))
        return phase === "stay"
          ? (options.headingTexts ?? [options.heading ?? "Continuar conectado?"]).map(
              (textContent) => node({ textContent }),
            )
          : [];
      if (selector === "#passwordError") return phase === "rejected" ? [node()] : [];
      return [];
    },
    querySelector: (selector) => {
      if (selector.includes("#captcha")) return phase === "captcha" ? node() : null;
      if (selector.includes("#idDiv_SAOTCS")) return phase === "mfa" ? node() : null;
      return null;
    },
  };
  const location = {
    get origin() {
      return new URL(pageUrl).origin;
    },
    get href() {
      return pageUrl;
    },
  };
  const environment = {
    document,
    location,
    getComputedStyle: () => ({ visibility: "visible" }),
    HTMLInputElement: Input,
    URL,
    Event,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => {
      probeCalls++;
      events.push("probe");
      assert.equal(url, `${QLIK}/api/v1/csrf-token`);
      assert.equal(init.method, "GET");
      assert.equal(init.credentials, "same-origin");
      assert.equal(init.redirect, "error");
      assert.equal(init.cache, "no-store");
      return {
        status: options.csrfStatus ?? 200,
        url: options.csrfUrl ?? url,
        redirected: options.csrfRedirected ?? false,
        headers: new Headers({ "qlik-csrf-token": options.csrf ?? "synthetic-csrf-only-test" }),
      };
    },
  };
  page.url = () => pageUrl;
  page.mainFrame = () => frame;
  page.route = async (pattern, callback) => {
    assert.equal(pattern, "**/*");
    handler = callback;
    events.push("route_added");
  };
  page.unroute = async (pattern, callback) => {
    assert.equal(pattern, "**/*");
    assert.equal(callback, handler);
    events.push("route_removed");
    handler = undefined;
  };
  page.goto = async (url, init) => {
    events.push("goto");
    assert.equal(url, `${QLIK}/`);
    assert.equal(init.waitUntil, "domcontentloaded");
    assert.ok(init.timeout <= 30_000);
    if (options.goto) return options.goto();
    const root = request(`${QLIK}/`);
    let end;
    if (options.redirect === "qlik") {
      phase = "qlik";
      pageUrl = `${QLIK}/`;
      end = root;
    } else if (options.redirect === "spa") {
      pageUrl = `${QLIK}/login`;
      page.emit("framenavigated", frame);
      end = request(`${MS}/${TENANT}/saml2`);
      page.emit("request", end);
      pageUrl = `${MS}/${TENANT}/saml2`;
      return { request: () => end };
    } else if (options.redirect === "evil") {
      pageUrl = "https://login.microsoftonline.com.evil.invalid/";
      end = request(pageUrl, root);
    } else {
      pageUrl = `${MS}/${options.redirect === "other_tenant" ? "another-tenant" : TENANT}/saml2`;
      const previous =
        options.redirect === "direct"
          ? null
          : options.redirect === "evil_hop"
            ? request("https://evil.invalid/", root)
            : root;
      end = request(pageUrl, previous);
    }
    page.emit("request", end);
    return { request: () => end };
  };
  page.evaluate = async (fn, args) => {
    options.beforeEvaluate?.(args);
    if (options.evaluate) return options.evaluate(fn, args);
    environment.__args = args;
    return runInNewContext(`(${fn.toString()})(__args)`, environment);
  };
  const browser = { pages: () => options.pages ?? [page] };
  const config = {
    credential: async () => {
      reading++;
      events.push("credential_read");
      return { ...SYNTHETIC };
    },
    canAttempt: async (...args) => {
      assert.equal(args.length, 0);
      events.push("can");
      return options.can ?? true;
    },
    claimAttempt: async (...args) => {
      assert.equal(args.length, 0);
      claimed++;
      events.push("claim");
      return options.claim ?? true;
    },
    finishAttempt: async (...args) => {
      assert.equal(args.length, 1);
      finishes.push(args[0]);
      events.push(`finish_${args[0]}`);
    },
    clock: () => now,
    timers: {
      setTimeout: (callback, delay) => {
        const id = ++timerId;
        if (delay <= 1_000)
          queueMicrotask(() => {
            now += delay;
            callback();
          });
        else pendingTimers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => pendingTimers.delete(id),
    },
  };
  return {
    browser,
    page,
    events,
    finishes,
    config,
    request,
    routed,
    run: (extra) => renewBrowserLogin(browser, { ...config, ...extra }),
    reading: () => reading,
    claimed: () => claimed,
    phase: () => phase,
    probeCalls: () => probeCalls,
    expire: () => {
      for (const callback of pendingTimers.values()) callback();
    },
    navigate: (url) => {
      pageUrl = url;
    },
  };
}

test("owner page: trusted redirect, one username/password, explicit stay prompt and CSRF proof", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { status: "authenticated" });
  for (const event of [
    "goto",
    "other_click",
    "username_set",
    "username_submit",
    "password_set",
    "password_submit",
    "stay_submit",
    "probe",
  ])
    assert.equal(f.events.filter((item) => item === event).length, 1, event);
  assert.equal(f.reading(), 1);
  assert.equal(f.claimed(), 1);
  assert.ok(f.events.indexOf("claim") > f.events.indexOf("username_submit"));
  assert.ok(f.events.indexOf("claim") < f.events.indexOf("password_set"));
  assert.deepEqual(f.finishes, ["authenticated"]);
  assert.equal(f.page.listenerCount("request"), 0);
  assert.equal(f.events.at(-1), "route_removed");
});

test("pending/attention state preserves existing MFA page without navigation or credential read", async () => {
  const f = fixture({ can: false, initialPhase: "mfa" });
  assert.deepEqual(await f.run(), required("attempt_blocked"));
  assert.deepEqual(f.events, ["can"]);
  assert.equal(f.phase(), "mfa");
  assert.equal(f.reading(), 0);
  assert.deepEqual(f.finishes, []);
});

test("claim lost immediately before password leaves page untouched and sends no password", async () => {
  const f = fixture({ claim: false });
  assert.deepEqual(await f.run(), required("attempt_blocked"));
  assert.equal(f.phase(), "password");
  assert.equal(f.events.includes("password_set"), false);
  assert.equal(f.events.includes("password_submit"), false);
  assert.deepEqual(f.finishes, []);
});

test("no persisted-state callbacks: fail closed before navigating or loading credentials", async () => {
  for (const name of ["canAttempt", "claimAttempt", "finishAttempt"]) {
    const f = fixture();
    assert.deepEqual(await f.run({ [name]: undefined }), required("attempt_state_unavailable"));
    assert.equal(f.reading(), 0);
    assert.equal(f.events.includes("goto"), false);
  }
});

test("only a real main-frame Qlik redirect to the pinned tenant grants trust", async () => {
  for (const redirect of ["direct", "other_tenant", "evil_hop", "evil"]) {
    const f = fixture({ redirect });
    assert.deepEqual(
      await f.run(),
      required(redirect === "evil" ? "unexpected_origin" : "untrusted_redirect"),
    );
    assert.equal(f.reading(), 0);
    assert.equal(f.claimed(), 0);
    assert.equal(f.events.includes("other_click"), false);
  }
});

test("loaded Qlik SPA /login can initiate a main-frame navigation to the pinned tenant", async () => {
  const f = fixture({ redirect: "spa" });
  assert.deepEqual(await f.run(), { status: "authenticated" });
});

test("zero or multiple pages never open a new page or pick an arbitrary target", async () => {
  for (const pages of [[], [{}, {}]]) {
    const f = fixture({ pages });
    assert.deepEqual(await f.run(), required("target_page_ambiguous"));
    assert.deepEqual(f.events, []);
  }
});

test("unsafe form destinations, methods, targets and button overrides receive no credential", async () => {
  for (const options of [
    { form: { action: "https://evil.invalid/" } },
    { form: { action: "https://login.microsoftonline.com.evil.invalid/" } },
    { form: { action: "https://user:pass@login.microsoftonline.com/" } },
    { form: { method: "get" } },
    { form: { target: "_blank" } },
    { submitAttributes: { formaction: "https://evil.invalid/" } },
    { submitAttributes: { formmethod: "get" } },
    { submitAttributes: { formtarget: "other-window" } },
  ]) {
    const f = fixture(options);
    assert.deepEqual(await f.run(), required("unsafe_form"));
    assert.equal(f.events.includes("username_set"), false);
    assert.equal(f.events.includes("password_submit"), false);
  }
});

test("input event changing the form destination cannot submit the credential", async () => {
  const f = fixture({
    onInput: (form) => {
      form.action = "https://evil.invalid/";
    },
  });
  assert.deepEqual(await f.run(), required("unsafe_form"));
  assert.equal(f.events.includes("username_submit"), false);
});

test("page changes origin just before entry: browser-side guard rejects before input", async () => {
  let f;
  f = fixture({
    beforeEvaluate: ({ action }) => {
      if (action === "username") f.navigate("https://evil.invalid/");
    },
  });
  assert.deepEqual(await f.run(), required("unknown_login_state"));
  assert.equal(f.events.includes("username_set"), false);
});

test("MFA, CAPTCHA, rejected password and unknown page are never solved or retried", async () => {
  for (const [phase, reason] of [
    ["mfa", "mfa_required"],
    ["captcha", "captcha_required"],
    ["rejected", "credential_rejected"],
    ["unknown", "unknown_login_state"],
    ["password", "unknown_login_state"],
  ]) {
    const f = fixture({ afterPassword: phase });
    assert.deepEqual(await f.run(), required(reason));
    assert.equal(f.events.filter((item) => item === "password_submit").length, 1);
    assert.deepEqual(f.finishes, ["attention"]);
  }
});

test("password screen without this attempt's explicit username never claims or enters a password", async () => {
  const f = fixture({ initialPhase: "password" });
  assert.deepEqual(await f.run(), required("unknown_account"));
  assert.equal(f.claimed(), 0);
  assert.equal(f.reading(), 0);
});

test("wrong cached Microsoft account never receives a password or a claim", async () => {
  for (const initialPhase of ["password", "other"]) {
    const f = fixture({ initialPhase, displayName: "other-synthetic@example.invalid" });
    assert.deepEqual(
      await f.run(),
      required(initialPhase === "password" ? "unknown_account" : "account_mismatch"),
    );
    assert.equal(f.claimed(), 0);
    assert.equal(f.events.includes("password_set"), false);
    assert.equal(f.events.includes("password_submit"), false);
  }
});

test("Microsoft identifier comparison accepts matching account case-insensitively", async () => {
  const f = fixture({ displayName: SYNTHETIC.username.toUpperCase() });
  assert.deepEqual(await f.run(), { status: "authenticated" });
});

test("stay signed in requires an exact heading and Yes/Sim command", async () => {
  for (const options of [{ heading: "Update your password" }, { yesLabel: "Continue" }]) {
    const f = fixture(options);
    assert.deepEqual(
      await f.run(),
      required(options.heading ? "unknown_login_state" : "unsafe_form"),
    );
    assert.equal(f.events.includes("stay_submit"), false);
    assert.deepEqual(f.finishes, ["attention"]);
  }
});

test("nested Stay signed in header/title deduplicate equal text but reject conflicting headings", async () => {
  const nested = fixture({ headingTexts: ["Stay signed in?", "  Stay signed in?  "] });
  assert.deepEqual(await nested.run(), { status: "authenticated" });
  assert.equal(nested.events.filter((item) => item === "stay_submit").length, 1);
  const ambiguous = fixture({ headingTexts: ["Stay signed in?", "Update your password"] });
  assert.deepEqual(await ambiguous.run(), required("unknown_login_state"));
  assert.equal(ambiguous.events.includes("stay_submit"), false);
  assert.deepEqual(ambiguous.finishes, ["attention"]);
});

test("documented CSRF 204 and compatible 200 prove renewal and clear manually recovered attention", async () => {
  for (const csrfStatus of [204, 200]) {
    for (const existingSession of [false, true]) {
      const f = fixture({
        csrfStatus,
        ...(existingSession ? { initialUrl: `${QLIK}/insights/home`, can: false } : {}),
      });
      assert.deepEqual(await f.run(), { status: "authenticated" });
      assert.deepEqual(f.finishes, ["authenticated"]);
      assert.equal(f.reading(), existingSession ? 0 : 1);
      assert.equal(f.claimed(), existingSession ? 0 : 1);
    }
  }
});

test("CSRF rejects other 2xx and requires the same endpoint, redirect and header guards for 200/204", async () => {
  for (const options of [
    { csrfStatus: 201 },
    { csrfStatus: 202 },
    { csrfStatus: 205 },
    { csrfStatus: 206 },
    { csrfStatus: 299 },
    { csrfStatus: 401 },
    { csrfStatus: 403 },
    { csrfStatus: 500 },
    { csrf: "" },
    { csrf: "short" },
    { csrf: "x".repeat(2049) },
    { csrfRedirected: true },
    { csrfUrl: `${MS}/login` },
  ]) {
    for (const csrfStatus of [204, 200]) {
      const f = fixture({ csrfStatus, ...options });
      assert.deepEqual(await f.run(), required("csrf_probe_failed"));
      assert.deepEqual(f.finishes, ["attention"]);
    }
  }
});

test("already authenticated Qlik still probes but never loads credentials or claims", async () => {
  const f = fixture({ redirect: "qlik" });
  assert.deepEqual(await f.run(), { status: "authenticated" });
  assert.equal(f.probeCalls(), 1);
  assert.equal(f.reading(), 0);
  assert.equal(f.claimed(), 0);
  assert.deepEqual(f.finishes, ["authenticated"]);
});

test("manual Qlik recovery clears attention before canAttempt, navigation or credential access", async () => {
  const f = fixture({ initialUrl: `${QLIK}/insights/home`, can: false });
  assert.deepEqual(await f.run(), { status: "authenticated" });
  assert.deepEqual(f.events, ["probe", "finish_authenticated"]);
  assert.equal(f.reading(), 0);
  assert.equal(f.claimed(), 0);
  assert.equal(f.probeCalls(), 1);
});

test("an existing Qlik session works without an initial credential or state reader", async () => {
  const f = fixture({ initialUrl: `${QLIK}/insights/home` });
  assert.deepEqual(await renewBrowserLogin(f.browser), { status: "authenticated" });
  assert.deepEqual(f.events, ["probe"]);
});

test("failed initial Qlik probe cannot clear attention or navigate a blocked attempt", async () => {
  const f = fixture({ initialUrl: `${QLIK}/insights/home`, csrfStatus: 401, can: false });
  assert.deepEqual(await f.run(), required("attempt_blocked"));
  assert.deepEqual(f.events, ["probe", "can"]);
  assert.deepEqual(f.finishes, []);
});

test("external credential POST and repeated password POST are blocked before transport", async () => {
  for (const url of ["https://evil.invalid/", "https://login.microsoftonline.com.evil.invalid/"]) {
    const f = fixture({
      passwordRequest: [url, new URLSearchParams({ passwd: SYNTHETIC.password }).toString()],
    });
    assert.deepEqual(await f.run(), required("unsafe_form"));
    assert.ok(f.events.includes("request_blocked"));
    assert.deepEqual(f.finishes, ["attention"]);
  }
  const f = fixture();
  const original = f.page.evaluate;
  f.page.evaluate = async (fn, args) => {
    const result = await original(fn, args);
    if (args.action === "password") {
      const body = new URLSearchParams({ passwd: SYNTHETIC.password }).toString();
      await f.routed(`${MS}/${TENANT}/login`, body);
      await f.routed(`${MS}/${TENANT}/login`, body);
    }
    return result;
  };
  assert.deepEqual(await f.run(), required("credential_rejected"));
  assert.ok(f.events.includes("request_allowed"));
  assert.ok(f.events.includes("request_blocked"));
  assert.deepEqual(f.finishes, ["attention"]);
});

test("loginfmt overlap and empty/nonmatching passwd do not count; a second exact passwd still blocks", async () => {
  for (const [emailPasswd, repeatPassword] of [
    [undefined, false],
    [undefined, true],
    ["", false],
    ["", true],
    ["synthetic-placeholder", false],
    ["synthetic-placeholder", true],
  ]) {
    const f = fixture();
    const evaluate = f.page.evaluate;
    f.page.evaluate = async (fn, args) => {
      const result = await evaluate(fn, args);
      if (args.action === "username") {
        await f.routed(
          `${MS}/${TENANT}/login`,
          new URLSearchParams({
            loginfmt: SYNTHETIC_OVERLAP.username,
            ...(emailPasswd === undefined ? {} : { passwd: emailPasswd }),
          }).toString(),
        );
      } else if (args.action === "password") {
        const body = new URLSearchParams({ passwd: SYNTHETIC_OVERLAP.password }).toString();
        await f.routed(`${MS}/${TENANT}/login`, body);
        if (repeatPassword) await f.routed(`${MS}/${TENANT}/login`, body);
      }
      return result;
    };
    assert.deepEqual(
      await f.run({ credential: () => ({ ...SYNTHETIC_OVERLAP }) }),
      repeatPassword ? required("credential_rejected") : { status: "authenticated" },
    );
    assert.equal(f.events.filter((item) => item === "request_allowed").length, 2);
    assert.equal(
      f.events.filter((item) => item === "request_blocked").length,
      repeatPassword ? 1 : 0,
    );
  }
  const external = fixture({
    passwordRequest: [
      "https://evil.invalid/",
      new URLSearchParams({ loginfmt: SYNTHETIC_OVERLAP.username }).toString(),
    ],
  });
  assert.deepEqual(
    await external.run({ credential: () => ({ ...SYNTHETIC_OVERLAP }) }),
    required("unsafe_form"),
  );
  assert.ok(external.events.includes("request_blocked"));
});

test("duplicate passwd fields containing the expected password fail closed", async () => {
  const f = fixture({
    passwordRequest: [
      `${MS}/${TENANT}/login`,
      new URLSearchParams([
        ["passwd", ""],
        ["passwd", SYNTHETIC_OVERLAP.password],
      ]).toString(),
    ],
  });
  assert.deepEqual(
    await f.run({ credential: () => ({ ...SYNTHETIC_OVERLAP }) }),
    required("credential_rejected"),
  );
  assert.ok(f.events.includes("request_blocked"));
  assert.deepEqual(f.finishes, ["attention"]);
});

test("abort before start performs no navigation, read or claim", async () => {
  const f = fixture();
  assert.deepEqual(await f.run({ signal: AbortSignal.abort() }), required("cancelled"));
  assert.deepEqual(f.events, []);
});

test("abort during credential read returns promptly, retains lock and prevents late entry", async () => {
  const f = fixture();
  const abort = new AbortController();
  const pending = Promise.withResolvers();
  const read = Promise.withResolvers();
  const work = f.run({
    signal: abort.signal,
    credential: () => {
      read.resolve();
      return pending.promise;
    },
  });
  await read.promise;
  assert.deepEqual(await f.run(), required("already_running"));
  abort.abort();
  assert.deepEqual(await work, required("cancelled"));
  assert.deepEqual(await f.run(), required("already_running"));
  pending.resolve({ ...SYNTHETIC });
  await tick();
  assert.equal(f.events.includes("username_set"), false);
  assert.equal(f.claimed(), 0);
  assert.equal(f.page.listenerCount("request"), 0);
});

test("abort after durable claim finishes attention and never submits password", async () => {
  const f = fixture();
  const abort = new AbortController();
  const pending = Promise.withResolvers();
  const claim = Promise.withResolvers();
  const work = f.run({
    signal: abort.signal,
    claimAttempt: () => {
      claim.resolve();
      return pending.promise;
    },
  });
  await claim.promise;
  abort.abort();
  assert.deepEqual(await work, required("cancelled"));
  pending.resolve(true);
  await tick();
  assert.deepEqual(f.finishes, ["attention"]);
  assert.equal(f.events.includes("password_submit"), false);
});

test("deadline is bounded by 120s and holds the lock until stalled navigation settles", async () => {
  const pending = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const f = fixture({
    goto: () => {
      entered.resolve();
      return pending.promise;
    },
  });
  const work = f.run();
  await entered.promise;
  f.expire();
  assert.deepEqual(await work, required("deadline_exceeded"));
  assert.deepEqual(await f.run(), required("already_running"));
  pending.resolve(null);
  await tick();
  assert.equal(f.reading(), 0);
  assert.equal(f.page.listenerCount("request"), 0);
  assert.deepEqual(await f.run({ timeoutMs: 120_001 }), required("invalid_options"));
});

test("persistence/read/browser errors return only allowlisted results; no success if finish fails", async () => {
  for (const [name, expected] of [
    ["canAttempt", "attempt_state_unavailable"],
    ["claimAttempt", "attempt_state_unavailable"],
    ["credential", "credential_unavailable"],
    ["finishAttempt", "attempt_state_unavailable"],
  ]) {
    const f = fixture();
    assert.deepEqual(
      await f.run({
        [name]: async () => {
          throw new Error("synthetic-private-error");
        },
      }),
      required(expected),
    );
  }
  const f = fixture({
    evaluate: async () => {
      throw new Error("synthetic-private-error");
    },
  });
  assert.deepEqual(await f.run(), required("browser_login_unavailable"));
});

test("restart guard is external, mandatory, and attention blocks a second owner object", async () => {
  let state = "ready";
  const callbacks = {
    canAttempt: () => state === "ready",
    claimAttempt: () => {
      if (state !== "ready") return false;
      state = "pending";
      return true;
    },
    finishAttempt: (status) => {
      state = status;
    },
  };
  const first = fixture({ afterPassword: "rejected" });
  assert.deepEqual(await first.run(callbacks), required("credential_rejected"));
  assert.equal(state, "attention");
  const restarted = fixture({ initialPhase: "mfa" });
  assert.deepEqual(await restarted.run(callbacks), required("attempt_blocked"));
  assert.deepEqual(restarted.events, []);
  assert.equal(restarted.phase(), "mfa");
});

// The regular unit job has no Chromium installation. Opt in from a browser-capable
// job with QLIK_LOGIN_BROWSER_TEST=enabled; any browser/test failure then fails hard.
if (process.env.QLIK_LOGIN_BROWSER_TEST === "enabled")
  test(
    "isolated Chromium: Qlik SPA navigation and native Microsoft-shaped POST forms",
    { timeout: 30_000 },
    async (t) => {
      // Unhandled requests cannot leave the host, even if Chromium bypasses a route
      // on an HTTP redirect. Every fixture response and credential is synthetic.
      const browser = await chromium.launch({
        headless: true,
        proxy: { server: "http://127.0.0.1:9" },
      });
      try {
        for (const scenario of [
          "authenticated",
          "mfa",
          "rejected",
          "wrong_account",
          "nested_heading",
          "overlap_credential",
          "csrf_204",
        ]) {
          await t.test(scenario, async () => {
            const context = await browser.newContext({ serviceWorkers: "block" });
            try {
              const succeeds = [
                "authenticated",
                "nested_heading",
                "overlap_credential",
                "csrf_204",
              ].includes(scenario);
              const credential = scenario === "overlap_credential" ? SYNTHETIC_OVERLAP : SYNTHETIC;
              let passwordPosts = 0;
              let emailPosts = 0;
              let csrfCalls = 0;
              let externalRequests = 0;
              let authenticated = false;
              const finishes = [];
              const html = (body) => ({
                status: 200,
                contentType: "text/html",
                body: `<!doctype html><html><body>${body}</body></html>`,
              });
              const redirect = (path) =>
                html(
                  `<script>setTimeout(() => location.replace(${JSON.stringify(path)}), 50)</script>`,
                );
              await context.route("**/*", async (route) => {
                const request = route.request();
                const url = new URL(request.url());
                if (![QLIK, MS].includes(url.origin)) {
                  externalRequests++;
                  await route.abort("blockedbyclient");
                  return;
                }
                if (request.url() === `${QLIK}/`) {
                  await route.fulfill(redirect(`${QLIK}/login`));
                } else if (request.url() === `${QLIK}/login`) {
                  await route.fulfill(redirect(`${MS}/${TENANT}/saml2`));
                } else if (url.origin === QLIK && url.pathname === "/api/v1/csrf-token") {
                  csrfCalls++;
                  await route.fulfill({
                    status: authenticated ? (scenario === "csrf_204" ? 204 : 200) : 401,
                    headers: { "qlik-csrf-token": "synthetic-browser-only-csrf" },
                    body: "",
                  });
                } else if (url.origin === QLIK && url.pathname === "/insights/home") {
                  await route.fulfill(html("<main>synthetic Qlik</main>"));
                } else if (url.origin === MS && url.pathname === `/${TENANT}/saml2`) {
                  await route.fulfill(
                    html(
                      '<button id="otherTile" onclick="location.href=\'/username\'">Use another account</button>',
                    ),
                  );
                } else if (
                  url.origin === MS &&
                  url.pathname === "/username" &&
                  request.method() === "GET"
                ) {
                  await route.fulfill(
                    html(
                      '<form method="post" action="/username"><input id="i0116" name="loginfmt" type="email"><input id="i0118" name="passwd" type="password" autocomplete="current-password" style="display:none" value=""><input id="idSIButton9" type="submit" value="Next"></form>',
                    ),
                  );
                } else if (
                  url.origin === MS &&
                  url.pathname === "/username" &&
                  request.method() === "POST"
                ) {
                  emailPosts++;
                  assert.equal(
                    new URLSearchParams(request.postData()).get("loginfmt"),
                    credential.username,
                  );
                  assert.deepEqual(new URLSearchParams(request.postData()).getAll("passwd"), [""]);
                  await route.fulfill(redirect(`${MS}/password`));
                } else if (
                  url.origin === MS &&
                  url.pathname === "/password" &&
                  request.method() === "GET"
                ) {
                  const identity =
                    scenario === "wrong_account"
                      ? "other-synthetic@example.invalid"
                      : credential.username.toUpperCase();
                  await route.fulfill(
                    html(
                      `<div id="displayName">${identity}</div><form method="post" action="/password"><input id="i0118" name="passwd" type="password" autocomplete="current-password"><input id="idSIButton9" type="submit" value="Sign in"></form>`,
                    ),
                  );
                } else if (
                  url.origin === MS &&
                  url.pathname === "/password" &&
                  request.method() === "POST"
                ) {
                  passwordPosts++;
                  assert.equal(
                    new URLSearchParams(request.postData()).get("passwd"),
                    credential.password,
                  );
                  await route.fulfill(redirect(`${MS}/${succeeds ? "stay" : scenario}`));
                } else if (
                  url.origin === MS &&
                  url.pathname === "/stay" &&
                  request.method() === "GET"
                ) {
                  await route.fulfill(
                    html(
                      (scenario === "nested_heading"
                        ? '<div id="lightboxHeader"><h1 id="kmsiTitle" role="heading">Stay signed in?</h1></div>'
                        : '<h1 id="kmsiTitle">Stay signed in?</h1>') +
                        '<form method="post" action="/stay"><input id="idSIButton9" type="submit" value="Yes"></form>',
                    ),
                  );
                } else if (
                  url.origin === MS &&
                  url.pathname === "/stay" &&
                  request.method() === "POST"
                ) {
                  authenticated = true;
                  await route.fulfill(redirect(`${QLIK}/insights/home`));
                } else if (url.origin === MS && url.pathname === "/mfa") {
                  await route.fulfill(
                    html('<div id="idDiv_SAOTCC_Description">Synthetic MFA</div>'),
                  );
                } else if (url.origin === MS && url.pathname === "/rejected") {
                  await route.fulfill(html('<div id="passwordError">Synthetic rejection</div>'));
                } else {
                  externalRequests++;
                  await route.abort("blockedbyclient");
                }
              });
              const page = await context.newPage();
              const states = [];
              const evaluate = page.evaluate.bind(page);
              page.evaluate = async (fn, args) => {
                const value = await evaluate(fn, args);
                if (states.length < 20) states.push([args.action ?? "probe", value]);
                return value;
              };
              let claims = 0;
              const result = await renewBrowserLogin(context, {
                credential: () => ({ ...credential }),
                canAttempt: () => true,
                claimAttempt: () => {
                  claims++;
                  return true;
                },
                finishAttempt: (status) => {
                  finishes.push(status);
                },
                timeoutMs: 10_000,
                pollIntervalMs: 50,
              });
              assert.deepEqual(
                result,
                succeeds
                  ? { status: "authenticated" }
                  : required(
                      scenario === "mfa"
                        ? "mfa_required"
                        : scenario === "rejected"
                          ? "credential_rejected"
                          : "account_mismatch",
                    ),
                JSON.stringify({ emailPosts, passwordPosts, csrfCalls, states }),
              );
              assert.equal(emailPosts, 1);
              assert.equal(passwordPosts, scenario === "wrong_account" ? 0 : 1);
              assert.equal(claims, scenario === "wrong_account" ? 0 : 1);
              assert.ok(csrfCalls >= (succeeds ? 2 : 1));
              assert.equal(externalRequests, 0);
              assert.deepEqual(
                finishes,
                scenario === "wrong_account" ? [] : [succeeds ? "authenticated" : "attention"],
              );
              assert.equal(context.pages().length, 1);
              assert.equal(page.isClosed(), false);
              if (scenario === "mfa") {
                const urlBefore = page.url();
                assert.deepEqual(
                  await renewBrowserLogin(context, {
                    canAttempt: () => false,
                    claimAttempt: () => false,
                    finishAttempt: () => {},
                  }),
                  required("attempt_blocked"),
                );
                assert.equal(page.url(), urlBefore);
              }
            } finally {
              await context.close();
            }
          });
        }
      } finally {
        await browser.close();
      }
    },
  );
