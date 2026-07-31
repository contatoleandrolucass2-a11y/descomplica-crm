/**
 * Login action state contract.
 *
 * Kept in a plain module (no `"use server"`) because a Server Action file may
 * only export async functions — exporting the initial state object from
 * `login.ts` breaks the Next.js build at the `/login` boundary.
 *
 * Types and the initial value are inert: no Supabase access, no environment
 * reads, no side effects. Safe to import from both the Server Action and the
 * Client Component.
 */

export type LoginActionState = {
  status: "idle" | "error";
  message?: string;
};

export const initialLoginActionState: LoginActionState = {
  status: "idle",
};
