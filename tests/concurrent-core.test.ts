import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error JavaScript QA harness, exercised directly without changing production code.
import * as concurrentCore from "../scripts/qa/concurrent-core.mjs";

const { assertBatchPassed, durationSummary, loopbackOrigin, runConcurrentBatch } = concurrentCore;

describe("bounded concurrent QA runner (synthetic infrastructure, not product capacity)", () => {
  it("measures twenty overlapping real loopback HTTP requests and preserves responses", async () => {
    let active = 0;
    let peak = 0;
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const server = createServer(async (request, response) => {
      active += 1;
      peak = Math.max(peak, active);
      if (++arrived === 20) release();
      await barrier;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ proposal: request.url }));
      active -= 1;
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No loopback port");
    try {
      const result = await runConcurrentBatch(
        Array.from({ length: 20 }, (_, index) => async (signal: AbortSignal) => {
          const response = await fetch(`http://127.0.0.1:${address.port}/${index}`, { signal });
          expect(await response.json()).toEqual({ proposal: `/${index}` });
        }),
        { timeoutMs: 2_000 },
      );
      expect(result).toMatchObject({
        planned: 20,
        started: 20,
        passed: 20,
        errors: 0,
        peakInFlight: 20,
        durations: { samples: 20 },
      });
      expect(peak).toBe(20);
      expect(result.durations.p95Ms).toBeGreaterThanOrEqual(result.durations.p50Ms);
      expect(() => assertBatchPassed(result)).not.toThrow();
    } finally {
      release();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("reports nearest-rank percentiles without inventing empty measurements", () => {
    expect(durationSummary([])).toEqual({ samples: 0, p50Ms: null, p95Ms: null });
    expect(durationSummary(Array.from({ length: 20 }, (_, index) => (index + 1) * 10))).toEqual({
      samples: 20,
      p50Ms: 100,
      p95Ms: 190,
    });
  });

  it("bounds workers, drains normal failures and redacts errors", async () => {
    let active = 0;
    let peak = 0;
    const result = await runConcurrentBatch(
      Array.from({ length: 9 }, (_, index) => async () => {
        active += 1;
        peak = Math.max(peak, active);
        await delay(5);
        active -= 1;
        if (index === 1) throw new Error("SECRET cookie/token/password must never enter evidence");
      }),
      { concurrency: 3 },
    );
    expect(peak).toBe(3);
    expect(active).toBe(0);
    expect(result).toMatchObject({
      passed: 8,
      errors: 1,
      peakInFlight: 3,
      failureCodes: [{ index: 1, code: "unexpected_error" }],
    });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(() => assertBatchPassed(result)).toThrow("concurrent_batch_failed");
  });

  it("aborts timed out work and never starts queued work after the timeout", async () => {
    const onTimeout = vi.fn();
    const queued = vi.fn();
    let aborted = false;
    const result = await runConcurrentBatch(
      [
        (signal: AbortSignal) =>
          new Promise<void>((resolve) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                resolve();
              },
              { once: true },
            );
          }),
        queued,
      ],
      { concurrency: 1, timeoutMs: 20, onTimeout },
    );
    expect(aborted).toBe(true);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(queued).not.toHaveBeenCalled();
    expect(result).toMatchObject({ started: 1, passed: 0, errors: 2, timeouts: 1, cancelled: 1 });
  });

  it("cancels active workers and leaves queued requests unstarted", async () => {
    const controller = new AbortController();
    let starts = 0;
    const promise = runConcurrentBatch(
      Array.from({ length: 5 }, () => (signal: AbortSignal) => {
        starts += 1;
        return delay(1_000, undefined, { signal });
      }),
      { concurrency: 2, signal: controller.signal },
    );
    await delay(5);
    controller.abort();
    const result = await promise;
    expect(starts).toBe(2);
    expect(result).toMatchObject({ started: 2, passed: 0, errors: 5, cancelled: 5 });
  });

  it("does not launch work for an already cancelled signal", async () => {
    const job = vi.fn();
    const result = await runConcurrentBatch([job], { signal: AbortSignal.abort() });
    expect(job).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      started: 0,
      cancelled: 1,
      durations: { samples: 0, p50Ms: null, p95Ms: null },
    });
  });

  it.each([0, 21, 1.5, Infinity])("rejects unbounded concurrency %s", async (concurrency) => {
    await expect(runConcurrentBatch([vi.fn()], { concurrency })).rejects.toThrow(
      "invalid_concurrency",
    );
  });

  it.each([
    "https://127.0.0.1",
    "https://crm.example.com",
    "http://user:password@localhost",
    "http://localhost/path",
    "http://localhost?token=secret",
    "http://localhost#x",
    "not-url",
  ])("rejects nonlocal or credential-bearing origin %s", (origin) => {
    expect(() => loopbackOrigin(origin)).toThrow("invalid_local_origin");
  });

  it("allows only plain credential-free loopback origins", () => {
    for (const origin of ["http://127.0.0.1:4173", "http://localhost:4173", "http://[::1]:4173"])
      expect(loopbackOrigin(origin)).toBe(origin);
  });
});
