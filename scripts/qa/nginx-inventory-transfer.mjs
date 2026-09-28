import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer, request } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";

const template = await readFile(
  "deploy/nginx/crm.descomplicapro.com.br.https.conf.example",
  "utf8",
);
const blocks = [
  ...template.matchAll(/# BEGIN inventory-transfer\r?\n([\s\S]+?)\s*# END inventory-transfer/gu),
];
assert.equal(blocks.length, 1, "Expected exactly one production inventory location.");
const payload = Buffer.from(
  JSON.stringify({
    count: 3301,
    items: Array.from({ length: 3301 }, (_, index) => ({
      id: `synthetic-${index}`,
      project: `QA ${index % 6}`,
      price: 230000 + index,
      description: "Synthetic inventory transfer fixture. ".repeat(20),
    })),
  }),
);
const digest = (body) => createHash("sha256").update(body).digest("hex");
const expectedHash = digest(payload);
const temporary = await mkdtemp(path.join(os.tmpdir(), "crm-nginx-transfer-"));
const upstream = createServer((incoming, response) => {
  if (incoming.headers.authorization !== "Bearer synthetic-qa") {
    response.writeHead(401, {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
    });
    response.end('{"error":"unauthorized"}');
    return;
  }
  response.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store, max-age=0",
  });
  response.end(payload);
});
let nginx;
let proxyPort;
let diagnostic = "";

function get(route, encoding = "gzip", authorized = true) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = request(
      {
        hostname: "127.0.0.1",
        port: proxyPort,
        path: route,
        method: "GET",
        headers: {
          "accept-encoding": encoding,
          ...(authorized ? { authorization: "Bearer synthetic-qa" } : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
            durationMs: performance.now() - started,
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(10_000, () => req.destroy(new Error("Synthetic transfer timed out.")));
    req.end();
  });
}

try {
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  proxyPort = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const block = blocks[0][1].replace(
    "proxy_pass http://127.0.0.1:3000;",
    `proxy_pass http://127.0.0.1:${upstream.address().port};`,
  );
  assert.ok(!block.includes("127.0.0.1:3000"));
  const config = path.join(temporary, "nginx.conf");
  await writeFile(
    config,
    `pid ${temporary}/nginx.pid;\nerror_log stderr warn;\nevents { worker_connections 128; }\nhttp { access_log off; server { listen 127.0.0.1:${proxyPort}; ${block} location / { return 404; } } }\n`,
  );
  nginx = spawn("nginx", ["-p", `${temporary}/`, "-c", config, "-g", "daemon off;"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  nginx.stderr.on("data", (chunk) => {
    diagnostic = `${diagnostic}${chunk}`.slice(-4000);
  });
  nginx.on("error", (error) => {
    diagnostic = error.message;
  });
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt++) {
    ready = await get("/api/inventory", "identity", false)
      .then((result) => result.status === 401)
      .catch(() => false);
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Isolated Nginx did not start: ${diagnostic}`);

  const checks = [];
  for (const route of ["/api/inventory", "/api/inventory/snapshot"]) {
    const plain = await get(route, "identity");
    assert.equal(plain.status, 200);
    assert.equal(plain.headers["content-encoding"], undefined);
    assert.equal(digest(plain.body), expectedHash);
    const compressed = await get(route);
    assert.equal(compressed.status, 200);
    assert.equal(compressed.headers["content-encoding"], "gzip");
    assert.match(compressed.headers.vary, /accept-encoding/iu);
    assert.match(compressed.headers["cache-control"], /no-store/u);
    assert.equal(digest(gunzipSync(compressed.body)), expectedHash);
    assert.ok(compressed.body.length < plain.body.length / 2);
    const denied = await get(route, "gzip", false);
    assert.equal(denied.status, 401);
    assert.deepEqual(JSON.parse(denied.body.toString()), { error: "unauthorized" });
    checks.push({
      route,
      uncompressedBytes: plain.body.length,
      compressedBytes: compressed.body.length,
    });
  }
  assert.equal((await get("/api/inventory/other")).status, 404);
  const concurrent = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      get(index % 2 ? "/api/inventory" : "/api/inventory/snapshot"),
    ),
  );
  for (const result of concurrent) {
    assert.equal(result.status, 200);
    assert.equal(result.headers["content-encoding"], "gzip");
    assert.equal(digest(gunzipSync(result.body)), expectedHash);
    assert.match(result.headers["cache-control"], /no-store/u);
  }
  const durations = concurrent.map((result) => result.durationMs).sort((a, b) => a - b);
  process.stdout.write(
    `${JSON.stringify({ environment: "isolated-nginx-synthetic", concurrentRequests: 20, errors: 0, p50Ms: durations[9], p95Ms: durations[18], checks, productionCapacityProven: false })}\n`,
  );
} finally {
  if (nginx?.pid && nginx.exitCode === null && nginx.signalCode === null) {
    const exited = once(nginx, "exit");
    nginx.kill("SIGTERM");
    await exited;
  }
  upstream.closeAllConnections();
  await new Promise((resolve) => upstream.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
