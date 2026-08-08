"use client";

/**
 * Register form Client Component.
 *
 * Delegates all account-creation logic to `signupAction` (Server Action).
 * This component owns only presentation and pending state. No Supabase
 * access, no environment reads, no local storage, no cookie manipulation.
 */

import Link from "next/link";
import { useActionState } from "react";

import { signupAction } from "@/lib/auth/actions/signup";
import { initialSignupActionState } from "@/lib/auth/actions/signup-state";

import { AnimatedBrainVisual } from "../login/AnimatedBrainVisual";
import authStyles from "../login/LoginForm.module.css";
import styles from "./RegisterForm.module.css";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialSignupActionState);

  return (
    <main className={`${authStyles.page} ${styles.page}`}>
      <div className={`${authStyles.shell} ${styles.shell}`}>
        <section
          className={`${authStyles.visualPanel} ${styles.visualPanel}`}
          aria-label="Descomplica CRM"
        >
          <div className={authStyles.brand}>
            <span className={authStyles.brandMark}>D</span>
            <span>Descomplica CRM</span>
          </div>

          <div className={`${authStyles.brainWrap} ${styles.brainWrap}`}>
            <AnimatedBrainVisual />
          </div>

          <div className={`${authStyles.visualCopy} ${styles.visualCopy}`}>
            <p className={authStyles.eyebrow}>Inteligência comercial em movimento</p>
            <h2 className={authStyles.visualTitle}>Conecte dados, pessoas e decisões.</h2>
            <p className={authStyles.visualText}>
              Uma visão clara da operação para transformar cada etapa em resultado.
            </p>
          </div>
        </section>

        <section
          className={`${authStyles.formPanel} ${styles.formPanel}`}
          aria-labelledby="register-title"
        >
          <div className={`${authStyles.card} ${styles.card}`}>
            <h1 id="register-title" className={`${authStyles.title} ${styles.title}`}>
              Criar conta
            </h1>
            <p className={`${authStyles.subtitle} ${styles.subtitle}`}>
              Cadastre-se para acessar a plataforma.
            </p>

            <form action={formAction} className={`${authStyles.form} ${styles.form}`}>
              <div className={authStyles.field}>
                <label htmlFor="name" className={authStyles.label}>
                  Nome completo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={isPending}
                  placeholder="Seu nome"
                  className={authStyles.input}
                  aria-describedby={state.fieldErrors?.name?.[0] ? "name-error" : undefined}
                  aria-invalid={Boolean(state.fieldErrors?.name?.[0])}
                />
                {state.fieldErrors?.name?.[0] ? (
                  <p id="name-error" className={styles.fieldError} role="alert">
                    {state.fieldErrors.name[0]}
                  </p>
                ) : null}
              </div>

              <div className={authStyles.field}>
                <label htmlFor="email" className={authStyles.label}>
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
                  className={authStyles.input}
                  aria-describedby={state.fieldErrors?.email?.[0] ? "email-error" : undefined}
                  aria-invalid={Boolean(state.fieldErrors?.email?.[0])}
                />
                {state.fieldErrors?.email?.[0] ? (
                  <p id="email-error" className={styles.fieldError} role="alert">
                    {state.fieldErrors.email[0]}
                  </p>
                ) : null}
              </div>

              <div className={authStyles.field}>
                <label htmlFor="password" className={authStyles.label}>
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  disabled={isPending}
                  className={authStyles.input}
                  aria-describedby={state.fieldErrors?.password?.[0] ? "password-error" : undefined}
                  aria-invalid={Boolean(state.fieldErrors?.password?.[0])}
                />
                {state.fieldErrors?.password?.[0] ? (
                  <p id="password-error" className={styles.fieldError} role="alert">
                    {state.fieldErrors.password[0]}
                  </p>
                ) : null}
              </div>

              <div className={authStyles.field}>
                <label htmlFor="confirmPassword" className={authStyles.label}>
                  Confirmar senha
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  disabled={isPending}
                  className={authStyles.input}
                  aria-describedby={
                    state.fieldErrors?.confirmPassword?.[0] ? "confirmPassword-error" : undefined
                  }
                  aria-invalid={Boolean(state.fieldErrors?.confirmPassword?.[0])}
                />
                {state.fieldErrors?.confirmPassword?.[0] ? (
                  <p id="confirmPassword-error" className={styles.fieldError} role="alert">
                    {state.fieldErrors.confirmPassword[0]}
                  </p>
                ) : null}
              </div>

              {state.message ? (
                <p
                  className={
                    state.success ? styles.success : `${authStyles.error} ${styles.statusError}`
                  }
                  role={state.success ? "status" : "alert"}
                >
                  {state.message}
                </p>
              ) : null}

              <button type="submit" disabled={isPending} className={authStyles.submit}>
                {isPending ? "Criando conta..." : "Criar conta"}
              </button>
            </form>

            <p className={authStyles.register}>
              Já tem conta?{" "}
              <Link href="/login" className={authStyles.registerLink}>
                Entrar
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
