import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homologation/config", () => ({ isPublicSignupEnabled: () => true }));

import { signupAction } from "../lib/auth/actions/signup";
import { LEGAL_DOCUMENT_VERSIONS } from "../lib/legal/documents";

const GENERIC_ACKNOWLEDGEMENT = {
  success: true,
  message: "Cadastro recebido. Verifique seu e-mail ou faça login se sua conta já estiver ativa.",
};

function validRegistration(): FormData {
  const formData = new FormData();
  formData.set("name", "Pessoa QA");
  formData.set("email", "legal.qa@local.invalid");
  formData.set("password", "Senha-forte1!");
  formData.set("confirmPassword", "Senha-forte1!");
  formData.set("termsAccepted", "on");
  formData.set("privacyAccepted", "on");
  return formData;
}

describe("signup legal acceptance bridge", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.signUp.mockReset();
    mocks.createClient.mockResolvedValue({ auth: { signUp: mocks.signUp } });
    mocks.signUp.mockResolvedValue({ error: null });
  });

  it("does not call Supabase unless both legal documents are accepted", async () => {
    const formData = validRegistration();
    formData.delete("privacyAccepted");

    const result = await signupAction({ success: false, message: "" }, formData);

    expect(result.success).toBe(false);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("sends the exact current versions as separate legal metadata", async () => {
    const result = await signupAction({ success: false, message: "" }, validRegistration());

    expect(result.success).toBe(true);
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "legal.qa@local.invalid",
      password: "Senha-forte1!",
      options: {
        data: {
          name: "Pessoa QA",
          legal_acceptance: {
            termsAccepted: true,
            termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
            privacyAccepted: true,
            privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
          },
        },
      },
    });
  });

  it("returns the same public acknowledgement when Auth resolves with a provider error", async () => {
    mocks.signUp.mockResolvedValue({ error: new Error("internal provider detail") });

    const result = await signupAction({ success: false, message: "" }, validRegistration());

    expect(result).toEqual(GENERIC_ACKNOWLEDGEMENT);
  });

  it("returns the same public acknowledgement when the Auth client throws", async () => {
    mocks.createClient.mockRejectedValue(new Error("network or runtime failure"));

    const result = await signupAction({ success: false, message: "" }, validRegistration());

    expect(result).toEqual(GENERIC_ACKNOWLEDGEMENT);
  });

  it("returns the same public acknowledgement when sign-up throws", async () => {
    mocks.signUp.mockRejectedValue(new Error("transport failure"));

    const result = await signupAction({ success: false, message: "" }, validRegistration());

    expect(result).toEqual(GENERIC_ACKNOWLEDGEMENT);
  });
});
