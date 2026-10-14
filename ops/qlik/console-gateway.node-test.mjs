import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import {
  allowedRequest,
  CONSOLE_ORIGIN,
  createQlikConsole,
  readAsset,
} from "./console-gateway.mjs";

const headers = { host: "127.0.0.1:6082", origin: CONSOLE_ORIGIN };

function request(port, pathname, extra = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: pathname, headers: { ...headers, ...extra } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    req.on("error", reject);
  });
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function post(port, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/credentials",
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-qlik-console": "1",
          ...extra,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

test("credential submission requires same-origin JSON, bounds input and never echoes secrets", async (t) => {
  let calls = 0;
  const gateway = createQlikConsole({
    saveCredential: async (value) => {
      calls += 1;
      assert.deepEqual(value, { username: "synthetic-user", password: "synthetic-password" });
    },
    getCredentialStatus: async () => ({ saved: true, username: "must-not-be-returned" }),
  });
  const port = await listen(gateway.server);
  t.after(() => gateway.close());
  const body = JSON.stringify({ username: "synthetic-user", password: "synthetic-password" });
  for (const change of [
    { origin: "null" },
    { origin: "" },
    { "x-qlik-console": "" },
    { "content-type": "text/plain" },
  ]) {
    assert.equal((await post(port, body, change)).status, 403);
  }
  assert.equal((await post(port, "x".repeat(8193))).status, 413);
  assert.equal((await post(port, "{broken-json")).status, 400);
  assert.equal(calls, 0);
  const saved = await post(port, body);
  assert.equal(saved.status, 201);
  assert.equal(saved.body, '{"saved":true}');
  assert.equal(calls, 1);
  assert.equal((await request(port, "/credentials/status")).body, '{"saved":true}');
});

test("credential errors do not disclose sensitive exception messages", async (t) => {
  const gateway = createQlikConsole({
    saveCredential: async () => {
      throw Object.assign(new Error("synthetic-secret"), { code: "credential_exists" });
    },
    getCredentialStatus: async () => {
      throw new Error("synthetic-secret");
    },
  });
  const port = await listen(gateway.server);
  t.after(() => gateway.close());
  const response = await post(port, "{}");
  assert.equal(response.status, 409);
  assert.equal(response.body, "");
  const status = await request(port, "/credentials/status");
  assert.equal(status.status, 503);
  assert.equal(status.body, "");
});

test("slow credential body expires before storage without reflecting submitted bytes", async (t) => {
  let stored = false;
  const gateway = createQlikConsole({
    bodyTimeoutMs: 50,
    saveCredential: async () => {
      stored = true;
    },
  });
  const port = await listen(gateway.server);
  t.after(() => gateway.close());
  const result = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/credentials",
        method: "POST",
        headers: { ...headers, "content-type": "application/json", "x-qlik-console": "1" },
      },
      (res) => {
        res.resume();
        res.once("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", (error) => resolve(error.code));
    req.write('{"username":"synthetic');
  });
  assert.equal(result, "ECONNRESET");
  assert.equal(stored, false);
});

test("console rejects foreign origins, DNS rebinding and cross-site navigation", () => {
  assert.equal(allowedRequest({ headers }), true);
  for (const changes of [
    { host: "localhost:6082" },
    { host: "evil.test:6082" },
    { origin: "http://127.0.0.1:6083" },
    { origin: "null" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
  ])
    assert.equal(allowedRequest({ headers: { ...headers, ...changes } }), false);
});

test("assets exclude traversal, encoded paths, queries and arbitrary files", async () => {
  for (const url of [
    "/novnc/core/../../package.json",
    "/novnc/core/../core/rfb.js",
    "/novnc/core/%2e%2e/rfb.js",
    "/novnc/core/rfb.js?key=secret",
    "/novnc/core\\rfb.js",
    "/etc/passwd",
    "/novnc/package.json",
  ]) {
    assert.equal(await readAsset(url), null);
  }
  const asset = await readAsset("/novnc/core/rfb.js");
  assert.equal(asset.type, "text/javascript");
  assert.ok(asset.body.length > 0);
});

test("HTTP serves no-store console and rejects invalid hosts", async (t) => {
  const gateway = createQlikConsole();
  const port = await listen(gateway.server);
  t.after(() => gateway.close());
  const page = await request(port, "/");
  assert.equal(page.status, 200);
  assert.match(page.body, /Qlik na VPS/);
  assert.equal(page.headers["cache-control"], "no-store");
  assert.match(page.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal((await request(port, "/", { host: "evil.test" })).status, 403);
  assert.equal((await request(port, "/etc/passwd")).status, 404);
});

test("WebSocket bridges binary data, excludes a second client and closes target", async (t) => {
  let peer;
  const echo = net.createServer((socket) => {
    peer = socket;
    socket.pipe(socket);
  });
  const echoPort = await listen(echo);
  let connections = 0;
  const gateway = createQlikConsole({
    connect: () => {
      connections += 1;
      return net.createConnection({ host: "127.0.0.1", port: echoPort });
    },
  });
  const port = await listen(gateway.server);
  t.after(async () => {
    await gateway.close();
    peer?.destroy();
    await new Promise((resolve) => echo.close(resolve));
  });
  const client = new WebSocket(`ws://127.0.0.1:${port}/socket`, { headers });
  await once(client, "open");
  const message = once(client, "message");
  client.send(Buffer.from("RFB 003.008\n"));
  assert.equal((await message)[0].toString(), "RFB 003.008\n");
  const second = new WebSocket(`ws://127.0.0.1:${port}/socket`, { headers });
  const rejected = new Promise((resolve) =>
    second.once("unexpected-response", (_req, res) => {
      res.resume();
      second.terminate();
      resolve(res.statusCode);
    }),
  );
  second.on("error", () => {});
  assert.equal(await rejected, 403);
  assert.equal(connections, 1);
  const targetClosed = once(peer, "close");
  client.close();
  await targetClosed;
});

test("WebSocket rejects foreign/missing origins before opening a VNC connection", async (t) => {
  let connections = 0;
  const gateway = createQlikConsole({
    connect: () => {
      connections += 1;
      throw new Error("unexpected");
    },
  });
  const port = await listen(gateway.server);
  t.after(() => gateway.close());
  for (const origin of [undefined, "https://untrusted.test"]) {
    const client = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
      headers: { host: headers.host, ...(origin ? { origin } : {}) },
    });
    client.on("error", () => {});
    const status = await new Promise((resolve) =>
      client.once("unexpected-response", (_req, res) => {
        res.resume();
        client.terminate();
        resolve(res.statusCode);
      }),
    );
    assert.equal(status, 403);
  }
  assert.equal(connections, 0);
});
