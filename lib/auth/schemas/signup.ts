/**
 * Signup form schema.
 *
 * Validates the shape of a public registration submission only. Password
 * policy here is deliberately minimal (length bounds); stronger complexity
 * rules are a later decision and are not introduced in M8.
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
    password: z
      .string()
      .min(8, { message: "A senha deve ter no mínimo 8 caracteres." })
      .max(128, { message: "A senha deve ter no máximo 128 caracteres." }),
    confirmPassword: z.string().min(1, { message: "Confirme sua senha." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
