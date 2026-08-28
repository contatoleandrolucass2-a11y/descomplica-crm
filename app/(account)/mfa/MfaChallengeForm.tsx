"use client";

import { useActionState } from "react";

import { verifyMfaViaRoute } from "@/lib/auth/mfa/browser";
import { initialMfaActionState } from "@/lib/auth/mfa/state";

import styles from "../_components/AccountSecurity.module.css";

type FactorOption = { id: string; name: string };

export function MfaChallengeForm({ factors }: { factors: FactorOption[] }) {
  const [state, formAction, isPending] = useActionState(verifyMfaViaRoute, initialMfaActionState);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="flow" value="challenge" />
      <fieldset className={styles.factorOptions}>
        <legend className={styles.legend}>Aplicativo autenticador</legend>
        {factors.map((factor, index) => (
          <label key={factor.id} className={styles.factorOption}>
            <input
              type="radio"
              name="factorId"
              value={factor.id}
              defaultChecked={index === 0}
              required
              disabled={isPending}
            />
            <span>{factor.name}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="mfa-code">Código de 6 dígitos</label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          disabled={isPending}
          className={styles.input}
        />
      </div>

      {state.message ? (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={styles.button}>
        {isPending ? "Verificando..." : "Verificar e continuar"}
      </button>
    </form>
  );
}
