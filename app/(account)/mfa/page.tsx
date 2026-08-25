import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";

import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { createClient } from "@/lib/auth/supabase/server";

import styles from "../_components/AccountSecurity.module.css";
import { MfaChallengeForm } from "./MfaChallengeForm";

export const metadata: Metadata = {
  title: "Verificação em duas etapas | Descomplica CRM",
};

export default async function MfaPage() {
  const supabase = await createClient();
  const assurance = await getMfaAssurance(supabase);

  if (assurance.status === "recovery") redirect("/redefinir-senha");
  if (assurance.status === "verified") redirect("/");
  if (assurance.status === "unavailable") forbidden();

  if (assurance.status === "optional") {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.card}>
            <h1 className={styles.title}>Nenhuma verificação pendente</h1>
            <p>Esta conta ainda não possui um fator verificado.</p>
            <div className={styles.actions}>
              <Link href="/conta/seguranca" className={styles.linkButton}>
                Configurar segurança
              </Link>
              <Link href="/" className={styles.linkButton}>
                Continuar
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data || data.totp.length === 0) forbidden();

  const factors = data.totp.map((factor, index) => ({
    id: factor.id,
    name: factor.friendly_name || `Aplicativo autenticador ${index + 1}`,
  }));

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Etapa adicional</p>
        <h1 className={styles.title}>Verificação em duas etapas</h1>
        <p className={styles.lead}>
          Digite o código atual do aplicativo autenticador. Nenhuma página, API ou dado protegido
          será liberado enquanto a sessão permanecer em AAL1.
        </p>
        <section className={styles.card} aria-label="Confirmar código TOTP">
          <MfaChallengeForm factors={factors} />
        </section>
      </div>
    </main>
  );
}
