/**
 * Root layout — descomplica-platform.
 *
 * Provê o shell HTML base e o CSS global para todas as rotas.
 * Não inclui auth context nem session providers — esses pertencem aos layouts
 * dos route groups autenticados adicionados nos milestones seguintes.
 *
 * Referência: PROJECT_STRUCTURE_PLAN.md > Layout strategy
 */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { CookieConsentBanner } from "@/app/_components/CookieConsentBanner";
import { isHomologationMode } from "@/lib/homologation/config";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import "./globals.css";
import "./(protected)/app/simulacao/associative-linear-archive.css";

export async function generateMetadata(): Promise<Metadata> {
  // HOMOLOGATION_MODE belongs to runtime, not the immutable image. Explicitly
  // opt out of build-time metadata generation so one digest can be promoted.
  await connection();
  return {
    title: "descomplica-platform",
    description: "descomplica-platform",
    ...(isHomologationMode()
      ? {
          robots: {
            index: false,
            follow: false,
            nocache: true,
            googleBot: { index: false, follow: false, noimageindex: true },
          },
        }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const consentCookie = cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value;
  const consent = parseCookieConsent(consentCookie);
  const homologationMode = isHomologationMode();

  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">
        {homologationMode ? (
          <aside className="homologation-banner" role="status">
            HOMOLOGAÇÃO — DADOS SINTÉTICOS
          </aside>
        ) : null}
        {children}
        <CookieConsentBanner key={consentCookie ?? "unset"} consent={consent} />
      </body>
    </html>
  );
}
