import { createServer } from "node:http";
import { isDeepStrictEqual } from "node:util";

import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";
import { check, loopbackOrigin } from "./concurrent-core.mjs";

export const inventoryIsolationContract = "local-synthetic-upstream-v1";
const referenceInventoryUrl = "https://descomplicapro.com.br/api/inventory";

export function assertLocalQaEnvironment(environment = process.env) {
  check(
    !environment.HOMOLOGATION_MODE &&
      !environment.QA_E2E_REMOTE_HOMOLOGATION &&
      !environment.QA_SUPABASE_WORKDIR &&
      !environment.QA_RELEASE_PERSIST_ACCOUNTS_FILE,
    "local_ci_only",
  );
}

export async function startSyntheticInventoryUpstream() {
  const snapshot = JSON.parse(buildSyntheticDirectTableQaSnapshot());
  const body = JSON.stringify({
    ...snapshot,
    sourceKind: "live",
    generatedAt: new Date().toISOString(),
  });
  let requests = 0;
  const server = createServer((request, response) => {
    if (request.url !== "/api/inventory" || request.method !== "GET") {
      response.writeHead(404).end();
      return;
    }
    requests += 1;
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  check(address && typeof address !== "string", "synthetic_upstream_bind_failed");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    contract: inventoryIsolationContract,
    requestCount: () => requests,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

export async function verifySyntheticInventoryUpstream(origin, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${loopbackOrigin(origin)}/api/inventory`, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  check(response.status === 200, "synthetic_upstream_unavailable");
  const payload = await response.json();
  const expected = JSON.parse(buildSyntheticDirectTableQaSnapshot());
  check(
    payload.sourceKind === "live" &&
      payload.qaFixture?.synthetic === true &&
      payload.count === expected.count &&
      isDeepStrictEqual(payload.items, expected.items),
    "upstream_not_synthetic",
  );
}

// Installed only by the local QA server's --import. Routes, auth, denial responses
// and Next's inventory cache still execute normally. Only the external feed is
// replaced; the legacy Playwright suite keeps its real /api/inventory probes.
export function createQaInventoryFetch({
  appOrigin,
  supabaseOrigin,
  upstreamOrigin,
  fetchImpl = globalThis.fetch,
}) {
  const approvedOrigins = new Set([appOrigin, supabaseOrigin, upstreamOrigin].map(loopbackOrigin));
  return async (input, init = {}) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? input : input.url;
    const url = new URL(rawUrl);
    check(!url.username && !url.password, "qa_fetch_url_credentials");
    const target =
      url.href === referenceInventoryUrl ? `${upstreamOrigin}/api/inventory` : url.href;
    check(approvedOrigins.has(new URL(target).origin), "qa_fetch_nonlocal_blocked");
    if (url.href === referenceInventoryUrl) {
      check(
        (init.method ?? input.method ?? "GET").toUpperCase() === "GET",
        "qa_inventory_method_blocked",
      );
      return fetchImpl(target, {
        method: "GET",
        redirect: "error",
        signal: init.signal ?? input.signal ?? AbortSignal.timeout(20_000),
        headers: { accept: "application/json" },
      });
    }
    // A local redirect must not provide a second route to an external origin.
    return fetchImpl(input, { ...init, redirect: "error" });
  };
}
