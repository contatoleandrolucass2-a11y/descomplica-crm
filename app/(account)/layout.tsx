import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAction } from "@/lib/auth/actions/logout";
import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { createClient } from "@/lib/auth/supabase/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const assurance = await getMfaAssurance(supabase);
  if (assurance.status === "recovery") redirect("/redefinir-senha");
  if (assurance.status === "unavailable") redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex min-h-18 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-bold tracking-tight">
            Descomplica CRM
          </Link>
          <nav aria-label="Conta" className="flex flex-wrap items-center gap-3 text-sm">
            <span
              data-account-identity
              className="max-w-72 truncate text-slate-200"
              title={user.email}
            >
              {user.email ?? "Identidade autenticada"}
            </span>
            <Link href="/conta/seguranca" className="min-h-11 content-center text-cyan-200">
              Segurança da conta
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-white/25 px-4 font-semibold"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
