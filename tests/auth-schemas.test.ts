import { describe, expect, it } from "vitest";

import { loginSchema } from "../lib/auth/schemas/login";
import { signupSchema } from "../lib/auth/schemas/signup";

describe("loginSchema", () => {
  it("normaliza e-mail e preserva senha", () => {
    const result = loginSchema.parse({
      email: "  USER@EXAMPLE.COM  ",
      password: "senha-existente",
    });

    expect(result).toEqual({
      email: "user@example.com",
      password: "senha-existente",
    });
  });

  it("rejeita e-mail inválido e senha vazia", () => {
    expect(loginSchema.safeParse({ email: "invalido", password: "" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validInput = {
    name: "Pessoa Usuária",
    email: "pessoa@example.com",
    password: "Senha-segura1!",
    confirmPassword: "Senha-segura1!",
    termsAccepted: "on",
    privacyAccepted: "on",
  };

  it("aceita cadastro consistente", () => {
    expect(signupSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita confirmação de senha divergente", () => {
    const result = signupSchema.safeParse({
      ...validInput,
      confirmPassword: "outra-senha",
    });

    expect(result.success).toBe(false);
  });

  it("exige aceites legais separados do consentimento de cookies", () => {
    const withoutLegalAcceptance = {
      name: validInput.name,
      email: validInput.email,
      password: validInput.password,
      confirmPassword: validInput.confirmPassword,
    };

    expect(signupSchema.safeParse(withoutLegalAcceptance).success).toBe(false);
    expect(
      signupSchema.safeParse({
        ...validInput,
        privacyAccepted: "off",
      }).success,
    ).toBe(false);
  });
});
