import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserPresenceHeartbeat } from "@/app/(protected)/_components/UserPresenceHeartbeat";
import { startUserPresenceHeartbeat } from "@/lib/authorization/presence-heartbeat";

class VisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  change(visibility: DocumentVisibilityState) {
    this.visibilityState = visibility;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function environment() {
  return {
    visibility: new VisibilityTarget(),
    onlineEvents: new EventTarget(),
    fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
  };
}

function pendingUntilAborted(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      {
        once: true,
      },
    );
  });
}

describe("user presence heartbeat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders no markup or request on the server", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(renderToStaticMarkup(createElement(UserPresenceHeartbeat))).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sends a bodyless same-origin heartbeat on mount and every thirty seconds", async () => {
    const browser = environment();
    const stop = startUserPresenceHeartbeat(browser);
    expect(browser.fetch).toHaveBeenCalledExactlyOnceWith("/api/presence", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(browser.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    stop();
  });

  it("sends only while visible and resumes immediately when the tab returns", async () => {
    const browser = environment();
    browser.visibility.visibilityState = "hidden";
    const stop = startUserPresenceHeartbeat(browser);
    await vi.advanceTimersByTimeAsync(60_000);
    browser.onlineEvents.dispatchEvent(new Event("online"));
    expect(browser.fetch).not.toHaveBeenCalled();

    browser.visibility.change("visible");
    expect(browser.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    browser.visibility.change("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(browser.fetch).toHaveBeenCalledTimes(1);
    browser.visibility.change("visible");
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    stop();
  });

  it("retries immediately when connectivity returns without overlapping requests", async () => {
    const browser = environment();
    browser.fetch.mockImplementationOnce(pendingUntilAborted);
    const stop = startUserPresenceHeartbeat(browser);
    browser.onlineEvents.dispatchEvent(new Event("online"));
    browser.visibility.change("visible");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(browser.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    browser.onlineEvents.dispatchEvent(new Event("online"));
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    stop();
  });

  it("aborts a stalled request after ten seconds and retries on the next cycle", async () => {
    const browser = environment();
    browser.fetch.mockImplementationOnce(pendingUntilAborted);
    const stop = startUserPresenceHeartbeat(browser);
    const signal = browser.fetch.mock.calls[0]![1]!.signal!;
    await vi.advanceTimersByTimeAsync(9_999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(browser.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    stop();
  });

  it.each([401, 403])("stops on HTTP %s until a new mount", async (status) => {
    const browser = environment();
    browser.fetch.mockResolvedValueOnce(new Response(null, { status }));
    const stop = startUserPresenceHeartbeat(browser);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    browser.onlineEvents.dispatchEvent(new Event("online"));
    browser.visibility.change("visible");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(browser.fetch).toHaveBeenCalledTimes(1);
    stop();

    const stopRemounted = startUserPresenceHeartbeat(browser);
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    stopRemounted();
  });

  it("recovers from network errors and server failures on later cycles", async () => {
    const browser = environment();
    browser.fetch
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const stop = startUserPresenceHeartbeat(browser);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(browser.fetch).toHaveBeenCalledTimes(3);
    stop();
  });

  it("cleans up timers, listeners and the active request without sending a logout", async () => {
    const browser = environment();
    browser.fetch.mockImplementationOnce(pendingUntilAborted);
    const removeVisibility = vi.spyOn(browser.visibility, "removeEventListener");
    const removeOnline = vi.spyOn(browser.onlineEvents, "removeEventListener");
    const stop = startUserPresenceHeartbeat(browser);
    const signal = browser.fetch.mock.calls[0]![1]!.signal!;
    stop();
    stop();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeVisibility).toHaveBeenCalledExactlyOnceWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeOnline).toHaveBeenCalledExactlyOnceWith("online", expect.any(Function));
    browser.visibility.change("visible");
    browser.onlineEvents.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(browser.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps each tab independent when another tab unmounts", async () => {
    const firstTab = environment();
    const secondTab = environment();
    const stopFirst = startUserPresenceHeartbeat(firstTab);
    const stopSecond = startUserPresenceHeartbeat(secondTab);
    await vi.advanceTimersByTimeAsync(0);
    stopFirst();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(firstTab.fetch).toHaveBeenCalledTimes(1);
    expect(secondTab.fetch).toHaveBeenCalledTimes(3);
    stopSecond();
  });
});
