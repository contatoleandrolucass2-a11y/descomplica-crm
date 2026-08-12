/**
 * Root route (/) — session-based routing (M6.5).
 *
 * Decides ONLY by authentication (auth.getUser()), never by role/permission:
 * an authenticated user without an approved authorization context is sent to
 * the generic 403 surface (with logout) by the protected layout guard. Resolving
 * that here would duplicate logic that already lives in the protected layout.
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
