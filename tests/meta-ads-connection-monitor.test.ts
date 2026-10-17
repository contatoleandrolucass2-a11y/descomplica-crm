import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMetaAdsConnectionMonitor } from "@/app/(protected)/app/configuracoes/conectar-sistemas/meta-ads-connection";
import { emptyMetaAdsConnectionSnapshot } from "@/lib/crm/meta-ads/connection-contract";

const connected = {
  ...emptyMetaAdsConnectionSnapshot("connected"),
  checkedAt: "2026-10-16T10:00:00Z",
  receivedAt: "2026-10-16T10:00:01Z",
};
const fetchMock = vi.fn();
const onSnapshot = vi.fn();
const onChecking = vi.fn();
let documentTarget: EventTarget & { hidden: boolean };
let monitor: ReturnType<typeof startMetaAdsConnectionMonitor> | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  documentTarget = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => Response.json(connected));
});
afterEach(() => {
  monitor?.dispose();
  monitor = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function start(configured = true) {
  monitor = startMetaAdsConnectionMonitor({ configured, onSnapshot, onChecking });
  await vi.advanceTimersByTimeAsync(0);
}

describe("Meta Ads independent connection monitor", () => {
  it("polls only Meta Ads with session evidence, never the Salesforce endpoint", async () => {
    await start();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/meta-ads/status", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
    expect(onSnapshot.mock.calls).toEqual([
      [emptyMetaAdsConnectionSnapshot("waiting")],
      [connected],
    ]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onChecking.mock.calls).toEqual([[false], [true], [false], [true], [false]]);
  });

  it("clears previous evidence after configuration removal and waits for manual verification", async () => {
    await start();
    expect(onSnapshot).toHaveBeenLastCalledWith(connected);
    monitor!.dispose();
    fetchMock.mockClear();
    await start(false);
    expect(onSnapshot).toHaveBeenLastCalledWith(emptyMetaAdsConnectionSnapshot("unconfigured"));
    expect(onChecking).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).not.toHaveBeenCalled();
    monitor!.verify();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...connected, accountId: "another-account" },
    { ...connected, businessId: "another-business" },
    { ...connected, checkedAt: null },
    { ...connected, receivedAt: null },
    { ...connected, state: "unknown" },
    { ...connected, checkedAt: "invalid" },
  ])("does not label malformed account or session evidence as connected %#", async (body) => {
    fetchMock.mockImplementation(async () => Response.json(body));
    await start();
    expect(onSnapshot).toHaveBeenLastCalledWith(emptyMetaAdsConnectionSnapshot("unavailable"));
  });

  it.each([401, 403, 503])("clears the session evidence after HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("private upstream details", { status }));
    await start();
    expect(onSnapshot).toHaveBeenLastCalledWith(emptyMetaAdsConnectionSnapshot("unavailable"));
  });

  it("preserves explicit wrong-account and expired evidence from the server", async () => {
    for (const state of ["wrong_account", "stale"] as const) {
      fetchMock.mockImplementation(async () => Response.json({ ...connected, state }));
      if (!monitor) await start();
      else {
        monitor.verify();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(onSnapshot).toHaveBeenLastCalledWith({ ...connected, state });
    }
  });

  it("cancels hidden requests and starts fresh on resume without accepting late evidence", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    await start();
    const firstSignal = fetchMock.mock.calls[0]![1].signal;
    documentTarget.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(firstSignal.aborted).toBe(true);
    expect(onSnapshot).toHaveBeenLastCalledWith(emptyMetaAdsConnectionSnapshot("waiting"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    documentTarget.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenLastCalledWith(connected);
    const updates = onSnapshot.mock.calls.length;
    resolve(Response.json({ ...connected, state: "wrong_account" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(onSnapshot).toHaveBeenCalledTimes(updates);
  });

  it("deduplicates requests, times out, and releases all work on unmount", async () => {
    fetchMock.mockImplementation(
      (_path, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("Aborted")));
        }),
    );
    await start();
    monitor!.verify();
    monitor!.verify();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onSnapshot).toHaveBeenLastCalledWith(emptyMetaAdsConnectionSnapshot("unavailable"));
    expect(onChecking).toHaveBeenLastCalledWith(false);
    monitor!.dispose();
    expect(vi.getTimerCount()).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
