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
import { cookies } from "next/headers";

import { createClient } from "@/lib/auth/supabase/server";
import { enforceAuthorization } from "@/lib/authorization/enforce";
import { logoutAction } from "@/lib/auth/actions/logout";
import { getRoleLabel } from "@/lib/authorization/roles";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";
import { getNavigationHome } from "@/lib/navigation/presentation";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { AuthorizedNavigation } from "./_components/AuthorizedNavigation";
import { AuthorizedBreadcrumbs } from "./_components/AuthorizedBreadcrumbs";
import { ProtectedShellFrame } from "./_components/ProtectedShellFrame";
import styles from "./_components/ProtectedShell.module.css";
import { ThemeSwitch } from "./_components/ThemeSwitch";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await enforceAuthorization();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pages = await getAuthorizedNavigation(context);
  const cookieStore = await cookies();
  const cookieConsent = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value);
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

  const chrome = (
    <>
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
            <div
              className={styles.identity}
              data-session-identity
              aria-label={`Usuário autenticado: ${user?.email ?? "identidade protegida"}. Sessão ativa.`}
              title={user?.email ?? undefined}
            >
              <span className={styles.identityLabel} data-session-identity-label>
                {user?.email ?? "Usuário autenticado"}
              </span>
              <span className={styles.identityStatus}>
                <span aria-hidden="true" />
                Sessão ativa
              </span>
            </div>
            <Link href="/conta/seguranca" className={styles.accountLink}>
              Segurança
            </Link>
            <ThemeSwitch canPersist={cookieConsent?.categories.functional === true} />
            <form action={logoutAction}>
              <button type="submit" className={styles.logout}>
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <AuthorizedBreadcrumbs pages={pages} />
    </>
  );

  return (
    <ProtectedShellFrame shellClassName={styles.shell} chrome={chrome}>
      {children}
    </ProtectedShellFrame>
  );
}
