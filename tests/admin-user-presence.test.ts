import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startUserPresencePolling } from "@/app/(protected)/admin/usuarios/useUserPresence";

class VisibilityTarget extends EventTarget {
  visibilityState = "visible";
}

const userId = "d4100000-0000-4000-8000-000000000001";
const secondUserId = "d4100000-0000-4000-8000-000000000002";
let documentTarget: VisibilityTarget;
let windowTarget: EventTarget;
let cleanup: (() => void) | undefined;
const fetchMock = vi.fn();

function payload(isOnline = true) {
  return {
    users: [{ userId, lastSeenAt: new Date().toISOString(), isOnline }],
    observedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T20:00:00.000Z"));
  documentTarget = new VisibilityTarget();
  windowTarget = new EventTarget();
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => Response.json(payload()));
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("admin user presence polling", () => {
  it("loads at mount and every 30 seconds without sending user identity in the request", async () => {
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/admin/users/presence", {
      cache: "no-store",
      credentials: "same-origin",
      signal: expect.any(AbortSignal),
    });
    expect(onChange.mock.lastCall?.[0].get(userId)).toMatchObject({ status: "online" });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and resumes on visibility, focus, and network restoration", async () => {
    documentTarget.visibilityState = "hidden";
    cleanup = startUserPresencePolling([userId], vi.fn());
    await vi.advanceTimersByTimeAsync(90_000);
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("online"));
    expect(fetchMock).not.toHaveBeenCalled();
    documentTarget.visibilityState = "visible";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    windowTarget.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    windowTarget.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses only returned IDs present in props and never substitutes an email match", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...payload(),
        users: [
          { userId, lastSeenAt: null, isOnline: false },
          { userId: "other-user", email: userId, lastSeenAt: null, isOnline: true },
        ],
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId, secondUserId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    expect([...onChange.mock.lastCall?.[0].entries()]).toEqual([
      [userId, { status: "offline", lastSeenAt: null }],
      [secondUserId, { status: "unknown", lastSeenAt: null }],
    ]);
  });

  it.each([401, 403, 500])(
    "marks presence unavailable on HTTP %i instead of offline",
    async (status) => {
      const onChange = vi.fn();
      cleanup = startUserPresencePolling([userId], onChange);
      await vi.advanceTimersByTimeAsync(0);
      fetchMock.mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status }));
      await vi.advanceTimersByTimeAsync(30_000);
      expect(onChange.mock.lastCall?.[0].get(userId)).toEqual({
        status: "unknown",
        lastSeenAt: null,
      });
    },
  );

  it("expires a successful result after 90 seconds without another success", async () => {
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    documentTarget.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(89_999);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("online");
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("unknown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["2020-01-01T00:00:00.000Z", "2040-01-01T00:00:00.000Z"])(
    "expires a 119-second-old online signal after one second despite client clock %s",
    async (clientTime) => {
      vi.setSystemTime(new Date(clientTime));
      fetchMock.mockResolvedValueOnce(
        Response.json({
          observedAt: "2026-10-14T20:00:00.000Z",
          users: [{ userId, lastSeenAt: "2026-10-14T19:58:01.000Z", isOnline: true }],
        }),
      );
      const onChange = vi.fn();
      cleanup = startUserPresencePolling([userId], onChange);
      await vi.advanceTimersByTimeAsync(0);
      documentTarget.visibilityState = "hidden";
      await vi.advanceTimersByTimeAsync(999);
      expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("online");
      await vi.advanceTimersByTimeAsync(1);
      expect(onChange.mock.lastCall?.[0].get(userId)).toEqual({
        status: "unknown",
        lastSeenAt: null,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("expires online users independently while preserving Offline for the snapshot's 90 seconds", async () => {
    const thirdUserId = "d4100000-0000-4000-8000-000000000003";
    fetchMock.mockResolvedValueOnce(
      Response.json({
        observedAt: "2026-10-14T20:00:00.000Z",
        users: [
          { userId, lastSeenAt: "2026-10-14T19:58:01.000Z", isOnline: true },
          { userId: secondUserId, lastSeenAt: "2026-10-14T19:58:30.000Z", isOnline: true },
          { userId: thirdUserId, lastSeenAt: null, isOnline: false },
        ],
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId, secondUserId, thirdUserId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    documentTarget.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(1_000);
    expect([...onChange.mock.lastCall?.[0].values()].map((item) => item.status)).toEqual([
      "unknown",
      "online",
      "offline",
    ]);
    await vi.advanceTimersByTimeAsync(29_000);
    expect([...onChange.mock.lastCall?.[0].values()].map((item) => item.status)).toEqual([
      "unknown",
      "unknown",
      "offline",
    ]);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(onChange.mock.lastCall?.[0].get(thirdUserId).status).toBe("offline");
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange.mock.lastCall?.[0].get(thirdUserId).status).toBe("unknown");
  });

  it("expires an old online signal before refreshing after background timer throttling", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    fetchMock.mockResolvedValueOnce(
      Response.json({
        observedAt: "2026-10-14T20:00:00.000Z",
        users: [{ userId, lastSeenAt: "2026-10-14T19:58:01.000Z", isOnline: true }],
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("online");
    documentTarget.visibilityState = "hidden";
    // A suspended background tab can resume after its deadline without any
    // timeout callback having run. The visibility handler must recheck elapsed time.
    elapsed = 2_000;
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));
    documentTarget.visibilityState = "visible";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("unknown");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    "2026-10-14T20:00:00.001Z",
    "2026-10-14T19:58:00.000Z",
    "2026-10-14T19:57:59.999Z",
  ])("rejects an inconsistent online lastSeenAt value: %s", async (lastSeenAt) => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        observedAt: "2026-10-14T20:00:00.000Z",
        users: [{ userId, lastSeenAt, isOnline: true }],
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange.mock.lastCall?.[0].get(userId)).toEqual({
      status: "unknown",
      lastSeenAt: null,
    });
  });

  it("aborts after 10 seconds, ignores late responses, and does not overlap requests", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("unknown");
    resolve(Response.json(payload()));
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledTimes(1);
    windowTarget.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("online");
  });

  it("removes timers and listeners, aborts requests, and ignores completion after unmount", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    cleanup();
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("online"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    resolve(Response.json(payload()));
    await vi.advanceTimersByTimeAsync(100_000);
    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { users: [], observedAt: "not-a-date" },
    { ...payload(), users: [{ userId, lastSeenAt: null, isOnline: "yes" }] },
    { ...payload(), users: [{ userId, lastSeenAt: "invalid", isOnline: true }] },
    { ...payload(), users: [...payload().users, ...payload().users] },
  ])("marks malformed responses unavailable: %j", async (invalid) => {
    fetchMock.mockResolvedValueOnce(Response.json(invalid));
    const onChange = vi.fn();
    cleanup = startUserPresencePolling([userId], onChange);
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange.mock.lastCall?.[0].get(userId).status).toBe("unknown");
  });

  it("does not query when the accessible user list is empty", async () => {
    cleanup = startUserPresencePolling([], vi.fn());
    await vi.advanceTimersByTimeAsync(100_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
