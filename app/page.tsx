/**
 * Root route (/) — session-based routing (M6.5).
 *
 * Decides ONLY by authentication (auth.getUser()), never by role/permission:
 * an authenticated user without a role would be sent to /login anyway by the
 * (protected) layout guard (M6.1) when it reaches /app. Resolving that here
 * would duplicate logic that already lives in the protected layout.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/auth/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/app");
}
