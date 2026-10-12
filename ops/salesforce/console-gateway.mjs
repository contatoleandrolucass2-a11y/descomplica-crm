import http from "node:http";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

export const LIMITS = Object.freeze({
  cookie: 16 * 1024,
  payload: 1024 * 1024,
  buffer: 2 * 1024 * 1024,
  authBody: 4096,
  authMs: 5000,
  connectMs: 5000,
  recheckMs: 30_000,
  lifetimeMs: 600_000,
  heartbeatMs: 15_000,
  closeMs: 1000,
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOCKET_PATH = "/salesforce-console/socket";
const ignoreError = () => {};

export function approvedOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.origin === value) return url;
  } catch {
    // Configuration errors must not echo configuration or credentials.
  }
  throw new Error("Invalid CRM origin configuration");
}

function validCookie(cookie) {
  return (
    typeof cookie === "string" &&
    cookie.length > 0 &&
    Buffer.byteLength(cookie) <= LIMITS.cookie &&
    !/[\x00-\x1f\x7f]/.test(cookie)
  );
}

// Native HTTP never follows redirects. Only the approved Host and Cookie leave
// this process, and the destination cannot be supplied by a browser or env var.
export function authorizeCookie(
  cookie,
  { origin, signal, request = http.request, timeoutMs = LIMITS.authMs },
) {
  const host = approvedOrigin(origin).host;
  if (!validCookie(cookie) || signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req;
    let response;
    let settled = false;
    const finish = (subject = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      response?.destroy();
      req?.destroy();
      resolve(subject);
    };
    const onAbort = () => finish();
    const timer = setTimeout(onAbort, timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      req = request(
        {
          hostname: "127.0.0.1",
          port: 3000,
          path: "/api/salesforce/console/authorize",
          method: "GET",
          agent: false,
          maxHeaderSize: 8192,
          headers: { Host: host, Cookie: cookie, Accept: "application/json" },
        },
        (res) => {
          response = res;
          res.on("error", onAbort);
          res.on("aborted", onAbort);
          if (
            res.statusCode !== 200 ||
            !/^application\/json(?:\s*;|$)/i.test(res.headers["content-type"] ?? "")
          ) {
            finish();
            return;
          }
          let size = 0;
          const chunks = [];
          res.on("data", (chunk) => {
            size += chunk.length;
            if (size > LIMITS.authBody) finish();
            else chunks.push(chunk);
          });
          res.on("end", () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              finish(
                data?.ok === true && typeof data.subject === "string" && UUID.test(data.subject)
                  ? data.subject.toLowerCase()
                  : null,
              );
            } catch {
              finish();
            }
          });
        },
      );
      req.on("error", onAbort);
      req.end();
    } catch {
      finish();
    }
  });
}

// Dependency overrides and ephemeral ports exist for tests only. The executable
// entry point below always uses the fixed loopback ports and production limits.
export function createConsoleGateway({
  origin,
  authorize = authorizeCookie,
  connect = (options) => net.createConnection(options),
  timing = {},
} = {}) {
  approvedOrigin(origin);
  const limits = { ...LIMITS, ...timing };
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: LIMITS.payload,
    perMessageDeflate: false,
    closeTimeout: limits.closeMs,
    handleProtocols: (protocols) => protocols.has("binary") && "binary",
  });
  const sockets = new Set();
  let slot = null;
  let stopping = false;
  let stopPromise;
  const server = http.createServer(
    {
      maxHeaderSize: LIMITS.cookie + 4096,
      headersTimeout: limits.authMs,
      requestTimeout: limits.authMs,
    },
    (_req, res) => {
      res.writeHead(404, { Connection: "close", "Content-Length": "0" });
      res.end();
    },
  );
  server.maxConnections = 32;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.setTimeout(limits.authMs, () => socket.destroy());
    socket.on("error", ignoreError);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("clientError", (_error, socket) => reject(socket, 400));

  function reject(socket, status) {
    if (socket.destroyed) return;
    socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    // Bound peers that do not consume a rejection or complete their FIN.
    socket.setTimeout(limits.closeMs, () => socket.destroy());
  }

  server.on("upgrade", (req, socket, head) => {
    const cookie = req.headers.cookie;
    const cookieCount = req.rawHeaders.filter(
      (value, index) => index % 2 === 0 && value.toLowerCase() === "cookie",
    ).length;
    if (stopping) return reject(socket, 503);
    if (req.method !== "GET" || req.url !== SOCKET_PATH) return reject(socket, 404);
    if (req.headers.origin !== origin) return reject(socket, 403);
    if (!validCookie(cookie) || cookieCount !== 1) return reject(socket, 401);
    if (head.length > LIMITS.payload) return reject(socket, 413);
    if (slot) return reject(socket, 409);

    // Reserve before awaiting auth: exactly one pending or active console.
    const session = { close: () => finish(undefined, true) };
    slot = session;
    let ws;
    let tcp;
    let ended = false;
    let connected = false;
    let rechecking = false;
    let pendingPing = null;
    const timers = new Set();
    const controllers = new Set();
    const listeners = [];
    const on = (emitter, event, listener) => {
      emitter.on(event, listener);
      listeners.push(() => emitter.off(event, listener));
    };
    const timer = (callback, ms, repeat = false) => {
      const id = (repeat ? setInterval : setTimeout)(callback, ms);
      timers.add(id);
      return id;
    };
    const release = () => {
      for (const remove of listeners.splice(0)) remove();
      if (slot === session) slot = null;
    };
    function finish(code, hard = false) {
      if (ended) {
        if (hard) ws?.terminate();
        return;
      }
      ended = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const controller of controllers) controller.abort();
      tcp?.destroy();
      if (ws) {
        if (hard || ws.readyState === WebSocket.CLOSED) {
          ws.terminate();
          if (ws.readyState === WebSocket.CLOSED) release();
        } else ws.close(code ?? 1011);
      } else {
        socket.destroy();
        release();
      }
    }
    async function check() {
      const controller = new AbortController();
      controllers.add(controller);
      let abortListener;
      const aborted = new Promise((resolve) => {
        abortListener = () => resolve(null);
        controller.signal.addEventListener("abort", abortListener, {
          once: true,
        });
      });
      const deadline = setTimeout(() => controller.abort(), limits.authMs);
      try {
        const subject = await Promise.race([
          Promise.resolve().then(() =>
            authorize(cookie, {
              origin,
              signal: controller.signal,
              timeoutMs: limits.authMs,
            }),
          ),
          aborted,
        ]);
        return typeof subject === "string" && UUID.test(subject) ? subject.toLowerCase() : null;
      } catch {
        return null;
      } finally {
        clearTimeout(deadline);
        controller.signal.removeEventListener("abort", abortListener);
        controllers.delete(controller);
      }
    }
    const pendingClose = () => finish(undefined, true);
    socket.once("close", pendingClose);
    socket.once("end", pendingClose);
    socket.once("error", pendingClose);
    const detachPending = () => {
      socket.off("close", pendingClose);
      socket.off("end", pendingClose);
      socket.off("error", pendingClose);
    };
    listeners.push(detachPending);

    void (async () => {
      const subject = await check();
      if (ended) return;
      if (!subject) {
        reject(socket, 401);
        ended = true;
        release();
        return;
      }
      socket.setTimeout(0);
      try {
        wss.handleUpgrade(req, socket, head, (client) => {
          ws = client;
          detachPending();
          on(ws, "error", () => finish());
          on(ws, "close", () => {
            finish(undefined, true);
            release();
          });
          on(ws, "pong", (data) => {
            if (pendingPing?.equals(data)) pendingPing = null;
          });
          // Pause publicly until TCP is connected; buffered head frames are
          // still subject to maxPayload and the bounded write check below.
          ws.pause();
          tcp = connect({ host: "127.0.0.1", port: 5909 });
          const connectTimer = timer(() => finish(1011), limits.connectMs);
          on(tcp, "connect", () => {
            if (ended) return;
            connected = true;
            clearTimeout(connectTimer);
            timers.delete(connectTimer);
            ws.resume();
          });
          on(tcp, "error", () => finish(1011));
          on(tcp, "end", () => finish(1000));
          on(tcp, "close", () => finish(1000));
          on(tcp, "drain", () => {
            if (!ended && connected) ws.resume();
          });
          on(ws, "message", (data, binary) => {
            if (ended) return;
            if (!binary) return finish(1003);
            if (tcp.writableLength + data.length > LIMITS.buffer) return finish(1009);
            if (!tcp.write(data)) ws.pause();
          });
          on(tcp, "data", (data) => {
            if (ended) return;
            if (data.length > LIMITS.payload || ws.bufferedAmount + data.length > LIMITS.buffer)
              return finish(1009);
            tcp.pause();
            ws.send(data, { binary: true }, (error) => {
              if (error) finish(1011);
              else if (!ended) tcp.resume();
            });
          });
          timer(() => finish(1000), limits.lifetimeMs);
          timer(
            () => {
              if (ended) return;
              if (pendingPing) return finish(undefined, true);
              pendingPing = randomBytes(8);
              ws.ping(pendingPing, (error) => {
                if (error) finish(undefined, true);
              });
            },
            limits.heartbeatMs,
            true,
          );
          timer(
            async () => {
              if (ended || rechecking) return;
              rechecking = true;
              const current = await check();
              rechecking = false;
              if (!ended && current !== subject) finish(1008);
            },
            limits.recheckMs,
            true,
          );
        });
      } catch {
        finish(undefined, true);
      }
    })();
  });

  return {
    listen(port = 6081) {
      return new Promise((resolve, rejectListen) => {
        const onError = () => rejectListen(new Error("Gateway listen failed"));
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", onError);
          resolve(server.address());
        });
      });
    },
    close() {
      if (stopPromise) return stopPromise;
      stopping = true;
      slot?.close();
      for (const socket of sockets) socket.destroy();
      stopPromise = Promise.all([
        new Promise((resolve) => server.close(() => resolve())),
        new Promise((resolve) => wss.close(() => resolve())),
      ]).then(() => undefined);
      return stopPromise;
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let gateway;
  try {
    gateway = createConsoleGateway({
      origin: process.env.SALESFORCE_CONSOLE_ORIGIN,
    });
    await gateway.listen();
    const stop = async () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      await gateway.close();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch {
    await gateway?.close();
    process.stderr.write("Salesforce console gateway unavailable\n");
    process.exitCode = 1;
  }
}
