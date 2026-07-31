/**
 * Signup action state contract.
 *
 * Kept in a plain module (no `"use server"`) because a Server Action file may
 * only export async functions — exporting the initial state object from
 * `signup.ts` breaks the Next.js build at the `/register` boundary.
 *
 * Types and the initial value are inert: no Supabase access, no environment
 * reads, no side effects. Safe to import from both the Server Action and the
 * Client Component.
 */

export type SignupFieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string[]>
>;

export type SignupActionState = {
  success: boolean;
  message: string;
  fieldErrors?: SignupFieldErrors;
};

export const initialSignupActionState: SignupActionState = {
  success: false,
  message: "",
};
