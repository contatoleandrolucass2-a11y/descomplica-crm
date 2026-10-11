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
import Link from "next/link";
import { ChevronDown, Cookie, LogOut, Settings, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { CookiePreferencesTrigger } from "@/app/_components/CookiePreferencesTrigger";
import { enforceAuthorization } from "@/lib/authorization/enforce";
import { logoutAction } from "@/lib/auth/actions/logout";
import { getCurrentUser } from "@/lib/authorization/guards";
import { getRoleLabel } from "@/lib/authorization/roles";
import { getAuthorizedNavigation, getDisabledNavigationItems } from "@/lib/navigation/pages";
import {
  getAuthorizedSettingsNavigation,
  getBreadcrumbNavigation,
  getNavigationHome,
  getPrimaryNavigation,
} from "@/lib/navigation/presentation";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { AccountMenu } from "./_components/AccountMenu";
import { AppPageIcon } from "./_components/AppPageIcon";
import { AuthorizedNavigation } from "./_components/AuthorizedNavigation";
import { AuthorizedBreadcrumbs } from "./_components/AuthorizedBreadcrumbs";
import { DescomplicaBrandMark } from "./_components/DescomplicaBrandMark";
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
  const navigationPages = getPrimaryNavigation(pages);
  const breadcrumbPages = getBreadcrumbNavigation(pages);
  const settingsPages = getAuthorizedSettingsNavigation(pages);
  const navigationHome = getNavigationHome(pages);
  const identity = user?.email ?? "Usuário autenticado";
  const role = getRoleLabel(context.roleKey);
  const brand = <DescomplicaBrandMark className={styles.brandMark} />;

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

              <CookiePreferencesTrigger
                className={`${styles.accountLink} ${styles.accountPreference}`}
              >
                <Cookie aria-hidden="true" size={18} />
                <span>
                  <strong>Cookies</strong>
                  <small>Gerenciar preferências</small>
                </span>
              </CookiePreferencesTrigger>

              {settingsPages.length > 0 ? (
                <details className={styles.accountSettings} open>
                  <summary className={styles.accountSettingsSummary}>
                    <Settings aria-hidden="true" size={18} />
                    <span>Configurações</span>
                    <ChevronDown
                      className={styles.accountSettingsChevron}
                      aria-hidden="true"
                      size={16}
                    />
                  </summary>
                  <nav
                    className={styles.accountSettingsLinks}
                    aria-label="Configurações no menu da conta"
                  >
                    {settingsPages.map((page, index) => (
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
                          <strong>{index === 0 ? "Visão geral" : page.name}</strong>
                          <small>{page.description}</small>
                        </span>
                      </Link>
                    ))}
                  </nav>
                </details>
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
      <AuthorizedBreadcrumbs pages={breadcrumbPages} />
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
