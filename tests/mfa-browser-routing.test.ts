import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyMfaViaRoute } from "@/lib/auth/mfa/browser";

afterEach(() => vi.unstubAllGlobals());

describe("MFA destination after verification", () => {
  it.each([
    ["challenge", "/"],
    ["enrollment", "/conta/seguranca?mfa=enabled"],
  ])("resolves the authorized home for %s", async (flow, destination) => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const form = new FormData();
    form.set("flow", flow);
    await verifyMfaViaRoute({ status: "idle" }, form);
    expect(assign).toHaveBeenCalledExactlyOnceWith(destination);
  });

  it("does not navigate when MFA verification fails", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const form = new FormData();
    form.set("flow", "challenge");
    expect((await verifyMfaViaRoute({ status: "idle" }, form)).status).toBe("error");
    expect(assign).not.toHaveBeenCalled();
  });
});
