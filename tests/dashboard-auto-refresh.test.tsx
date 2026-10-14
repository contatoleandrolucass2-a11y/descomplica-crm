import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ effect: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: mocks.effect,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { DashboardAutoRefresh } from "@/app/(protected)/app/_components/DashboardAutoRefresh";

const version = {
  generatedAt: "2026-10-14T12:33:00.123456+00:00",
  updatedAt: "2026-10-14T12:33:05.123456+00:00",
};
let documentTarget: EventTarget & { hidden: boolean };
let windowTarget: EventTarget;
let cleanup: (() => void) | undefined;
const fetchMock = vi.fn();

function mount(props: { generatedAt: string | null; updatedAt: string | null } = version) {
  expect(DashboardAutoRefresh(props)).toBeNull();
  cleanup = mocks.effect.mock.lastCall![0]();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  documentTarget = Object.assign(new EventTarget(), { hidden: false });
  windowTarget = new EventTarget();
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => Response.json(version));
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dashboard published snapshot refresh", () => {
  it("checks on mount and every 30 seconds without refreshing unchanged values", async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/dashboard/status", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each(["generatedAt", "updatedAt"] as const)("refreshes after %s changes", async (key) => {
    fetchMock.mockImplementation(async () =>
      Response.json({ ...version, [key]: "2026-10-14T13:03:00.123457+00:00" }),
    );
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not confuse a collection or ingestion attempt with a new snapshot", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        ...version,
        ingestion: { status: "running", completedAt: null },
        refresh: { status: "succeeded", requestedAt: "2026-10-14T14:00:00Z" },
      }),
    );
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("deduplicates refreshes until new props arrive and retries after a bounded failure wait", async () => {
    const published = { ...version, updatedAt: "2026-10-14T13:03:00.123457+00:00" };
    fetchMock.mockImplementation(async () => Response.json(published));
    mount();
    await vi.advanceTimersByTimeAsync(0);
    for (const event of ["focus", "online", "focus"]) {
      windowTarget.dispatchEvent(new Event(event));
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    cleanup?.();
    mount(published);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes when the first snapshot appears and when a snapshot disappears", async () => {
    mount({ generatedAt: null, updatedAt: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    cleanup?.();
    fetchMock.mockImplementation(async () => Response.json({ generatedAt: null, updatedAt: null }));
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it.each(["focus", "online"])("checks immediately on %s", async (event) => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    windowTarget.dispatchEvent(new Event(event));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pauses hidden tabs and resumes immediately", async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([{}, { ...version, updatedAt: "invalid" }, { ...version, updatedAt: null }])(
    "ignores malformed versions and retries",
    async (payload) => {
      fetchMock.mockImplementation(async () => Response.json(payload));
      mount();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mocks.refresh).not.toHaveBeenCalled();
    },
  );

  it("retries an unavailable status without claiming a new snapshot", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 503 }));
    mount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([401, 403])("refreshes authorization once and stops after HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    mount();
    await vi.advanceTimersByTimeAsync(60_000);
    windowTarget.dispatchEvent(new Event("focus"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates pending probes, aborts timed out requests and retries", async () => {
    fetchMock.mockImplementation(
      (_url, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    mount();
    windowTarget.dispatchEvent(new Event("focus"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("cleans timers/listeners and ignores late responses after unmount", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    mount();
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    cleanup?.();
    cleanup = undefined;
    resolve(Response.json({ ...version, updatedAt: "2026-10-14T14:00:00Z" }));
    windowTarget.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
