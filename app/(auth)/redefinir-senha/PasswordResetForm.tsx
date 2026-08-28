"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/lib/auth/actions/recovery";
import { initialRecoveryActionState } from "@/lib/auth/actions/recovery-state";

import styles from "../login/LoginForm.module.css";

export function PasswordResetForm() {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialRecoveryActionState,
  );

  return (
    <main className={styles.page}>
      <section className={styles.formPanel} aria-labelledby="reset-title">
        <div className={styles.card}>
          <p className={styles.eyebrow}>Link de uso único</p>
          <h1 id="reset-title" className={styles.title}>
            Redefinir senha
          </h1>
          <p className={styles.subtitle}>
            Use de 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo.
          </p>

          <form action={formAction} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="new-password" className={styles.label}>
                Nova senha
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={isPending}
                className={styles.input}
                aria-invalid={Boolean(state.fieldErrors?.password?.[0])}
                aria-describedby={
                  state.fieldErrors?.password?.[0] ? "new-password-error" : undefined
                }
              />
              {state.fieldErrors?.password?.[0] ? (
                <p id="new-password-error" className={styles.error} role="alert">
                  {state.fieldErrors.password[0]}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm-new-password" className={styles.label}>
                Confirmar nova senha
              </label>
              <input
                id="confirm-new-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={isPending}
                className={styles.input}
                aria-invalid={Boolean(state.fieldErrors?.confirmPassword?.[0])}
                aria-describedby={
                  state.fieldErrors?.confirmPassword?.[0] ? "confirm-new-password-error" : undefined
                }
              />
              {state.fieldErrors?.confirmPassword?.[0] ? (
                <p id="confirm-new-password-error" className={styles.error} role="alert">
                  {state.fieldErrors.confirmPassword[0]}
                </p>
              ) : null}
            </div>

            {state.message ? (
              <p className={styles.error} role="alert">
                {state.message}
              </p>
            ) : null}

            <button type="submit" disabled={isPending} className={styles.submit}>
              {isPending ? "Redefinindo..." : "Redefinir e encerrar sessões"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
