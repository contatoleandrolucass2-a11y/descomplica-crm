"use client";

/**
 * Login form Client Component.
 *
 * Delegates all auth logic to `loginAction` (Server Action). This component
 * owns only presentation and pending state. No Supabase access, no
 * environment reads, no local storage, no cookie manipulation.
 */

import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/lib/auth/actions/login";
import { initialLoginActionState } from "@/lib/auth/actions/login-state";

import { AnimatedBrainVisual } from "./AnimatedBrainVisual";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialLoginActionState);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.visualPanel} aria-label="Descomplica CRM">
          <div className={styles.brand}>
            <span className={styles.brandMark}>D</span>
            <span>Descomplica CRM</span>
          </div>

          <div className={styles.brainWrap}>
            <AnimatedBrainVisual />
          </div>

          <div className={styles.visualCopy}>
            <p className={styles.eyebrow}>Inteligência comercial em movimento</p>
            <h2 className={styles.visualTitle}>Conecte dados, pessoas e decisões.</h2>
            <p className={styles.visualText}>
              Uma visão clara da operação para transformar cada etapa em resultado.
            </p>
          </div>
        </section>

        <section className={styles.formPanel} aria-labelledby="login-title">
          <div className={styles.card}>
            <h1 id="login-title" className={styles.title}>
              Entrar
            </h1>
            <p className={styles.subtitle}>Acesse sua conta para continuar.</p>

            <form action={formAction} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={isPending}
                  placeholder="seu@email.com"
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  disabled={isPending}
                  className={styles.input}
                />
              </div>

              {state.status === "error" && state.message ? (
                <p className={styles.error}>{state.message}</p>
              ) : null}

              <button type="submit" disabled={isPending} className={styles.submit}>
                {isPending ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className={styles.register}>
              Ainda não tem conta?{" "}
              <Link href="/register" className={styles.registerLink}>
                Criar conta
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
