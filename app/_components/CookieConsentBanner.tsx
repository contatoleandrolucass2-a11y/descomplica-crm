"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { saveCookieConsentAction, type CookieConsentActionState } from "@/lib/privacy/actions";
import type { CookieConsent } from "@/lib/privacy/cookie-consent";

import { COOKIE_PREFERENCES_OPEN_EVENT } from "./CookiePreferencesTrigger";
import styles from "./CookieConsentBanner.module.css";

const INITIAL_COOKIE_CONSENT_ACTION_STATE: CookieConsentActionState = {
  status: "idle",
  message: "",
};

export function CookieConsentBanner({ consent }: { consent: CookieConsent | null }) {
  const [open, setOpen] = useState(consent === null);
  const [state, formAction, pending] = useActionState(
    saveCookieConsentAction,
    INITIAL_COOKIE_CONSENT_ACTION_STATE,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function openPreferences(event: Event) {
      const eventOpener =
        event instanceof CustomEvent && event.detail?.opener instanceof HTMLElement
          ? event.detail.opener
          : null;
      const activeElement =
        eventOpener ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const accountPanel = activeElement?.closest("#protected-account-menu");
      const accountTrigger = accountPanel
        ? document.querySelector<HTMLElement>(
            '[aria-controls="protected-account-menu"][data-session-identity]',
          )
        : null;
      openerRef.current = accountTrigger ?? activeElement;
      setOpen(true);
      requestAnimationFrame(() => titleRef.current?.focus());
    }

    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences);
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences);
  }, []);

  useEffect(() => {
    if (state.status !== "saved") return;
    const frame = requestAnimationFrame(() => {
      setOpen(false);
      openerRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state]);

  function closePreferences() {
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  if (!open) return null;

  return (
    <aside
      id="cookie-consent-panel"
      className={styles.banner}
      aria-labelledby="cookie-consent-title"
      aria-busy={pending}
    >
      <div className={styles.headingRow}>
        <div>
          <h2 ref={titleRef} id="cookie-consent-title" className={styles.title} tabIndex={-1}>
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
            onClick={closePreferences}
            aria-label="Fechar preferências"
            disabled={pending}
          >
            Fechar
          </button>
        ) : null}
      </div>

      <div className={styles.actions}>
        <form action={formAction}>
          <input type="hidden" name="choice" value="all" />
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending ? "Salvando…" : "Aceitar todos"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="choice" value="essential" />
          <button type="submit" className={styles.secondary} disabled={pending}>
            {pending ? "Salvando…" : "Somente essenciais"}
          </button>
        </form>
      </div>

      {state.status === "error" ? (
        <p className={styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <details className={styles.details} open={consent === null ? undefined : true}>
        <summary>Personalizar</summary>
        <form action={formAction}>
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
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? "Salvando…" : "Salvar preferências"}
            </button>
          </div>
        </form>
      </details>
    </aside>
  );
}
