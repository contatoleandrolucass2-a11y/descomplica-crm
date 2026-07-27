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

import { enforceAuthorization } from "@/lib/authorization/enforce";
import { logoutAction } from "@/lib/auth/actions/logout";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await enforceAuthorization();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="font-semibold text-slate-900">Descomplica Platform</p>
          <p className="text-sm text-slate-500">Área protegida</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sair
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
