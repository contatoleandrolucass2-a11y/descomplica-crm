import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const instances = vi.hoisted(() => ({ clients: [] as MockRfb[] }));
class MockRfb extends EventTarget {
  scaleViewport = false;
  resizeSession = true;
  focusOnClick = false;
  disconnect = vi.fn();
  constructor(
    public target: HTMLElement,
    public url: string,
    public options: unknown,
  ) {
    super();
    instances.clients.push(this);
  }
}
vi.mock("@novnc/novnc", () => ({ default: MockRfb }));

import {
  startConsoleSession,
  type ConsoleState,
} from "@/app/(protected)/app/configuracoes/conectar-sistemas/console-session";

const ticket = {
  password: "synthetic-vnc",
  websocketPath: "/salesforce-console/socket",
  expiresIn: 600,
};
const fetchMock = vi.fn();
let target: HTMLElement;
let onState: ReturnType<typeof vi.fn<(state: ConsoleState) => void>>;
let onFailure: ReturnType<typeof vi.fn<() => void>>;
let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  instances.clients = [];
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      location: { origin: "https://crm.example.test", protocol: "https:" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock
    .mockReset()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...ticket }) });
  target = { replaceChildren: vi.fn(), querySelector: vi.fn() } as unknown as HTMLElement;
  onState = vi.fn();
  onFailure = vi.fn();
});

afterEach(() => {
  dispose?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function start() {
  dispose = startConsoleSession(target, onState, onFailure);
  await vi.advanceTimersByTimeAsync(0);
}

describe("Salesforce console client lifecycle", () => {
  it("uses an empty same-origin POST and keeps credentials out of the socket URL", async () => {
    await start();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/salesforce/console",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("body");
    const client = instances.clients[0]!;
    expect(client.url).toBe("wss://crm.example.test/salesforce-console/socket");
    expect(client.options).toEqual({ credentials: { password: ticket.password }, shared: true });
    expect(client.scaleViewport).toBe(true);
    expect(client.resizeSession).toBe(false);
    expect(onState).not.toHaveBeenCalled();
    client.dispatchEvent(new Event("connect"));
    expect(onState).toHaveBeenCalledExactlyOnceWith("connected");
  });

  it("supports the same-origin local HTTP development socket", async () => {
    Object.assign(window.location, { origin: "http://localhost:3001", protocol: "http:" });
    await start();
    expect(instances.clients[0]?.url).toBe("ws://localhost:3001/salesforce-console/socket");
  });

  it.each([401, 403])("closes on HTTP %s without rendering its body", async (status) => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({ ok: false, status, json });
    await start();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith();
    expect(json).not.toHaveBeenCalled();
    expect(instances.clients).toHaveLength(0);
  });

  it.each(["securityfailure", "credentialsrequired", "serververification"])(
    "closes on %s and ignores remote details",
    async (name) => {
      await start();
      const client = instances.clients[0]!;
      client.dispatchEvent(new CustomEvent(name, { detail: { reason: "private-remote-error" } }));
      expect(onFailure).toHaveBeenCalledExactlyOnceWith();
      expect(onState).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledOnce();
    },
  );

  it("disconnects at ten minutes, including a resumed inactive tab", async () => {
    await start();
    const client = instances.clients[0]!;
    client.dispatchEvent(new Event("connect"));
    await vi.advanceTimersByTimeAsync(599_999);
    expect(client.disconnect).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 2);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onState).toHaveBeenLastCalledWith("expired");
    expect(client.disconnect).toHaveBeenCalledOnce();
  });

  it("expires on the timer without a visibility event", async () => {
    await start();
    instances.clients[0]!.dispatchEvent(new Event("connect"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(onState).toHaveBeenLastCalledWith("expired");
    expect(instances.clients[0]!.disconnect).toHaveBeenCalledOnce();
  });

  it("clears a disconnected screen and permits a fresh ticket on retry", async () => {
    await start();
    instances.clients[0]!.dispatchEvent(new Event("disconnect"));
    expect(onState).toHaveBeenCalledExactlyOnceWith("disconnected");
    expect(target.replaceChildren).toHaveBeenCalledOnce();
    await start();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(instances.clients).toHaveLength(2);
  });

  it("aborts a pending request on close and ignores its late response", async () => {
    let resolve!: (response: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await start();
    dispose?.();
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
    resolve({ ok: true, status: 200, json: async () => ticket });
    await vi.advanceTimersByTimeAsync(0);
    expect(instances.clients).toHaveLength(0);
    expect(onState).not.toHaveBeenCalled();
  });

  it("disposes once, removes event listeners and timers, and ignores clipboard events", async () => {
    await start();
    const client = instances.clients[0]!;
    client.dispatchEvent(new CustomEvent("clipboard", { detail: { text: "private-clipboard" } }));
    expect(onState).not.toHaveBeenCalled();
    dispose?.();
    dispose?.();
    client.dispatchEvent(new Event("connect"));
    client.dispatchEvent(new Event("securityfailure"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(onState).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out an incomplete handshake with a generic error", async () => {
    await start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onState).toHaveBeenCalledExactlyOnceWith("error");
    expect(instances.clients[0]!.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    { ...ticket, websocketPath: "wss://attacker.example/socket" },
    { ...ticket, websocketPath: "//attacker.example/socket" },
    { ...ticket, websocketPath: "/salesforce-console/socket?secret=private" },
    { ...ticket, password: "" },
    { ...ticket, expiresIn: 601 },
    { ...ticket, expiresIn: 0 },
    null,
  ])("rejects malformed or untrusted tickets without opening a socket %#", async (body) => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body });
    await start();
    expect(onState).toHaveBeenCalledExactlyOnceWith("error");
    expect(instances.clients).toHaveLength(0);
  });
});
