import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

import { requestPasswordRecoveryAction } from "../lib/auth/actions/recovery";

const GENERIC_RESPONSE = {
  status: "success" as const,
  message:
    "Se houver uma conta elegível para esse e-mail, enviaremos as instruções de redefinição.",
};

function recoveryRequest(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("password recovery request action", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://crm.example.test");
    mocks.createClient.mockReset();
    mocks.resetPasswordForEmail.mockReset();
    mocks.createClient.mockResolvedValue({
      auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
    });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("normalizes the email and uses only the canonical application callback", async () => {
    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("  USER@EXAMPLE.COM "),
    );

    expect(mocks.createClient).toHaveBeenCalledWith({ persistence: { kind: "temporary" } });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledOnce();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://crm.example.test/auth/callback",
    });
    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it.each([
    ["provider failure", new Error("SMTP rejected")],
    ["rate limit", Object.assign(new Error("rate limit exceeded"), { status: 429 })],
  ])("keeps the anti-enumeration response when Auth resolves with %s", async (_case, failure) => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: null, error: failure });

    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("person@example.com"),
    );

    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it("keeps the anti-enumeration response when the Auth client throws", async () => {
    mocks.createClient.mockRejectedValue(new Error("network or runtime failure"));

    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("person@example.com"),
    );

    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it("keeps the anti-enumeration response when the recovery request throws", async () => {
    mocks.resetPasswordForEmail.mockRejectedValue(new Error("transport failure"));

    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("person@example.com"),
    );

    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it("returns the same response without contacting Auth for an invalid email", async () => {
    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("not-an-email"),
    );

    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it("fails closed when the canonical application origin is unavailable", async () => {
    vi.stubEnv("APP_ORIGIN", "https://crm.example.test/untrusted-path");

    const result = await requestPasswordRecoveryAction(
      { status: "idle", message: "" },
      recoveryRequest("person@example.com"),
    );

    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result).toEqual(GENERIC_RESPONSE);
  });
});
