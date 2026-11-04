import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ effect: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: mocks.effect,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { useProductiveTeamRefresh } from "@/app/(protected)/app/equipe-produtiva/_components/useProductiveTeamRefresh";

let documentTarget: EventTarget & { hidden: boolean };
let windowTarget: EventTarget;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  documentTarget = Object.assign(new EventTarget(), { hidden: false });
  windowTarget = new EventTarget();
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  useProductiveTeamRefresh();
  cleanup = mocks.effect.mock.lastCall![0]();
});

afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Equipe Produtiva automatic source reread", () => {
  it("refreshes the authorized current route once every thirty minutes", async () => {
    expect(mocks.refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30 * 60_000 - 1);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("suspends hidden tabs and catches up once on resume without a burst", async () => {
    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(3 * 30 * 60_000);
    expect(mocks.refresh).not.toHaveBeenCalled();
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("online"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("does not refresh before due on focus and removes work when unmounted", async () => {
    windowTarget.dispatchEvent(new Event("focus"));
    expect(mocks.refresh).not.toHaveBeenCalled();
    cleanup?.();
    cleanup = undefined;
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    windowTarget.dispatchEvent(new Event("online"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
