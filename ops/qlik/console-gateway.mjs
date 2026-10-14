import http from "node:http";
import net from "node:net";
import path from "node:path";
import { lstat, readFile, realpath, chmod } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

export const CONSOLE_ORIGIN = "http://127.0.0.1:6082";
const RUNTIME = "/run/descomplica-qlik";
const ASSETS = path.resolve(fileURLToPath(import.meta.resolve("@novnc/novnc")), "../..");
const WEB = new URL("./console/", import.meta.url);
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' ws://127.0.0.1:6082; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export function allowedRequest(request) {
  const origin = request.headers.origin;
  const site = request.headers["sec-fetch-site"];
  return (
    request.headers.host === "127.0.0.1:6082" &&
    (!origin || origin === CONSOLE_ORIGIN) &&
    (!site || site === "same-origin" || site === "none")
  );
}

export async function readAsset(url, assets = ASSETS) {
  if (typeof url !== "string" || url.includes("%") || url.includes("?") || url.includes("\\")) {
    return null;
  }
  const local = { "/": "index.html", "/client.js": "client.js", "/style.css": "style.css" };
  if (Object.hasOwn(local, url)) {
    const type = url === "/" ? "text/html" : url.endsWith(".css") ? "text/css" : "text/javascript";
    return { body: await readFile(new URL(local[url], WEB)), type };
  }
  if (!/^\/novnc\/(core|vendor)\/[a-zA-Z0-9_./-]+\.js$/.test(url)) return null;
  const relative = url.slice("/novnc/".length);
  if (relative.split("/").some((part) => !part || part === "." || part === "..")) return null;
  const root = await realpath(assets);
  const candidate = await realpath(path.join(root, relative));
  if (!candidate.startsWith(root + path.sep)) return null;
  return { body: await readFile(candidate), type: "text/javascript" };
}

// SSH authenticates access to the private Unix socket; HTTP and VNC never bind TCP.
export function createQlikConsole({
  connect = () => net.createConnection({ path: `${RUNTIME}/vnc.sock` }),
  asset = readAsset,
  lifetimeMs = 10 * 60 * 1000,
} = {}) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  });
  let active = null;
  const server = http.createServer(
    { requestTimeout: 5000, headersTimeout: 5000 },
    async (req, res) => {
      res.setHeaders(new Headers(SECURITY_HEADERS));
      if (!allowedRequest(req) || req.method !== "GET") {
        res.writeHead(403).end();
        return;
      }
      try {
        const result = await asset(req.url);
        if (!result) res.writeHead(404).end();
        else
          res.writeHead(200, { "Content-Type": `${result.type}; charset=utf-8` }).end(result.body);
      } catch {
        res.writeHead(404).end();
      }
    },
  );
  server.maxConnections = 32;
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("upgrade", (req, socket, head) => {
    if (
      !allowedRequest(req) ||
      req.headers.origin !== CONSOLE_ORIGIN ||
      req.url !== "/socket" ||
      active
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.setTimeout(1000, () => socket.destroy());
      return;
    }
    active = socket;
    socket.on("error", () => {});
    socket.once("close", () => {
      if (active === socket) active = null;
    });
    wss.handleUpgrade(req, socket, head, (ws) => {
      let target;
      const deadline = setTimeout(() => ws.terminate(), lifetimeMs);
      const connectionDeadline = setTimeout(() => ws.terminate(), 5000);
      const stop = () => {
        clearTimeout(deadline);
        clearTimeout(connectionDeadline);
        target?.destroy();
        ws.terminate();
        if (active === socket) active = null;
      };
      ws.on("close", stop);
      ws.on("error", stop);
      try {
        target = connect();
      } catch {
        stop();
        return;
      }
      target.once("connect", () => clearTimeout(connectionDeadline));
      target.on("error", stop);
      target.on("close", stop);
      ws.on("message", (data, binary) => {
        if (!binary || target.writableLength > 2 * 1024 * 1024) {
          stop();
          return;
        }
        target.write(data);
      });
      target.on("data", (data) => {
        if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 2 * 1024 * 1024) {
          stop();
          return;
        }
        ws.send(data, { binary: true }, (error) => {
          if (error) stop();
        });
      });
    });
  });
  return {
    server,
    close: async () => {
      for (const client of wss.clients) client.terminate();
      active?.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      wss.close();
    },
  };
}

async function main() {
  if (process.platform !== "linux" || !process.getuid?.())
    throw new Error("dedicated_nonroot_user_required");
  const directory = await lstat(RUNTIME);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== process.getuid() ||
    (directory.mode & 0o777) !== 0o700
  ) {
    throw new Error("private_runtime_required");
  }
  const vnc = await lstat(`${RUNTIME}/vnc.sock`);
  if (!vnc.isSocket() || vnc.uid !== process.getuid() || (vnc.mode & 0o077) !== 0)
    throw new Error("private_vnc_socket_required");
  process.umask(0o077);
  const gateway = createQlikConsole();
  await new Promise((resolve, reject) => {
    gateway.server.once("error", reject);
    gateway.server.listen(`${RUNTIME}/console.sock`, resolve);
  });
  await chmod(`${RUNTIME}/console.sock`, 0o600);
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => void gateway.close());
  console.log("qlik_console_ready_private_socket");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    console.error("qlik_console_unavailable");
    process.exitCode = 1;
  });
}
