"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { saveCookieConsentAction } from "@/lib/privacy/actions";
import type { CookieConsent } from "@/lib/privacy/cookie-consent";

import styles from "./CookieConsentBanner.module.css";

export function CookieConsentBanner({ consent }: { consent: CookieConsent | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(consent === null);

  if (pathname === "/app/simulacao/associativo-fluxo-linear") return null;

  if (!open) {
    return (
      <button
        type="button"
        className={styles.preferencesButton}
        onClick={() => setOpen(true)}
        data-qa-visual-volatile
      >
        Preferências de cookies
      </button>
    );
  }

  return (
    <aside className={styles.banner} aria-labelledby="cookie-consent-title">
      <div className={styles.headingRow}>
        <div>
          <h2 id="cookie-consent-title" className={styles.title}>
            Preferências de cookies
          </h2>
          <p className={styles.copy}>
            Essenciais e segurança permanecem ativos. Funcionais, desempenho e análise começam
            desmarcados. Esta escolha é separada do aceite de Termos e Privacidade. Consulte a{" "}
            <Link href="/politica-de-cookies">Política de Cookies</Link>.
          </p>
        </div>
        {consent ? (
          <button
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Fechar preferências"
          >
            Fechar
          </button>
        ) : null}
      </div>

      <div className={styles.actions}>
        <form action={saveCookieConsentAction}>
          <input type="hidden" name="choice" value="all" />
          <button type="submit" className={styles.primary}>
            Aceitar todos
          </button>
        </form>
        <form action={saveCookieConsentAction}>
          <input type="hidden" name="choice" value="essential" />
          <button type="submit" className={styles.secondary}>
            Somente essenciais
          </button>
        </form>
      </div>

      <details className={styles.details} open={consent === null ? undefined : true}>
        <summary>Personalizar</summary>
        <form action={saveCookieConsentAction}>
          <input type="hidden" name="choice" value="custom" />
          <div className={styles.categoryGrid}>
            <label className={styles.category}>
              <input type="checkbox" checked disabled />
              <span>
                <strong>Essenciais</strong>
                <span>Navegação, funcionamento básico e manutenção da sessão.</span>
              </span>
            </label>
            <label className={styles.category}>
              <input type="checkbox" checked disabled />
              <span>
                <strong>Segurança</strong>
                <span>Autenticação, proteção de sessão e prevenção de abuso.</span>
              </span>
            </label>
            <label className={styles.category}>
              <input
                type="checkbox"
                name="functional"
                defaultChecked={consent?.categories.functional ?? false}
              />
              <span>
                <strong>Funcionais</strong>
                <span>Preferências não essenciais, como persistência do tema.</span>
              </span>
            </label>
            <label className={styles.category}>
              <input
                type="checkbox"
                name="performance"
                defaultChecked={consent?.categories.performance ?? false}
              />
              <span>
                <strong>Desempenho</strong>
                <span>Medições opcionais de estabilidade e velocidade.</span>
              </span>
            </label>
            <label className={styles.category}>
              <input
                type="checkbox"
                name="analytics"
                defaultChecked={consent?.categories.analytics ?? false}
              />
              <span>
                <strong>Análise</strong>
                <span>Medições opcionais de uso e navegação.</span>
              </span>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Salvar preferências
            </button>
          </div>
        </form>
      </details>
    </aside>
  );
}
