import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { inspectQlikRankingMetadata } from "./qix-metadata.mjs";

const require = createRequire(import.meta.url);
const ORIGIN = "https://direcional.us.qlikcloud.com";
const SLOT = "__descomplicaQlikMetadataV1";

// Runs only as the application's fixed API client inside its own browser context.
// Browser-managed authentication and CSRF never cross this function's boundary.
export function createBrowserMetadataClient(enigma, schema, inspect, environment = globalThis) {
  const origin = "https://direcional.us.qlikcloud.com";
  const appId = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
  let running = false;
  let cancel = () => {};

  async function run() {
    if (running) return { status: "unavailable", reason: "already_running" };
    if (environment.location.origin !== origin)
      return { status: "unavailable", reason: "unexpected_origin" };
    running = true;
    const abort = new environment.AbortController();
    let session;
    let socket;
    let stopped = false;
    let deadline;
    let rejectStopped;
    const interrupted = new Promise((_, reject) => {
      rejectStopped = reject;
    });
    const stop = () => {
      stopped = true;
      abort.abort();
      if (socket) socket.close();
      rejectStopped(new Error("preflight_stopped"));
    };
    cancel = stop;
    deadline = environment.setTimeout(stop, 60_000);
    const work = async () => {
      const response = await environment.fetch(`${origin}/api/v1/csrf-token`, {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        signal: abort.signal,
      });
      if (response.status === 401) return { status: "reauth_required" };
      if (response.status === 403) return { status: "unavailable", reason: "access_denied" };
      if (!response.ok) return { status: "unavailable", reason: "source_unavailable" };
      const csrf = response.headers.get("qlik-csrf-token");
      if (typeof csrf !== "string" || !/^[\x21-\x7e]{16,2048}$/.test(csrf))
        return { status: "unavailable", reason: "csrf_unavailable" };
      if (stopped) throw new Error("preflight_stopped");
      const url = new environment.URL(
        `wss://direcional.us.qlikcloud.com/app/${appId}/identity/descomplica-ranking-metadata-v1`,
      );
      url.searchParams.set("qlik-csrf-token", csrf);
      session = enigma.create({
        schema,
        url: url.href,
        suspendOnClose: false,
        createSocket: (target) => {
          if (stopped || target !== url.href) throw new Error("preflight_stopped");
          socket = new environment.WebSocket(target);
          return socket;
        },
      });
      const global = await session.open();
      if (stopped) throw new Error("preflight_stopped");
      return await inspect(global, { signal: abort.signal });
    };
    const active = work();
    try {
      return await Promise.race([active, interrupted]);
    } catch (error) {
      let reason = "engine_unavailable";
      let limit;
      if (!stopped && !abort.signal.aborted) {
        try {
          // Own data descriptors only; never getters, messages or SDK payloads.
          const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
          if (
            typeof code === "string" &&
            [
              "qix_invalid_metadata",
              "qix_metadata_limit",
              "qix_invalid_sdk",
              "qix_request_failed",
              "qix_scope_mismatch",
              "qix_metadata_cycle",
              "qix_duplicate_object",
              "qix_invalid_reload_time",
              "qix_aborted",
              "qix_metadata_failed",
              "qix_cleanup_failed",
            ].includes(code)
          ) {
            reason = code;
            if (code === "qix_metadata_limit") {
              const detail = Object.getOwnPropertyDescriptor(error, "limit")?.value;
              const read = (key) => Object.getOwnPropertyDescriptor(detail, key)?.value;
              const stage = read("stage");
              const kind = read("kind");
              const observed = read("observed");
              const maximum = read("maximum");
              const maxima = {
                array_items: [16, 32, 64, 128, 512, 10_000, 131_071],
                string_length: [256, 4096],
                text_budget: [65_536],
                definition_bytes: [262_144, 524_288],
                definition_depth: [32, 34],
                tree_depth: [8],
                tree_nodes: [128],
                references: [512],
                master_definitions: [64],
                catalog_items: [10_000],
                catalog_fields: [256],
                result_bytes: [262_144],
                artifact_bytes: [131_072],
              };
              if (
                [
                  "property_tree",
                  "reachability",
                  "candidate",
                  "container",
                  "master_plan",
                  "measure_catalog",
                  "field_catalog",
                  "master_definitions",
                  "named_measures",
                  "variables",
                  "output",
                ].includes(stage) &&
                typeof kind === "string" &&
                Object.hasOwn(maxima, kind) &&
                maxima[kind].includes(maximum) &&
                Number.isSafeInteger(observed) &&
                observed > maximum
              )
                limit = { stage, kind, observed, maximum };
            }
          }
        } catch {
          // Uninspectable details never replace the fixed diagnostic or escape this boundary.
        }
      }
      return {
        status: "unavailable",
        reason: stopped || abort.signal.aborted ? "cancelled" : reason,
        ...(!stopped && !abort.signal.aborted && limit ? { limit } : {}),
      };
    } finally {
      stopped = true;
      abort.abort();
      environment.clearTimeout(deadline);
      if (socket) socket.close();
      // The owner closes the dedicated page after this result, including stalled engines.
      if (session) void session.close().catch(() => {});
      cancel = () => {};
      running = false;
    }
  }
  return Object.freeze({ run, cancel: () => cancel() });
}

let source;
export async function getBrowserMetadataScript() {
  if (!source) {
    source = Promise.all([
      readFile(require.resolve("enigma.js/enigma.min.js"), "utf8"),
      readFile(require.resolve("enigma.js/schemas/12.612.0.json"), "utf8"),
    ]).then(([sdk, schemaText]) => {
      const schema = JSON.parse(schemaText);
      return `(() => {
        if (location.origin !== ${JSON.stringify(ORIGIN)} ||
            Object.prototype.hasOwnProperty.call(window, ${JSON.stringify(SLOT)}))
          throw new Error("qlik_preflight_context_rejected");
        const module = { exports: {} }; const exports = module.exports;
        ${sdk}
        const inspect = ${inspectQlikRankingMetadata.toString()};
        const create = ${createBrowserMetadataClient.toString()};
        Object.defineProperty(window, ${JSON.stringify(SLOT)}, {
          value: create(module.exports, ${JSON.stringify(schema)}, inspect),
          configurable: false, writable: false, enumerable: false
        });
      })();`;
    });
  }
  return source;
}

export async function collectBrowserMetadata(browser, { signal } = {}) {
  if (signal?.aborted) return { status: "unavailable", reason: "cancelled" };
  const page = await browser.newPage();
  const close = () => void page.close().catch(() => {});
  signal?.addEventListener("abort", close, { once: true });
  try {
    if (signal?.aborted) return { status: "unavailable", reason: "cancelled" };
    await page.goto(`${ORIGIN}/insights/home`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (new URL(page.url()).origin !== ORIGIN) return { status: "reauth_required" };
    if (signal?.aborted) return { status: "unavailable", reason: "cancelled" };
    // addScriptTag respects the site's CSP. No bypassCSP, CDP attach or session export.
    await page.addScriptTag({ content: await getBrowserMetadataScript() });
    return await page.evaluate(() => window.__descomplicaQlikMetadataV1.run());
  } catch {
    return {
      status: "unavailable",
      reason: signal?.aborted ? "cancelled" : "browser_preflight_unavailable",
    };
  } finally {
    signal?.removeEventListener("abort", close);
    await page.close().catch(() => {});
  }
}
