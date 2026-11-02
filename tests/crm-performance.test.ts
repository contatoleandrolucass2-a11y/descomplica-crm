import { afterEach, describe, expect, it, vi } from "vitest";
import { measureCrmPhase } from "@/lib/crm/performance";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("aggregate performance measurements", () => {
  it("records returned RPC errors without changing the rollout/error contract", async () => {
    const observer = vi.fn();
    const result = { data: null, error: { code: "42501", message: "private detail" } };
    await expect(
      measureCrmPhase("appointments", "goals", async () => result, observer),
    ).resolves.toBe(result);
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
    expect(JSON.stringify(observer.mock.calls)).not.toContain("private detail");
  });
  it("preserves results and records success without payload fields", async () => {
    const observer = vi.fn();
    const privateResult = { email: "private@example.invalid", token: "never-log" };
    await expect(
      measureCrmPhase("repasse", "record", async () => privateResult, observer),
    ).resolves.toBe(privateResult);
    expect(observer).toHaveBeenCalledWith({
      route: "repasse",
      phase: "record",
      outcome: "passed",
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(observer.mock.calls)).not.toContain("never-log");
  });

  it("preserves the original failure even when observation fails", async () => {
    const failure = new Error("private upstream details");
    const observer = vi.fn(() => {
      throw new Error("observer failed");
    });
    await expect(
      measureCrmPhase(
        "appointments",
        "loader",
        async () => {
          throw failure;
        },
        observer,
      ),
    ).rejects.toBe(failure);
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
    expect(JSON.stringify(observer.mock.calls)).not.toContain("upstream");
  });

  it("is opt-in and sanitizes revision on the existing log destination", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await measureCrmPhase("stages", "loader", async () => null);
    expect(log).not.toHaveBeenCalled();
    vi.stubEnv("CRM_PERFORMANCE_LOGS", "true");
    vi.stubEnv("DEPLOYMENT_VERSION", "private arbitrary value");
    await measureCrmPhase("stages", "loader", async () => null);
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({
      event: "crm.performance",
      revision: null,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private arbitrary value");
  });
});
