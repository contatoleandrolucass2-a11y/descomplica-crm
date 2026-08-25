import { z } from "zod";

import { passwordSchema } from "./password";

export const passwordRecoveryRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const passwordResetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Confirme sua senha." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
