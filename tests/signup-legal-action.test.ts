import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homologation/config", () => ({ isPublicSignupEnabled: () => true }));

import { signupAction } from "../lib/auth/actions/signup";
import { LEGAL_DOCUMENT_VERSIONS } from "../lib/legal/documents";

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
    mocks.signUp.mockReset();
    mocks.createClient.mockReset();
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

  it("collapses backend failures into the generic registration response", async () => {
    mocks.signUp.mockResolvedValue({ error: new Error("internal detail") });

    const result = await signupAction({ success: false, message: "" }, validRegistration());

    expect(result).toEqual({
      success: false,
      message: "Não foi possível concluir o cadastro. Tente novamente em instantes.",
    });
  });
});
