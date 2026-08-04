/**
 * Route group shell for authenticated surfaces.
 *
 * The (protected) segment is a Next.js route group: it organizes files
 * without appearing in URLs. A page at app/(protected)/app/page.tsx is served
 * at /app, not at /(protected)/app.
 *
 * Route protection (M6.1): this layout is the single guard for every route in
 * the group. It calls enforceAuthorization() before rendering children — an
 * unauthenticated caller is redirected to /login by the helper. The check is
 * server-side (RSC + RPC); RLS remains the final authority. Per-permission
 * gates (e.g. admin.access) live in nested sub-layouts, not here.
 *
 * Session controls (M7.3): the logout button is a plain form bound to the
 * M7.2 Server Action. This stays a pure Server Component throughout.
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { enforceAuthorization } from "@/lib/authorization/enforce";
import { logoutAction } from "@/lib/auth/actions/logout";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await enforceAuthorization();
  const pages = await getAuthorizedNavigation(context);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href="/app" className="font-semibold text-slate-900">
              Descomplica CRM
            </Link>
            <p className="text-xs tracking-wide text-slate-500 uppercase">{context.roleKey}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sair
            </button>
          </form>
        </div>
        <nav
          aria-label="Navegação autorizada"
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:flex-wrap sm:px-6"
        >
          {pages.map((page) => (
            <Link
              key={page.key}
              href={page.path}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm whitespace-nowrap text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {page.name}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
