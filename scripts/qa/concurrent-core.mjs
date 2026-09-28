import { performance } from "node:perf_hooks";

export class ConcurrentQaError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function check(condition, code) {
  if (!condition) throw new ConcurrentQaError(code);
}

export function loopbackOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConcurrentQaError("invalid_local_origin");
  }
  check(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "invalid_local_origin",
  );
  return url.origin;
}

export function durationSummary(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) =>
    sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 100) / 100 : null;
  return { samples: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
}

// Durations include response-body reading and assertions. Concurrency is client-side
// logical work in flight, not observed server workers or a production capacity claim.
export async function runConcurrentBatch(
  jobs,
  { concurrency = 20, timeoutMs = 30_000, signal, onTimeout = () => {} } = {},
) {
  check(
    Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 20,
    "invalid_concurrency",
  );
  check(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 90_000, "invalid_timeout");
  check(Array.isArray(jobs) && jobs.length > 0 && jobs.length <= 80, "invalid_job_count");
  const records = new Array(jobs.length);
  let cursor = 0;
  let active = 0;
  let peakInFlight = 0;
  let stopped = false;
  const started = performance.now();

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++;
      if (signal?.aborted || stopped) {
        records[index] = { index, outcome: "cancelled", durationMs: null };
        continue;
      }
      const controller = new AbortController();
      const operationSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;
      const timer = setTimeout(() => {
        stopped = true;
        controller.abort();
        onTimeout();
      }, timeoutMs);
      const operationStarted = performance.now();
      active += 1;
      peakInFlight = Math.max(peakInFlight, active);
      let onAbort;
      try {
        const cancelled = new Promise((_, reject) => {
          onAbort = () =>
            reject(new ConcurrentQaError(controller.signal.aborted ? "timeout" : "cancelled"));
          operationSignal.addEventListener("abort", onAbort, { once: true });
        });
        await Promise.race([Promise.resolve().then(() => jobs[index](operationSignal)), cancelled]);
        records[index] = { index, outcome: "passed" };
      } catch (error) {
        // Never serialize raw Playwright errors: call logs may contain credentials.
        records[index] = {
          index,
          outcome: error instanceof ConcurrentQaError ? error.code : "unexpected_error",
        };
      } finally {
        operationSignal.removeEventListener("abort", onAbort);
        clearTimeout(timer);
        active -= 1;
        records[index].durationMs = performance.now() - operationStarted;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  const failures = records.filter((record) => record.outcome !== "passed");
  return {
    planned: jobs.length,
    started: records.filter((record) => record.durationMs !== null).length,
    passed: records.length - failures.length,
    errors: failures.length,
    timeouts: records.filter((record) => record.outcome === "timeout").length,
    cancelled: records.filter((record) => record.outcome === "cancelled").length,
    concurrencyLimit: concurrency,
    peakInFlight,
    wallMs: Math.round(performance.now() - started),
    durations: durationSummary(
      records.flatMap((record) => (record.durationMs === null ? [] : [record.durationMs])),
    ),
    failureCodes: failures.map(({ index, outcome }) => ({ index, code: outcome })),
  };
}

export function assertBatchPassed(result) {
  check(result.errors === 0 && result.started === result.planned, "concurrent_batch_failed");
}
