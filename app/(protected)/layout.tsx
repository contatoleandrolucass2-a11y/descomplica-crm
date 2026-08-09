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
import { getRoleLabel } from "@/lib/authorization/roles";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";
import { getNavigationHome } from "@/lib/navigation/presentation";

import { AuthorizedNavigation } from "./_components/AuthorizedNavigation";
import styles from "./_components/ProtectedShell.module.css";
import { ThemeSwitch } from "./_components/ThemeSwitch";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await enforceAuthorization();
  const pages = await getAuthorizedNavigation(context);
  const navigationHome = getNavigationHome(pages);
  const brand = (
    <>
      <span className={styles.brandMark} aria-hidden="true">
        D
      </span>
      <span>
        <span className={styles.brandName}>Descomplica CRM</span>
        <span className={styles.role}>{getRoleLabel(context.roleKey)}</span>
      </span>
    </>
  );

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          {navigationHome ? (
            <Link
              href={navigationHome.path}
              className={styles.brand}
              aria-label={`Descomplica CRM — ${navigationHome.name}`}
            >
              {brand}
            </Link>
          ) : (
            <div className={styles.brand}>{brand}</div>
          )}
          <AuthorizedNavigation pages={pages} />
          <div className={styles.actions}>
            <ThemeSwitch />
            <form action={logoutAction}>
              <button type="submit" className={styles.logout}>
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
