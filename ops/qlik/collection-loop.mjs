const MAX_TIMER_MS = 2_147_483_647;
const timersDefault = { setTimeout, clearTimeout };

function waitForInterval(intervalMs, signal, timers) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      timers.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = timers.setTimeout(finish, intervalMs);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

/**
 * collect({ signal }) returns { state: "succeeded" | "reauth_required" | "unavailable" }.
 * Unknown results fail closed. No other result fields or error details are emitted.
 * onStatus receives only { state }; async observers are awaited, failures ignored.
 * clock returns monotonic milliseconds; timers expose setTimeout/clearTimeout.
 * The first cycle starts immediately; subsequent intervals start after settlement.
 * Timeout requests cancellation, but cannot force a callback to settle. Both collect
 * and onStatus must settle cooperatively for shutdown to finish. No cycle overlaps.
 * The owner supplies authorization/preflight, data publication and the stop signal.
 */
export async function startQlikCollectionLoop({
  collect,
  onStatus = () => {},
  signal,
  intervalMs = 3_600_000,
  timeoutMs = 120_000,
  clock = () => performance.now(),
  timers = timersDefault,
}) {
  if (
    typeof collect !== "function" ||
    typeof onStatus !== "function" ||
    !(signal instanceof AbortSignal) ||
    typeof clock !== "function" ||
    typeof timers?.setTimeout !== "function" ||
    typeof timers?.clearTimeout !== "function" ||
    ![intervalMs, timeoutMs].every(
      (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMER_MS,
    )
  ) {
    throw new TypeError("invalid_collection_loop_options");
  }

  async function emit(state) {
    try {
      await onStatus(Object.freeze({ state }));
    } catch {
      // Observer failures must not expose upstream details or restart collection.
    }
  }

  while (!signal.aborted) {
    const cycle = new AbortController();
    const stop = () => cycle.abort();
    signal.addEventListener("abort", stop, { once: true });
    let timer;
    let timedOut = false;
    let state = "unavailable";
    try {
      const startedAt = clock();
      if (!Number.isFinite(startedAt)) throw new Error("invalid_collection_clock");
      timer = timers.setTimeout(() => {
        timedOut = true;
        cycle.abort();
      }, timeoutMs);
      await emit("running");
      const beforeCollect = clock() - startedAt;
      if (
        !signal.aborted &&
        !cycle.signal.aborted &&
        Number.isFinite(beforeCollect) &&
        beforeCollect >= 0 &&
        beforeCollect < timeoutMs
      ) {
        const result = await collect({ signal: cycle.signal });
        const elapsed = clock() - startedAt;
        // A blocked event loop can settle the callback before its overdue timer runs.
        if (!timedOut && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < timeoutMs) {
          const reported = result?.state;
          if (["succeeded", "reauth_required", "unavailable"].includes(reported)) {
            state = reported;
          }
        }
      }
    } catch {
      state = "unavailable";
    } finally {
      if (timer !== undefined) timers.clearTimeout(timer);
      signal.removeEventListener("abort", stop);
    }
    if (signal.aborted) return;
    await emit(state);
    await waitForInterval(intervalMs, signal, timers);
  }
}
