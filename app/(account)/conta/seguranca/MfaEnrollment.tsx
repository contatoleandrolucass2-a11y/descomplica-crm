"use client";

import Image from "next/image";
import { useActionState } from "react";

import { beginTotpEnrollmentAction, cancelTotpEnrollmentAction } from "@/lib/auth/actions/mfa";
import { verifyMfaViaRoute } from "@/lib/auth/mfa/browser";
import { initialMfaActionState } from "@/lib/auth/mfa/state";

import styles from "../../_components/AccountSecurity.module.css";

export function MfaEnrollment() {
  const [beginState, beginAction, beginPending] = useActionState(
    beginTotpEnrollmentAction,
    initialMfaActionState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyMfaViaRoute,
    initialMfaActionState,
  );

  if (!beginState.enrollment) {
    return (
      <div>
        {beginState.message ? (
          <p className={styles.error} role="alert">
            {beginState.message}
          </p>
        ) : null}
        <form action={beginAction} className={styles.actions}>
          <button type="submit" disabled={beginPending} className={styles.button}>
            {beginPending ? "Preparando..." : "Ativar verificação em duas etapas"}
          </button>
        </form>
      </div>
    );
  }

  const enrollment = beginState.enrollment;
  return (
    <div>
      <div className={styles.qrGrid}>
        <Image
          src={enrollment.qrCode}
          alt="Código QR para configurar o aplicativo autenticador"
          width={240}
          height={240}
          unoptimized
          className={styles.qr}
        />
        <div>
          <h3>Configure seu aplicativo autenticador</h3>
          <p>Escaneie o QR ou digite a chave manual. Não compartilhe esta chave.</p>
          <span className={styles.legend}>Chave manual</span>
          <code className={styles.secret}>{enrollment.secret}</code>
        </div>
      </div>

      <form action={verifyAction} className={styles.form}>
        <input type="hidden" name="flow" value="enrollment" />
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <div className={styles.field}>
          <label htmlFor="enrollment-code">Código de 6 dígitos</label>
          <input
            id="enrollment-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            disabled={verifyPending}
            className={styles.input}
          />
        </div>
        {verifyState.message ? (
          <p className={styles.error} role="alert">
            {verifyState.message}
          </p>
        ) : null}
        <button type="submit" disabled={verifyPending} className={styles.button}>
          {verifyPending ? "Verificando..." : "Confirmar e ativar"}
        </button>
      </form>

      <form action={cancelTotpEnrollmentAction} className={styles.actions}>
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <button type="submit" className={styles.secondaryButton}>
          Cancelar configuração
        </button>
      </form>
    </div>
  );
}
