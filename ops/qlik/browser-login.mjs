const QLIK = "https://direcional.us.qlikcloud.com";
const MICROSOFT = "https://login.microsoftonline.com";
const TENANT = "8c139cd3-f1d3-4761-a3b9-076a7d958d19";
const active = new WeakSet();
const timersDefault = { setTimeout, clearTimeout };

async function readLoginCredential(options) {
  const reader = await import("./login-credential.mjs");
  return reader.readLoginCredential(options);
}

function required(reason) {
  const unavailable = new Set([
    "invalid_options",
    "already_running",
    "cancelled",
    "deadline_exceeded",
    "browser_login_unavailable",
    "attempt_state_unavailable",
  ]);
  return Object.freeze({
    status: unavailable.has(reason) ? "unavailable" : "reauth_required",
    reason,
  });
}

class Stopped extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function urlAt(value, origin) {
  try {
    const url = new URL(value);
    return url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

function navigationChanged(error) {
  return /Execution context was destroyed|Cannot find context with specified id/.test(
    error?.message ?? "",
  );
}

// Runs in the existing main frame. Recheck DOM and destination atomically with
// each entry/submission; return only fixed state codes, never page text or values.
function loginStep({ action, value, expectedUsername, expiresAt }) {
  const microsoft = "https://login.microsoftonline.com";
  if (Date.now() >= expiresAt) return "deadline_exceeded";
  if (location.origin !== microsoft) return "unexpected_origin";
  const visibleNodes = (selector) =>
    [...document.querySelectorAll(selector)].filter(
      (node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden",
    );
  const visible = (selector) => {
    const nodes = visibleNodes(selector);
    return nodes.length === 1 ? nodes[0] : null;
  };
  const email = visible('#i0116[name="loginfmt"][type="email"]');
  const password = visible(
    '#i0118[name="passwd"][type="password"][autocomplete="current-password"]',
  );
  if (password && expectedUsername) {
    const expected = expectedUsername.trim().toLowerCase();
    const identities = [
      ...document.querySelectorAll('input[name="loginfmt"], input[name="login"], #displayName'),
    ]
      .map((node) => (node.value ?? node.textContent ?? "").trim().toLowerCase())
      .filter(Boolean);
    if (identities.some((identity) => identity !== expected)) return "account_mismatch";
  }
  const submit = visible("#idSIButton9");
  const other = visible("#otherTile");
  // Microsoft can expose both the title and its enclosing header as headings.
  const headingTexts = new Set(
    visibleNodes('#kmsiTitle, #lightboxHeader, [role="heading"]')
      .map((node) => node.textContent?.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  );
  const stay =
    headingTexts.size === 1 &&
    new Set([
      "Stay signed in?",
      "Continuar conectado?",
      "Permanecer conectado?",
      "Manter-se conectado?",
    ]).has([...headingTexts][0]);
  if (document.querySelector('#captcha, #captchaIframe, input[name="captcha"]'))
    return "captcha_required";
  if (
    document.querySelector(
      '#idDiv_SAOTCS_Proofs, #idDiv_SAOTCC_Description, #idDiv_SAOTCAS_Description, #idTxtBx_SAOTCC_OTC, input[name="otc"]',
    )
  )
    return "mfa_required";
  if (["#usernameError", "#passwordError", "#errorText"].some((selector) => visible(selector)))
    return "credential_rejected";
  const state = email
    ? "username"
    : password
      ? "password"
      : stay
        ? "stay"
        : other
          ? "other"
          : "unknown";
  if (action === "inspect") return state;
  if (action !== state) return "state_changed";
  if (action === "other") {
    other.click();
    return "acted";
  }
  const input = action === "username" ? email : action === "password" ? password : null;
  const form = input?.form ?? submit?.form;
  if (!form || !submit || submit.disabled || submit.form !== form || input?.disabled)
    return "unsafe_form";
  const safeDestination = () => {
    const destination = new URL(submit.getAttribute("formaction") ?? form.action, location.href);
    const method = submit.getAttribute("formmethod") ?? form.method;
    const target = submit.getAttribute("formtarget") ?? form.target;
    return (
      destination.origin === microsoft &&
      !destination.username &&
      !destination.password &&
      method.toLowerCase() === "post" &&
      (!target || target === "_self") &&
      location.origin === microsoft &&
      Date.now() < expiresAt
    );
  };
  if (!safeDestination()) return "unsafe_form";
  if (action === "stay") {
    const label = (submit.value || submit.textContent || "").trim();
    if (!["Yes", "Sim"].includes(label)) return "unsafe_form";
  } else {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (!safeDestination() || input.form !== form) return "unsafe_form";
  }
  submit.click();
  return "acted";
}

// The CSRF token is consumed and validated only in the browser, not returned to Node.
// Qlik documents 204 with the token header; 200 remains an explicit compatibility case.
// https://qlik.dev/apis/rest/csrf-token/
async function probeSession({ timeoutMs }) {
  const origin = "https://direcional.us.qlikcloud.com";
  if (location.origin !== origin) return false;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/v1/csrf-token`, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal: abort.signal,
    });
    return (
      location.origin === origin &&
      (response.status === 204 || response.status === 200) &&
      response.url === `${origin}/api/v1/csrf-token` &&
      !response.redirected &&
      /^[\x21-\x7e]{16,2048}$/.test(response.headers.get("qlik-csrf-token") ?? "")
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uses a single existing owner page. The owner must disable tracing, HAR, video,
 * screenshots and protocol/debug logging; this module never enables capture.
 * credential({signal}) -> {username,password}, loaded only after trusted redirect.
 * canAttempt() -> boolean, read-only check before touching the owner's page.
 * claimAttempt() -> true ONLY after an atomic durable private claim, immediately
 * before the one password submission. finishAttempt("authenticated"|"attention")
 * persists the outcome. These callbacks receive no account or credential values.
 * All three callbacks are mandatory for reauthentication. Persist only last-attempt
 * time and pending/outcome: no usernames, password hashes or automatic reset of a
 * failed/incomplete attempt. Only proven authentication clears that block.
 * Callbacks must settle cooperatively. Cancellation returns promptly but keeps the
 * in-process lock until pending work and finalization settle, preventing overlap.
 * A proven existing Qlik session is checked before any state gate or navigation;
 * it also finishes "authenticated", allowing manual recovery to clear attention.
 * Results: {status:"authenticated"} or
 * {status:"reauth_required"|"unavailable",reason:<fixed code>}.
 */
export async function renewBrowserLogin(
  browser,
  {
    signal,
    credential = readLoginCredential,
    canAttempt,
    claimAttempt,
    finishAttempt,
    timeoutMs = 120_000,
    pollIntervalMs = 200,
    clock = () => performance.now(),
    timers = timersDefault,
  } = {},
) {
  if (
    !browser ||
    typeof browser.pages !== "function" ||
    (signal !== undefined && !(signal instanceof AbortSignal)) ||
    typeof credential !== "function" ||
    typeof clock !== "function" ||
    typeof timers?.setTimeout !== "function" ||
    typeof timers?.clearTimeout !== "function" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 120_000 ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs <= 0 ||
    pollIntervalMs > 1_000
  )
    return required("invalid_options");
  if (active.has(browser)) return required("already_running");
  if (signal?.aborted) return required("cancelled");
  active.add(browser);
  const abort = new AbortController();
  let stopReason;
  const interrupted = Promise.withResolvers();
  const stop = (reason) => {
    stopReason ??= reason;
    abort.abort();
    interrupted.resolve(required(stopReason));
  };
  const onAbort = () => stop("cancelled");
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = timers.setTimeout(() => stop("deadline_exceeded"), timeoutMs);

  const run = async () => {
    let page;
    let requestListener;
    let navigationListener;
    let routeHandler;
    let claimed = false;
    let finished = false;
    let secrets;
    let outcome;
    let trusted = false;
    let qlikDocumentSeen = false;
    let routeFailure;
    let passwordPosts = 0;
    let started;
    const remaining = () => {
      const elapsed = clock() - started;
      if (!Number.isFinite(elapsed) || elapsed < 0) throw new Stopped("invalid_options");
      return Math.max(0, timeoutMs - elapsed);
    };
    const check = () => {
      if (stopReason) throw new Stopped(stopReason);
      if (remaining() <= 0) throw new Stopped("deadline_exceeded");
      const pages = browser.pages();
      if (pages.length !== 1 || (page && pages[0] !== page))
        throw new Stopped("target_page_ambiguous");
      if (routeFailure) throw new Stopped(routeFailure);
    };
    const step = async (action, value) => {
      check();
      if (!trusted || !urlAt(page.url(), MICROSOFT)) throw new Stopped("untrusted_redirect");
      let result;
      try {
        result = await page.evaluate(loginStep, {
          action,
          ...(value === undefined ? {} : { value }),
          ...(secrets ? { expectedUsername: secrets.username } : {}),
          expiresAt: Date.now() + remaining(),
        });
      } catch (error) {
        if (!navigationChanged(error)) throw error;
        // Never retry an entry/submission after navigation destroyed its context.
        result = action === "inspect" ? "unknown" : "navigation_pending";
      }
      check();
      return result;
    };
    const probe = async () => {
      try {
        const valid = await page.evaluate(probeSession, {
          timeoutMs: Math.min(5_000, remaining()),
        });
        check();
        return valid === true && urlAt(page.url(), QLIK);
      } catch (error) {
        check();
        if (!navigationChanged(error)) throw error;
        return false;
      }
    };
    const pause = async () => {
      check();
      await new Promise((resolve) => {
        const finish = () => {
          timers.clearTimeout(wait);
          abort.signal.removeEventListener("abort", finish);
          resolve();
        };
        const wait = timers.setTimeout(finish, Math.min(pollIntervalMs, remaining()));
        abort.signal.addEventListener("abort", finish, { once: true });
        if (abort.signal.aborted) finish();
      });
      check();
    };
    try {
      started = clock();
      check();
      page = browser.pages()[0];
      if (urlAt(page.url(), QLIK)) {
        if (await probe()) {
          outcome = Object.freeze({ status: "authenticated" });
          if (typeof finishAttempt === "function") {
            try {
              await finishAttempt("authenticated");
              finished = true;
            } catch {
              throw new Stopped("attempt_state_unavailable");
            }
          }
          check();
          return outcome;
        }
      }
      if (
        typeof canAttempt !== "function" ||
        typeof claimAttempt !== "function" ||
        typeof finishAttempt !== "function"
      )
        throw new Stopped("attempt_state_unavailable");
      try {
        if ((await canAttempt()) !== true) throw new Stopped("attempt_blocked");
      } catch (error) {
        throw new Stopped(error instanceof Stopped ? error.reason : "attempt_state_unavailable");
      }
      check();
      requestListener = (request) => {
        try {
          if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
          const tenantUrl = new URL(request.url());
          if (
            !urlAt(tenantUrl.href, MICROSOFT) ||
            tenantUrl.pathname.toLowerCase() !== `/${TENANT}/saml2`
          )
            return;
          // SPA location changes are navigation requests, not HTTP redirect chains.
          // Trust only a main-frame departure from a loaded fixed-origin document.
          if (qlikDocumentSeen && urlAt(page.url(), QLIK)) {
            trusted = true;
            return;
          }
          let current = request;
          for (let count = 0; current && count < 20; count++) {
            if (!urlAt(current.url(), QLIK) && !urlAt(current.url(), MICROSOFT)) return;
            if (current.method() !== "GET") return;
            const previous = current.redirectedFrom();
            if (!previous) {
              if (urlAt(current.url(), QLIK) && count > 0) trusted = true;
              return;
            }
            current = previous;
          }
        } catch {
          // An unprovable chain never grants trust.
        }
      };
      page.on("request", requestListener);
      navigationListener = (frame) => {
        if (frame === page.mainFrame()) qlikDocumentSeen = urlAt(frame.url(), QLIK);
      };
      page.on("framenavigated", navigationListener);
      routeHandler = async (route) => {
        try {
          const request = route.request();
          const body = request.postData() ?? "";
          const text = `${request.url()}\n${body}`;
          const contains = (value) =>
            [
              value,
              encodeURIComponent(value),
              new URLSearchParams({ v: value }).toString().slice(2),
            ].some((part) => part && text.includes(part));
          const hasPassword = secrets && contains(secrets.password);
          const hasCredential = hasPassword || (secrets && contains(secrets.username));
          if (
            hasCredential &&
            (!trusted || !urlAt(request.url(), MICROSOFT) || request.method() !== "POST")
          )
            routeFailure = "unsafe_form";
          const passwordFields = new URLSearchParams(body).getAll("passwd");
          const isPasswordSubmission =
            secrets &&
            request.method() === "POST" &&
            passwordFields.length === 1 &&
            passwordFields[0] !== "" &&
            passwordFields[0] === secrets.password;
          if (
            secrets &&
            request.method() === "POST" &&
            passwordFields.length > 1 &&
            passwordFields.includes(secrets.password)
          )
            routeFailure = "credential_rejected";
          if (isPasswordSubmission && ++passwordPosts > 1) routeFailure = "credential_rejected";
          if (stopReason || routeFailure) await route.abort("blockedbyclient");
          else await route.fallback();
        } catch {
          routeFailure = "browser_login_unavailable";
          await route.abort("blockedbyclient").catch(() => {});
        }
      };
      await page.route("**/*", routeHandler);
      check();
      const response = await page.goto(`${QLIK}/`, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(30_000, remaining()),
      });
      if (response) requestListener(response.request());
      check();
      let usernameEntered = false;
      let passwordSubmitted = false;
      let otherClicked = false;
      let stayClicked = false;
      let lastActionAt = clock();
      let probedUrl;
      while (true) {
        check();
        const current = page.url();
        if (urlAt(current, QLIK)) {
          if (probedUrl !== current) {
            probedUrl = current;
            if (await probe()) {
              outcome = Object.freeze({ status: "authenticated" });
              break;
            }
            if (passwordSubmitted) throw new Stopped("csrf_probe_failed");
          }
        } else {
          if (!urlAt(current, MICROSOFT)) throw new Stopped("unexpected_origin");
          if (!trusted) throw new Stopped("untrusted_redirect");
          const state = await step("inspect");
          if (
            [
              "mfa_required",
              "captcha_required",
              "credential_rejected",
              "account_mismatch",
            ].includes(state)
          )
            throw new Stopped(state);
          if (state === "password" && !usernameEntered) throw new Stopped("unknown_account");
          let action;
          let value;
          if (state === "other" && !otherClicked && !usernameEntered) {
            otherClicked = true;
            action = "other";
          } else if (state === "username" && !usernameEntered) {
            try {
              secrets = await credential({ signal: abort.signal });
            } catch {
              throw new Stopped("credential_unavailable");
            }
            check();
            if (
              typeof secrets?.username !== "string" ||
              !secrets.username.trim() ||
              secrets.username.length > 320 ||
              typeof secrets?.password !== "string" ||
              !secrets.password ||
              secrets.password.length > 4096
            )
              throw new Stopped("credential_unavailable");
            usernameEntered = true;
            action = "username";
            value = secrets.username;
          } else if (state === "password" && usernameEntered && !passwordSubmitted) {
            try {
              claimed = (await claimAttempt()) === true;
            } catch {
              throw new Stopped("attempt_state_unavailable");
            }
            check();
            if (!claimed) throw new Stopped("attempt_blocked");
            passwordSubmitted = true;
            action = "password";
            value = secrets.password;
          } else if (state === "stay" && passwordSubmitted && !stayClicked) {
            stayClicked = true;
            action = "stay";
          }
          if (action) {
            const result = await step(action, value);
            if (!["acted", "navigation_pending"].includes(result))
              throw new Stopped(
                ["unsafe_form", "account_mismatch"].includes(result)
                  ? result
                  : "unknown_login_state",
              );
            lastActionAt = clock();
          }
        }
        if (clock() - lastActionAt >= 10_000) throw new Stopped("unknown_login_state");
        await pause();
      }
    } catch (error) {
      outcome = required(
        error instanceof Stopped ? error.reason : (stopReason ?? "browser_login_unavailable"),
      );
    } finally {
      if (!finished && (claimed || outcome?.status === "authenticated")) {
        try {
          await finishAttempt(outcome?.status === "authenticated" ? "authenticated" : "attention");
        } catch {
          outcome = required("attempt_state_unavailable");
        }
      }
      if (requestListener) page.removeListener("request", requestListener);
      if (navigationListener) page.removeListener("framenavigated", navigationListener);
      if (routeHandler) {
        try {
          await page.unroute("**/*", routeHandler);
        } catch {
          outcome = required("browser_login_unavailable");
        }
      }
      secrets = undefined;
    }
    return outcome;
  };
  // A timed-out Playwright call may still settle later. Keep ownership until then;
  // all continuations recheck cancellation before any credential side effect.
  const work = run()
    .catch(() => required("browser_login_unavailable"))
    .finally(() => {
      timers.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      active.delete(browser);
    });
  if (signal?.aborted) onAbort();
  return Promise.race([work, interrupted.promise]);
}
