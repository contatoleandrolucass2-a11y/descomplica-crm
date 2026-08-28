"use server";

import { redirect } from "next/navigation";
import { clearLocalAuthenticationCookies } from "@/lib/auth/clear-session";
import { createClient } from "@/lib/auth/supabase/server";

// Logout Server Action (M7.2). Always ends the local session and sends the
// user back to /login — the signOut() result is intentionally not inspected:
// whether it succeeds or fails, no internal detail is ever surfaced, and the
// user is redirected regardless. redirect() runs unconditionally right after
// signOut(), with no error handling wrapped around it, so NEXT_REDIRECT is
// never swallowed.
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut({ scope: "global" });
  await clearLocalAuthenticationCookies();

  redirect("/login");
}
