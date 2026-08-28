"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordRecoveryAction } from "@/lib/auth/actions/recovery";
import { initialRecoveryActionState } from "@/lib/auth/actions/recovery-state";

import styles from "../login/LoginForm.module.css";

export function PasswordRecoveryForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [state, formAction, isPending] = useActionState(
    requestPasswordRecoveryAction,
    initialRecoveryActionState,
  );

  return (
    <main className={styles.page}>
      <section className={styles.formPanel} aria-labelledby="recovery-title">
        <div className={styles.card}>
          <p className={styles.eyebrow}>Segurança da conta</p>
          <h1 id="recovery-title" className={styles.title}>
            Esqueci minha senha
          </h1>
          <p className={styles.subtitle}>
            Informe seu e-mail. A resposta será a mesma, exista ou não uma conta elegível.
          </p>

          {invalidLink ? (
            <p className={styles.error} role="alert">
              O link é inválido, expirou ou já foi utilizado. Solicite outro abaixo.
            </p>
          ) : null}

          <form action={formAction} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="recovery-email" className={styles.label}>
                E-mail
              </label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                className={styles.input}
              />
            </div>

            {state.message ? (
              <p
                className={state.status === "success" ? styles.success : styles.error}
                role="status"
              >
                {state.message}
              </p>
            ) : null}

            <button type="submit" disabled={isPending} className={styles.submit}>
              {isPending ? "Enviando..." : "Enviar instruções"}
            </button>
          </form>

          <p className={styles.register}>
            <Link href="/login" className={styles.registerLink}>
              Voltar para o login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
