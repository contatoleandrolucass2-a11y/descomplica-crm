import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ORIGIN = "https://direcional.us.qlikcloud.com";
const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const activeContexts = new WeakSet();
const usedIdentities = new Set();

function mappingJson(mapping) {
  function canonical(value, depth = 0) {
    if (depth > 16) throw new Error("ranking_mapping_invalid");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object") throw new Error("ranking_mapping_invalid");
    if (Object.getOwnPropertySymbols(value).length) throw new Error("ranking_mapping_invalid");
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, index) => {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        if (!entry || !("value" in entry)) throw new Error("ranking_mapping_invalid");
        return canonical(entry.value, depth + 1);
      });
    }
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new Error("ranking_mapping_invalid");
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          const entry = Object.getOwnPropertyDescriptor(value, key);
          if (!("value" in entry)) throw new Error("ranking_mapping_invalid");
          return [key, canonical(entry.value, depth + 1)];
        }),
    );
  }
  const result = canonical(mapping);
  if (result?.appId !== APP || result?.sheetId !== SHEET) throw new Error("ranking_mapping_scope");
  const text = JSON.stringify(result);
  if (Buffer.byteLength(text) > 65_536) throw new Error("ranking_mapping_limit");
  return text;
}

// Serialized into one dedicated page. Authentication material stays in that page.
export function createBrowserRankingClient(
  enigma,
  schema,
  collect,
  mapping,
  environment = globalThis,
) {
  const origin = "https://direcional.us.qlikcloud.com";
  const app = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
  const sheet = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
  let used = false;
  let cancel = () => {};
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const fixedMapping = freeze(mapping);

  async function run(identity) {
    if (used) return { status: "unavailable", reason: "session_already_used" };
    used = true;
    if (
      typeof identity !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(identity) ||
      fixedMapping?.appId !== app ||
      fixedMapping?.sheetId !== sheet ||
      typeof collect !== "function"
    )
      return { status: "unavailable", reason: "ranking_configuration" };
    if (environment.location.origin !== origin)
      return { status: "unavailable", reason: "unexpected_origin" };
    const abort = new environment.AbortController();
    let session;
    let socket;
    let stopped = false;
    let interrupted;
    let stopReason = "cancelled";
    const interruption = new Promise((resolve) => {
      interrupted = resolve;
    });
    const closeSocket = () => {
      try {
        socket?.close();
      } catch {
        /* Page disposal is the final boundary. */
      }
    };
    const stop = (reason = "cancelled") => {
      stopped = true;
      stopReason = reason;
      abort.abort();
      closeSocket();
      interrupted({ status: "unavailable", reason });
    };
    cancel = stop;
    const deadline = environment.setTimeout(() => stop("transport_timeout"), 180_000);
    const work = async () => {
      const response = await environment.fetch(`${origin}/api/v1/csrf-token`, {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        signal: abort.signal,
      });
      if (stopped) throw new Error();
      if (response.status === 401) return { status: "reauth_required" };
      if (response.status === 403) return { status: "unavailable", reason: "access_denied" };
      if (!response.ok) return { status: "unavailable", reason: "source_unavailable" };
      const csrf = response.headers.get("qlik-csrf-token");
      if (typeof csrf !== "string" || !/^[\x21-\x7e]{16,2048}$/.test(csrf))
        return { status: "unavailable", reason: "csrf_unavailable" };
      const url = new environment.URL(
        `wss://direcional.us.qlikcloud.com/app/${app}/identity/${identity}`,
      );
      url.searchParams.set("qlik-csrf-token", csrf);
      session = enigma.create({
        schema,
        url: url.href,
        suspendOnClose: false,
        createSocket: (target) => {
          if (stopped || socket || target !== url.href) throw new Error();
          socket = new environment.WebSocket(target);
          return socket;
        },
      });
      const global = await session.open();
      if (stopped) throw new Error();
      const result = await collect(global, { signal: abort.signal, mapping: fixedMapping });
      if (stopped) throw new Error();
      if (result?.status === "reauth_required") return { status: "reauth_required" };
      if (result?.status !== "collected")
        return { status: "unavailable", reason: "collection_unavailable" };
      // The cycle validates the aggregate contract. Never forward arbitrary status details.
      return {
        status: "collected",
        source: result.source,
        scope: result.scope,
        months: result.months,
      };
    };
    try {
      return await Promise.race([work(), interruption]);
    } catch {
      return { status: "unavailable", reason: stopped ? stopReason : "engine_unavailable" };
    } finally {
      stopped = true;
      abort.abort();
      environment.clearTimeout(deadline);
      closeSocket();
      try {
        if (session) void Promise.resolve(session.close()).catch(() => {});
      } catch {
        /* Redacted. */
      }
      cancel = () => {};
      // Single-use even if a cancelled callback remains pending until the page is closed.
    }
  }
  return Object.freeze({ run, cancel: () => cancel() });
}

export async function getBrowserRankingScript({ mapping, collect } = {}) {
  const text = mappingJson(mapping);
  const collector = collect ?? (await import("./qix-ranking.mjs")).collectQlikRanking;
  if (typeof collector !== "function") throw new Error("ranking_collector_unavailable");
  const sdk = await readFile(require.resolve("enigma.js/enigma.min.js"), "utf8");
  const schema = JSON.parse(
    await readFile(require.resolve("enigma.js/schemas/12.612.0.json"), "utf8"),
  );
  return `(() => {
    if (location.origin !== ${JSON.stringify(ORIGIN)} ||
        Object.prototype.hasOwnProperty.call(window, "__descomplicaQlikRankingV1"))
      throw new Error("qlik_ranking_context_rejected");
    const module = { exports: {} }; const exports = module.exports;
    ${sdk}
    const collect = (${collector.toString()});
    const create = (${createBrowserRankingClient.toString()});
    const mapping = JSON.parse(${JSON.stringify(text)});
    Object.defineProperty(window, "__descomplicaQlikRankingV1", {
      value: create(module.exports, ${JSON.stringify(schema)}, collect, mapping),
      configurable: false, writable: false, enumerable: false
    });
  })();`;
}

export async function collectBrowserRanking(
  context,
  { signal, identity, mapping, collect, timers = globalThis, onOwnerUnrecoverable } = {},
) {
  const unavailable = (reason) => ({ status: "unavailable", reason });
  if (signal?.aborted) return unavailable("cancelled");
  if (
    !(signal instanceof AbortSignal) ||
    typeof identity !== "string" ||
    !UUID.test(identity) ||
    !context ||
    typeof context.newPage !== "function" ||
    (onOwnerUnrecoverable !== undefined && typeof onOwnerUnrecoverable !== "function")
  )
    return unavailable("ranking_configuration");
  if (activeContexts.has(context)) return unavailable("already_running");
  if (usedIdentities.has(identity)) return unavailable("identity_reused");
  activeContexts.add(context);
  usedIdentities.add(identity);
  let page;
  let creation;
  let closing;
  let discarding = false;
  let timedOut = false;
  let result;
  const interrupted = Promise.withResolvers();
  const stopped = Symbol("ranking_stopped");
  const close = () => {
    if (page && !closing) {
      closing = Promise.resolve()
        .then(() => page.close())
        .then(
          () => true,
          () => false,
        );
    }
    return closing;
  };
  const cancelled = () => signal.aborted || timedOut;
  const stop = () => {
    interrupted.resolve(stopped);
    void close();
  };
  async function bounded(action) {
    if (cancelled()) throw stopped;
    const value = await Promise.race([Promise.resolve().then(action), interrupted.promise]);
    if (value === stopped || cancelled()) throw stopped;
    return value;
  }
  signal.addEventListener("abort", stop, { once: true });
  const deadline = timers.setTimeout(() => {
    timedOut = true;
    stop();
  }, 180_000);
  if (signal.aborted) stop();
  let disposed = false;
  try {
    const script = await bounded(() => getBrowserRankingScript({ mapping, collect }));
    await bounded(() => {
      creation = Promise.resolve()
        .then(() => context.newPage())
        .then((created) => {
          page = created;
          // Even after a cleanup timeout, a late page remains owned by this call.
          if (discarding || cancelled()) void close();
          return page;
        });
      return creation;
    });
    await bounded(() =>
      page.goto(`${ORIGIN}/insights/home`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      }),
    );
    if (new URL(page.url()).origin !== ORIGIN) result = { status: "reauth_required" };
    else {
      // CSP remains enforced; never attach CDP or export browser authentication state.
      await bounded(() => page.addScriptTag({ content: script }));
      result = await bounded(() =>
        page.evaluate((id) => window.__descomplicaQlikRankingV1.run(id), identity),
      );
    }
  } catch {
    result = unavailable("browser_ranking_unavailable");
  } finally {
    discarding = true;
    timers.clearTimeout(deadline);
    let cleanupTimer;
    const cleanup = async () => {
      // A rejected creation owns no page; a pending creation must settle before reuse.
      await creation?.catch(() => {});
      return page ? await close() : true;
    };
    try {
      disposed = await Promise.race([
        cleanup(),
        new Promise((resolve) => {
          cleanupTimer = timers.setTimeout(() => resolve(false), 5_000);
        }),
      ]);
    } finally {
      timers.clearTimeout(cleanupTimer);
      signal.removeEventListener("abort", stop);
    }
    if (disposed) activeContexts.delete(context);
  }
  if (!disposed) {
    // Only the Linux owner opts into process termination; libraries/tests never exit by default.
    try {
      void Promise.resolve(onOwnerUnrecoverable?.("page_disposal_unconfirmed")).catch(() => {});
    } catch {
      // Keep the context quarantined even when the owner callback fails.
    }
    return unavailable("page_disposal_unconfirmed");
  }
  if (cancelled()) return unavailable(timedOut ? "transport_timeout" : "cancelled");
  return result;
}
