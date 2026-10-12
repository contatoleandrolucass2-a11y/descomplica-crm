import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { Duplex } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { WebSocket } from "ws";
import {
  approvedOrigin,
  authorizeCookie,
  createConsoleGateway,
  LIMITS,
} from "./console-gateway.mjs";

const ORIGIN = "https://crm.example.test";
const SUBJECT = "12345678-1234-4123-8123-123456789abc";
const OTHER = "12345678-1234-4123-8123-123456789abd";
const COOKIE = "synthetic-session=fixture-only";
const PATH = "/salesforce-console/socket";

async function until(predicate) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail("Condition did not settle");
}

async function rawUpgrade(
  port,
  {
    path = PATH,
    method = "GET",
    cookies = [COOKIE],
    key = Buffer.alloc(16, 7).toString("base64"),
  } = {},
) {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.on("error", () => {});
  const response = once(socket, "data");
  socket.write(
    [
      `${method} ${path} HTTP/1.1`,
      "Host: local.invalid",
      "Connection: Upgrade",
      "Upgrade: websocket",
      "Sec-WebSocket-Version: 13",
      `Sec-WebSocket-Key: ${key}`,
      `Origin: ${ORIGIN}`,
      ...cookies.map((cookie) => `Cookie: ${cookie}`),
      "",
      "",
    ].join("\r\n"),
  );
  try {
    return (await response)[0].toString("ascii").split("\r\n")[0];
  } finally {
    socket.destroy();
  }
}

async function fixture(t, options = {}) {
  const peers = new Set();
  let connections = 0;
  const backend = net.createServer((socket) => {
    connections++;
    peers.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => peers.delete(socket));
    socket.on("data", (data) => socket.write(data));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const gateway = createConsoleGateway({
    origin: ORIGIN,
    authorize: async () => SUBJECT,
    connect: (target) => {
      assert.deepEqual(target, { host: "127.0.0.1", port: 5909 });
      return net.createConnection({
        host: "127.0.0.1",
        port: backend.address().port,
      });
    },
    ...options,
    timing: { closeMs: 500, ...options.timing },
  });
  const address = await gateway.listen(0);
  assert.equal(address.address, "127.0.0.1");
  const clients = new Set();
  t.after(async () => {
    for (const client of clients) client.terminate();
    await gateway.close();
    for (const peer of peers) peer.destroy();
    await new Promise((resolve) => backend.close(resolve));
  });
  function client({ path = PATH, origin = ORIGIN, cookie = COOKIE, ...rest } = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}${path}`, {
      headers: {
        ...(origin === null ? {} : { Origin: origin }),
        ...(cookie === null ? {} : { Cookie: cookie }),
      },
      ...rest,
    });
    clients.add(ws);
    ws.on("error", () => {});
    return ws;
  }
  async function open(options) {
    const ws = client(options);
    await once(ws, "open");
    return ws;
  }
  async function rejected(options) {
    const ws = client(options);
    const [, response] = await once(ws, "unexpected-response");
    const status = response.statusCode;
    response.resume();
    ws.terminate();
    return status;
  }
  return { gateway, client, open, rejected, address, peers, connections: () => connections };
}

async function authFixture(t, handler) {
  const sockets = new Set();
  const server = http.createServer(handler);
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return (options, callback) => {
    assert.equal(options.hostname, "127.0.0.1");
    assert.equal(options.port, 3000);
    assert.equal(options.path, "/api/salesforce/console/authorize");
    assert.equal(options.method, "GET");
    assert.equal(options.agent, false);
    assert.deepEqual(options.headers, {
      Host: "crm.example.test",
      Cookie: COOKIE,
      Accept: "application/json",
    });
    return http.request({ ...options, port: server.address().port }, callback);
  };
}

test("configuration only accepts an exact HTTPS origin", () => {
  assert.equal(approvedOrigin(ORIGIN).host, "crm.example.test");
  for (const origin of [
    undefined,
    "http://crm.example.test",
    `${ORIGIN}/`,
    `${ORIGIN}/path`,
    `${ORIGIN}?a=1`,
    "https://user:pass@crm.example.test",
    "https://crm.example.test#x",
  ]) {
    assert.throws(() => createConsoleGateway({ origin }), /Invalid CRM origin/);
  }
  assert.equal(LIMITS.authMs, 5000);
  assert.equal(LIMITS.recheckMs, 30_000);
  assert.equal(LIMITS.lifetimeMs, 600_000);
  assert.equal(LIMITS.payload, 1024 * 1024);
});

test("auth forwards bounded Cookie to fixed GET with approved Host", async (t) => {
  let calls = 0;
  const request = await authFixture(t, (req, res) => {
    calls++;
    assert.equal(req.headers.cookie, COOKIE);
    assert.equal(req.headers.host, "crm.example.test");
    assert.equal(req.method, "GET");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, subject: SUBJECT }));
  });
  assert.equal(await authorizeCookie(COOKIE, { origin: ORIGIN, request }), SUBJECT);
  for (const cookie of ["", "x".repeat(LIMITS.cookie + 1), "x\r\ny"]) {
    assert.equal(await authorizeCookie(cookie, { origin: ORIGIN, request }), null);
  }
  assert.equal(calls, 1);
});

test("auth rejects redirects, failures, malformed JSON, invalid subject and oversized body", async (t) => {
  const cases = [
    [302, "application/json", JSON.stringify({ ok: true, subject: SUBJECT })],
    [401, "application/json", "{}"],
    [500, "application/json", "{}"],
    [200, "text/html", JSON.stringify({ ok: true, subject: SUBJECT })],
    [200, "application/json", "not JSON"],
    [200, "application/json", JSON.stringify({ ok: true, subject: "not-uuid" })],
    [200, "application/json", JSON.stringify({ ok: false, subject: SUBJECT })],
    [200, "application/json", " ".repeat(LIMITS.authBody + 1)],
  ];
  for (const [status, contentType, body] of cases) {
    await t.test(`${status} ${contentType} ${body.length} bytes`, async (st) => {
      let calls = 0;
      const request = await authFixture(st, (_req, res) => {
        calls++;
        res.writeHead(status, { "Content-Type": contentType, Location: "/redirected" });
        res.end(body);
      });
      assert.equal(await authorizeCookie(COOKIE, { origin: ORIGIN, request }), null);
      assert.equal(calls, 1);
    });
  }
});

test("auth timeout and cancellation close the HTTP request", async (t) => {
  const upstream = await authFixture(t, () => {});
  const requests = [];
  const request = (...args) => {
    const outgoing = upstream(...args);
    requests.push(outgoing);
    return outgoing;
  };
  assert.equal(await authorizeCookie(COOKIE, { origin: ORIGIN, request, timeoutMs: 30 }), null);
  // A timeout can precede the server's connection event on a loaded runner.
  assert.equal(requests[0].destroyed, true);
  const controller = new AbortController();
  const result = authorizeCookie(COOKIE, { origin: ORIGIN, request, signal: controller.signal });
  controller.abort();
  assert.equal(await result, null);
  assert.equal(requests[1].destroyed, true);
  assert.equal(
    await authorizeCookie(COOKIE, { origin: ORIGIN, request, signal: controller.signal }),
    null,
  );
});

test("authorized binary bridge round-trips bytes and closes TCP on disconnect", async (t) => {
  const f = await fixture(t);
  const ws = await f.open();
  const received = once(ws, "message");
  const data = Buffer.from([0, 255, 82, 70, 66, 10]);
  ws.send(data);
  const [message, binary] = await received;
  assert.equal(binary, true);
  assert.deepEqual(message, data);
  assert.equal(f.connections(), 1);
  const closed = once(ws, "close");
  ws.close();
  await closed;
  await until(() => f.peers.size === 0);
  const next = await f.open();
  next.terminate();
});

test("Origin, exact path, queries and Cookie rejected before auth or TCP", async (t) => {
  let authCalls = 0;
  const f = await fixture(t, {
    authorize: async () => {
      authCalls++;
      return SUBJECT;
    },
  });
  for (const origin of [
    null,
    "http://crm.example.test",
    "https://evil.example.test",
    `${ORIGIN}/`,
    "null",
  ]) {
    assert.equal(await f.rejected({ origin }), 403);
  }
  for (const path of ["/", `${PATH}?target=evil`, `${PATH}/`, "/salesforce-console/%73ocket"]) {
    assert.equal(await f.rejected({ path }), 404);
  }
  for (const cookie of [null, "", "a".repeat(LIMITS.cookie + 1)]) {
    assert.equal(await f.rejected({ cookie }), 401);
  }
  assert.equal(authCalls, 0);
  assert.equal(f.connections(), 0);
});

test("unauthorized and failed auth never upgrade or connect TCP", async (t) => {
  for (const authorize of [
    async () => null,
    async () => "invalid",
    async () => {
      throw new Error("sensitive fixture");
    },
  ]) {
    const f = await fixture(t, { authorize });
    assert.equal(await f.rejected(), 401);
    assert.equal(f.connections(), 0);
  }
});

test("raw empty query, duplicate Cookie and non-GET are rejected before auth", async (t) => {
  let calls = 0;
  const f = await fixture(t, {
    authorize: () => {
      calls++;
      return SUBJECT;
    },
  });
  assert.match(await rawUpgrade(f.address.port, { path: `${PATH}?` }), / 404 /);
  assert.match(await rawUpgrade(f.address.port, { cookies: [COOKIE, COOKIE] }), / 401 /);
  assert.match(await rawUpgrade(f.address.port, { method: "POST" }), / 404 /);
  assert.equal(calls, 0);
  assert.equal(f.connections(), 0);
});

test("invalid WS handshake releases reservation without touching VNC", async (t) => {
  const f = await fixture(t);
  assert.match(await rawUpgrade(f.address.port, { key: "invalid" }), / 400 /);
  await delay(10);
  assert.equal(f.connections(), 0);
  const ws = await f.open();
  assert.equal(ws.readyState, WebSocket.OPEN);
});

test("Cookie exactly at the 16 KiB boundary is accepted", async (t) => {
  const cookie = `session=${"x".repeat(LIMITS.cookie - 8)}`;
  const f = await fixture(t, {
    authorize: (received) => {
      assert.equal(received, cookie);
      return SUBJECT;
    },
  });
  const ws = await f.open({ cookie });
  assert.equal(ws.readyState, WebSocket.OPEN);
});

test("one pending handshake reserves the global slot; no takeover", async (t) => {
  let grant;
  let calls = 0;
  const f = await fixture(t, {
    authorize: () => {
      calls++;
      return new Promise((resolve) => {
        grant = resolve;
      });
    },
  });
  const first = f.client();
  const opened = once(first, "open");
  await until(() => calls === 1);
  assert.equal(await f.rejected(), 409);
  assert.equal(calls, 1);
  assert.equal(f.connections(), 0);
  grant(SUBJECT);
  await opened;
  await until(() => f.connections() === 1);
  assert.equal(await f.rejected(), 409);
  assert.equal(first.readyState, WebSocket.OPEN);
  assert.equal(f.connections(), 1);
});

test("bounded auth timeout releases a pending reservation", async (t) => {
  let signal;
  let calls = 0;
  const f = await fixture(t, {
    authorize: (_cookie, options) => {
      signal = options.signal;
      return ++calls === 1 ? new Promise(() => {}) : SUBJECT;
    },
    timing: { authMs: 500 },
  });
  const first = f.client();
  const ended = new Promise((resolve) => {
    first.once("unexpected-response", (_req, res) => {
      res.resume();
      first.terminate();
      resolve();
    });
    first.once("close", resolve);
  });
  await ended;
  // Client close can precede the server's socket-close cleanup.
  if (!signal?.aborted) t.diagnostic("Client closed before server auth cancellation settled");
  await until(() => signal?.aborted);
  assert.equal(signal.aborted, true);
  assert.equal(f.connections(), 0);
  const next = await f.open();
  assert.equal(next.readyState, WebSocket.OPEN);
});

test("pending client disconnect aborts auth and allows a new console", async (t) => {
  let pendingSignal;
  let calls = 0;
  const f = await fixture(t, {
    authorize: (_cookie, { signal }) => {
      calls++;
      if (calls > 1) return SUBJECT;
      pendingSignal = signal;
      return new Promise(() => {});
    },
  });
  const first = f.client();
  await until(() => pendingSignal);
  first.terminate();
  await until(() => pendingSignal.aborted);
  const next = await f.open();
  assert.equal(next.readyState, WebSocket.OPEN);
});

test("recheck closes on revocation, changed subject, error and auth timeout", async (t) => {
  for (const result of [null, OTHER, "throw", "timeout"]) {
    await t.test(String(result), async (st) => {
      let calls = 0;
      const f = await fixture(st, {
        authorize: (cookie) => {
          assert.equal(cookie, COOKIE);
          if (++calls === 1) return SUBJECT;
          if (result === "throw") throw new Error("private fixture");
          if (result === "timeout") return new Promise(() => {});
          return result;
        },
        timing: { recheckMs: 100, authMs: 500 },
      });
      const ws = await f.open();
      const [code] = await once(ws, "close");
      assert.equal(code, 1008);
      await until(() => f.peers.size === 0);
      const previousCalls = calls;
      await delay(150);
      assert.equal(calls, previousCalls);
    });
  }
});

test("text and oversize binary messages close without forwarding bytes", async (t) => {
  for (const [payload, code] of [
    ["text", 1003],
    [Buffer.alloc(LIMITS.payload + 1), 1009],
  ]) {
    const f = await fixture(t);
    let bytes = 0;
    const ws = await f.open();
    await until(() => f.peers.size === 1);
    [...f.peers][0].on("data", (data) => {
      bytes += data.length;
    });
    const closed = once(ws, "close");
    ws.send(payload);
    assert.equal((await closed)[0], code);
    assert.equal(bytes, 0);
    await until(() => f.peers.size === 0);
  }
});

test("fragmented messages remain subject to aggregate maxPayload", async (t) => {
  const f = await fixture(t);
  const ws = await f.open();
  const closed = once(ws, "close");
  ws.send(Buffer.alloc(LIMITS.payload), { fin: false });
  ws.send(Buffer.from([1]), { fin: true });
  assert.equal((await closed)[0], 1009);
});

test("TCP connect timeout and error close the console and release reservation", async (t) => {
  for (const fail of [false, true]) {
    let tcp;
    const f = await fixture(t, {
      connect: () => {
        tcp = new Duplex({
          read() {},
          write(_chunk, _encoding, callback) {
            callback();
          },
        });
        if (fail) queueMicrotask(() => tcp.destroy(new Error("private TCP error")));
        return tcp;
      },
      timing: { connectMs: 150 },
    });
    const ws = await f.open();
    assert.equal((await once(ws, "close"))[0], 1011);
    assert.equal(tcp.destroyed, true);
  }
});

test("TCP writable buffer cap closes the session", async (t) => {
  const f = await fixture(t, {
    connect: () => {
      const tcp = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      Object.defineProperty(tcp, "writableLength", { get: () => LIMITS.buffer });
      queueMicrotask(() => tcp.emit("connect"));
      return tcp;
    },
  });
  const ws = await f.open();
  const closed = once(ws, "close");
  ws.send(Buffer.from([1]));
  assert.equal((await closed)[0], 1009);
});

test("TCP write backpressure pauses WS and drain resumes it without data loss", async (t) => {
  let completeWrite;
  let writes = 0;
  const f = await fixture(t, {
    connect: () => {
      const tcp = new Duplex({
        writableHighWaterMark: 1,
        read() {},
        write(_chunk, _encoding, callback) {
          writes++;
          completeWrite = callback;
        },
      });
      queueMicrotask(() => tcp.emit("connect"));
      return tcp;
    },
  });
  const ws = await f.open();
  ws.send(Buffer.from([1]));
  await until(() => writes === 1);
  ws.send(Buffer.from([2]));
  await delay(20);
  assert.equal(writes, 1);
  completeWrite();
  await until(() => writes === 2);
  completeWrite();
  assert.equal(ws.readyState, WebSocket.OPEN);
});

test("TCP stream larger than buffer cap is delivered in bounded binary frames", async (t) => {
  const f = await fixture(t);
  const ws = await f.open();
  await until(() => f.peers.size === 1);
  const payload = Buffer.alloc(LIMITS.buffer * 2, 0x5a);
  let received = 0;
  const complete = new Promise((resolve) => {
    ws.on("message", (data, binary) => {
      assert.equal(binary, true);
      assert.ok(data.length <= LIMITS.payload);
      assert.ok(data.every((value) => value === 0x5a));
      received += data.length;
      if (received === payload.length) resolve();
    });
  });
  [...f.peers][0].write(payload);
  await complete;
  assert.equal(ws.readyState, WebSocket.OPEN);
});

test("TCP EOF closes WS and maximum lifetime expires", async (t) => {
  const f = await fixture(t);
  const ws = await f.open();
  await until(() => f.peers.size === 1);
  const closed = once(ws, "close");
  [...f.peers][0].end();
  assert.equal((await closed)[0], 1000);
  const expiring = await fixture(t, { timing: { lifetimeMs: 150 } });
  const second = await expiring.open();
  assert.equal((await once(second, "close"))[0], 1000);
});

test("ping/pong retains responsive peers and terminates unresponsive peers", async (t) => {
  const f = await fixture(t, { timing: { heartbeatMs: 150 } });
  const ws = await f.open();
  await delay(350);
  assert.equal(ws.readyState, WebSocket.OPEN);
  const closed = once(ws, "close");
  ws.close();
  await closed;
  const silent = await f.open({ autoPong: false });
  assert.equal((await once(silent, "close"))[0], 1006);
  await until(() => f.peers.size === 0);
});

test("shutdown aborts pending auth and closes active peers, idempotently", async (t) => {
  let signal;
  const pending = await fixture(t, {
    authorize: (_cookie, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  pending.client();
  await until(() => signal);
  await pending.gateway.close();
  assert.equal(signal.aborted, true);
  const active = await fixture(t);
  const ws = await active.open();
  const closed = once(ws, "close");
  await Promise.all([active.gateway.close(), active.gateway.close()]);
  await closed;
  await until(() => active.peers.size === 0);
});

test("unit uses existing services, immutable release and private hardened account", async () => {
  const unit = await readFile(
    new URL("./vps/descomplica-salesforce-gateway.service", import.meta.url),
    "utf8",
  );
  for (const line of [
    "User=descomplica-salesforce",
    "Group=descomplica-salesforce",
    "WorkingDirectory=@RELEASE@",
    "EnvironmentFile=/etc/descomplica-salesforce/gateway.env",
    "NoNewPrivileges=true",
    "ProtectSystem=strict",
    "ProtectHome=true",
    "CapabilityBoundingSet=",
    "UMask=0077",
    "IPAddressDeny=any",
    "IPAddressAllow=127.0.0.1/32",
    "LimitCORE=0",
    "Requires=descomplica-salesforce-browser.service descomplica-salesforce-vnc.service",
    "After=descomplica-salesforce-browser.service descomplica-salesforce-vnc.service",
    "[Install]",
    "WantedBy=multi-user.target",
    "Restart=on-failure",
  ])
    assert.ok(unit.split(/\r?\n/).includes(line), line);
  assert.doesNotMatch(unit, /^(BindsTo|PartOf|Requisite|ExecStop)=/m);
  assert.match(unit, /ExecStart=\/usr\/local\/bin\/node ops\/salesforce\/console-gateway\.mjs/);
});
