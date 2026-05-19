/**
 * Login form schema.
 *
 * Validates the shape of a login submission only. Password complexity policy
 * (length, character classes, etc.) belongs to the future signup flow — never
 * to login. Enforcing complexity here would leak policy to anonymous callers
 * and create a covert oracle for account enumeration.
 *
 * Field-level messages are intentionally generic. The canonical user-facing
 * error is produced by the Server Action, which collapses every failure
 * branch into a single generic message per
 * `AUTH_SECURITY.md > Account Enumeration Prevention`.
 *
 * Boundaries:
 * - No Supabase imports.
 * - No environment access.
 * - No logging.
 * - No Service Role usage.
 */

import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Informe um e-mail válido." })),
  password: z.string().min(1, { message: "Informe sua senha." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
