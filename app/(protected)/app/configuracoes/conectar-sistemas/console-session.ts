import type RFB from "@novnc/novnc";

export type ConsoleState = "loading" | "connected" | "disconnected" | "expired" | "error";
export type ConsoleProvider = "salesforce" | "meta-ads";

const PROVIDERS = {
  salesforce: {
    endpoint: "/api/salesforce/console",
    socket: "/salesforce-console/socket",
    screenLabel: "Tela remota do Salesforce",
  },
  "meta-ads": {
    endpoint: "/api/meta-ads/console",
    socket: "/meta-ads-console/socket",
    screenLabel: "Tela remota do Meta Ads",
  },
} as const;

export function startConsoleSession(
  target: HTMLElement,
  onState: (state: ConsoleState) => void,
  onCredentialsFailure: () => void,
  provider: ConsoleProvider = "salesforce",
) {
  const configuration = PROVIDERS[provider];
  const request = new AbortController();
  const startedAt = Date.now();
  let disposed = false;
  let rfb: RFB | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let expiresAt = startedAt + 600_000;
  const listeners: [string, EventListener][] = [];

  function dispose() {
    if (disposed) return;
    disposed = true;
    request.abort();
    clearTimeout(connectionTimer);
    clearTimeout(expiryTimer);
    document.removeEventListener("visibilitychange", checkExpiry);
    window.removeEventListener("pageshow", checkExpiry);
    for (const [name, listener] of listeners) rfb?.removeEventListener(name, listener);
    rfb?.disconnect();
    rfb = undefined;
    target.replaceChildren();
  }

  function finish(state: ConsoleState) {
    if (disposed) return;
    dispose();
    onState(state);
  }

  function checkExpiry() {
    if (Date.now() >= expiresAt) finish("expired");
  }

  function credentialsFailure() {
    if (disposed) return;
    dispose();
    onCredentialsFailure();
  }

  const connectionTimer = setTimeout(() => finish("error"), 30_000);
  document.addEventListener("visibilitychange", checkExpiry);
  window.addEventListener("pageshow", checkExpiry);

  async function connect() {
    try {
      // Import only after the operator opens the console; never evaluate noVNC during SSR.
      const { default: RemoteFramebuffer } = await import("@novnc/novnc");
      if (disposed) return;
      const response = await fetch(configuration.endpoint, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        headers: { accept: "application/json" },
        signal: request.signal,
      });
      if (disposed) return;
      if (response.status === 401 || response.status === 403) {
        credentialsFailure();
        return;
      }
      if (!response.ok) throw new Error("Console unavailable");
      const body: unknown = await response.json();
      if (disposed) return;
      if (
        !body ||
        typeof body !== "object" ||
        !("password" in body) ||
        typeof body.password !== "string" ||
        !body.password ||
        !("websocketPath" in body) ||
        body.websocketPath !== configuration.socket ||
        !("expiresIn" in body) ||
        typeof body.expiresIn !== "number" ||
        !Number.isInteger(body.expiresIn) ||
        body.expiresIn <= 0 ||
        body.expiresIn > 600
      )
        throw new Error("Console unavailable");

      expiresAt = startedAt + body.expiresIn * 1000;
      checkExpiry();
      if (disposed) return;
      const url = new URL(configuration.socket, window.location.origin);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      rfb = new RemoteFramebuffer(target, url.href, {
        credentials: { password: body.password },
        shared: true,
      });
      body.password = "";
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.focusOnClick = true;

      const onConnect = () => {
        checkExpiry();
        if (disposed) return;
        clearTimeout(connectionTimer);
        const canvas = target.querySelector("canvas");
        canvas?.setAttribute("aria-label", configuration.screenLabel);
        onState("connected");
      };
      listeners.push(
        ["connect", onConnect],
        ["disconnect", () => finish("disconnected")],
        ["credentialsrequired", credentialsFailure],
        ["securityfailure", credentialsFailure],
        ["serververification", credentialsFailure],
      );
      for (const [name, listener] of listeners) rfb.addEventListener(name, listener);
      expiryTimer = setTimeout(() => finish("expired"), expiresAt - Date.now());
    } catch {
      finish("error");
    }
  }

  void connect();
  return dispose;
}
