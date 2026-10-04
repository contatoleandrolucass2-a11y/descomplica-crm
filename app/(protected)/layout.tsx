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

import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { enforceAuthorization } from "@/lib/authorization/enforce";
import { logoutAction } from "@/lib/auth/actions/logout";
import { getCurrentUser } from "@/lib/authorization/guards";
import { getRoleLabel } from "@/lib/authorization/roles";
import { getAuthorizedNavigation, getDisabledNavigationItems } from "@/lib/navigation/pages";
import { getAuthorizedAdminNavigation, getNavigationHome } from "@/lib/navigation/presentation";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { AccountMenu } from "./_components/AccountMenu";
import { AppPageIcon } from "./_components/AppPageIcon";
import { AuthorizedNavigation } from "./_components/AuthorizedNavigation";
import { AuthorizedBreadcrumbs } from "./_components/AuthorizedBreadcrumbs";
import { PROTECTED_CONTENT_ID, ProtectedShellFrame } from "./_components/ProtectedShellFrame";
import styles from "./_components/ProtectedShell.module.css";
import { ThemeSwitch } from "./_components/ThemeSwitch";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await enforceAuthorization();
  const [user, pages, cookieStore] = await Promise.all([
    getCurrentUser(),
    getAuthorizedNavigation(context),
    cookies(),
  ]);
  const cookieConsent = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value);
  const disabledItems = getDisabledNavigationItems(context, pages);
  const navigationPages = pages.filter((page) => page.section !== "admin");
  const adminPages = getAuthorizedAdminNavigation(pages);
  const navigationHome = getNavigationHome(pages);
  const identity = user?.email ?? "Usuário autenticado";
  const role = getRoleLabel(context.roleKey);
  const brand = (
    <>
      <Image
        className={styles.brandMark}
        src="/descomplica-symbol.png"
        alt=""
        aria-hidden="true"
        width={22}
        height={22}
        loading="eager"
      />
      <span className={styles.brandName} aria-hidden="true">
        escomplica
      </span>
    </>
  );

  const chrome = (
    <>
      <a className={styles.skipLink} href={`#${PROTECTED_CONTENT_ID}`}>
        Pular para o conteúdo
      </a>
      <header className={styles.topbar} data-protected-topbar>
        <div className={styles.topbarInner}>
          {navigationHome ? (
            <Link
              href={navigationHome.path}
              prefetch={false}
              className={styles.brand}
              aria-label="Descomplica, início"
              data-protected-brand
            >
              {brand}
            </Link>
          ) : (
            <div className={styles.brand} aria-label="Descomplica" data-protected-brand>
              {brand}
            </div>
          )}
          <AuthorizedNavigation pages={navigationPages} disabledItems={disabledItems} />
          <ThemeSwitch canPersist={cookieConsent?.categories.functional === true} />
          <div className={styles.actions}>
            <AccountMenu identity={identity} displayName={user?.user_metadata?.name} role={role}>
              <Link href="/conta/seguranca" prefetch={false} className={styles.accountLink}>
                <ShieldCheck aria-hidden="true" size={18} />
                <span>
                  <strong>Segurança</strong>
                  <small>Senha, MFA e sessões</small>
                </span>
              </Link>

              {adminPages.length > 0 ? (
                <nav className={styles.accountSection} aria-label="Administração">
                  <span className={styles.accountSectionLabel}>Administração</span>
                  {adminPages.map((page) => (
                    <Link
                      href={page.path}
                      prefetch={false}
                      className={styles.accountLink}
                      key={page.key}
                    >
                      <span className={styles.accountLinkIcon}>
                        <AppPageIcon pageKey={page.key} />
                      </span>
                      <span>
                        <strong>{page.name}</strong>
                        <small>{page.description}</small>
                      </span>
                    </Link>
                  ))}
                </nav>
              ) : null}

              <form action={logoutAction} className={styles.logoutForm}>
                <button type="submit" className={styles.logout}>
                  <LogOut aria-hidden="true" size={18} />
                  Sair
                </button>
              </form>
            </AccountMenu>
          </div>
        </div>
      </header>
      <AuthorizedBreadcrumbs pages={pages} />
    </>
  );

  return (
    <ProtectedShellFrame
      shellClassName={styles.shell}
      contentClassName={styles.mainContent}
      chrome={chrome}
    >
      {children}
    </ProtectedShellFrame>
  );
}
