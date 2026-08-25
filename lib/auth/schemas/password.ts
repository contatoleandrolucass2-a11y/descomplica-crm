import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, { message: "A senha deve ter no mínimo 12 caracteres." })
  .max(128, { message: "A senha deve ter no máximo 128 caracteres." })
  .regex(/[A-Z]/, { message: "Inclua ao menos uma letra maiúscula." })
  .regex(/[a-z]/, { message: "Inclua ao menos uma letra minúscula." })
  .regex(/[0-9]/, { message: "Inclua ao menos um número." })
  .regex(/[^A-Za-z0-9]/, { message: "Inclua ao menos um símbolo." });
