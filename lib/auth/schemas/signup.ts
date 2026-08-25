/**
 * Signup form schema.
 *
 * Validates public registration, strong password policy and distinct legal
 * acceptances before any request reaches Supabase Auth.
 *
 * Field-level messages are intentionally generic — they describe what the
 * field needs, never anything about existing accounts. The Server Action
 * remains responsible for collapsing backend failures into a single generic
 * message per `AUTH_SECURITY.md > Account Enumeration Prevention`.
 *
 * Boundaries:
 * - No Supabase imports.
 * - No environment access.
 * - No logging.
 * - No Service Role usage.
 */

import { z } from "zod";

import { passwordSchema } from "./password";

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Informe seu nome completo." })
      .max(100, { message: "O nome deve ter no máximo 100 caracteres." }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ message: "Informe um e-mail válido." })),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Confirme sua senha." }),
    termsAccepted: z.literal("on", {
      error: "Aceite os Termos de Uso para continuar.",
    }),
    privacyAccepted: z.literal("on", {
      error: "Aceite a Política de Privacidade para continuar.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
