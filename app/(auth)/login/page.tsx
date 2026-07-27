import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/auth/supabase/server";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | Descomplica Platform",
};

// Session handling (M7.4): an already-authenticated visitor is sent straight
// to /app instead of seeing the login form again. The check is authentication
// only — a user with no role still goes to /app, where the (protected) layout
// makes the authorization decision. Absent or failed getUser() is treated as
// "no session" and renders the form normally.
export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return <LoginForm />;
}
