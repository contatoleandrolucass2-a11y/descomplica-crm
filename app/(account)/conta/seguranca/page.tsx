import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";

import { removeMfaFactorAction } from "@/lib/auth/actions/mfa";
import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { createClient } from "@/lib/auth/supabase/server";

import styles from "../../_components/AccountSecurity.module.css";
import { MfaEnrollment } from "./MfaEnrollment";

export const metadata: Metadata = {
  title: "Segurança da conta | Descomplica CRM",
};

const STATUS_MESSAGES: Record<string, string> = {
  enabled: "Verificação em duas etapas ativada.",
  removed: "Fator removido. A sessão foi atualizada.",
  cancelled: "Configuração cancelada; nenhum fator foi ativado.",
};

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ mfa?: string }>;
}) {
  const supabase = await createClient();
  const assurance = await getMfaAssurance(supabase);
  if (assurance.status === "recovery") redirect("/redefinir-senha");
  if (assurance.status === "required") redirect("/mfa");
  if (assurance.status === "unavailable") forbidden();

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) forbidden();

  const params = await searchParams;
  const message = params.mfa ? STATUS_MESSAGES[params.mfa] : undefined;
  const hasVerifiedTotp = data.totp.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Conta</p>
        <h1 className={styles.title}>Segurança da conta</h1>
        <p className={styles.lead}>
          Gerencie a verificação em duas etapas. Esta área depende somente de uma sessão válida e
          fica disponível a todos os perfis, sem conceder acesso comercial.
        </p>

        {message ? (
          <p className={styles.status} role="status">
            {message}
          </p>
        ) : null}
        {params.mfa === "error" ? (
          <p className={styles.error} role="alert">
            Não foi possível alterar o fator. Verifique novamente sua sessão.
          </p>
        ) : null}

        <section className={styles.card} aria-labelledby="mfa-settings-title">
          <h2 id="mfa-settings-title">Verificação em duas etapas</h2>
          <p>
            O aplicativo autenticador gera códigos temporários. Lembrar o navegador nunca ignora
            esta verificação.
          </p>

          {hasVerifiedTotp ? (
            <ul className={styles.factorList}>
              {data.totp.map((factor, index) => (
                <li key={factor.id} className={styles.factor}>
                  <div>
                    <strong>
                      {factor.friendly_name || `Aplicativo autenticador ${index + 1}`}
                    </strong>
                    <span>Fator TOTP verificado</span>
                  </div>
                  <form action={removeMfaFactorAction}>
                    <input type="hidden" name="factorId" value={factor.id} />
                    <button type="submit" className={styles.dangerButton}>
                      Remover fator
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <MfaEnrollment />
          )}
        </section>

        <section className={styles.card} aria-labelledby="session-settings-title">
          <h2 id="session-settings-title">Sessões</h2>
          <p>
            Ao redefinir a senha, todas as sessões são encerradas. O logout também revoga a sessão
            no servidor e remove os cookies locais.
          </p>
        </section>
      </div>
    </main>
  );
}
