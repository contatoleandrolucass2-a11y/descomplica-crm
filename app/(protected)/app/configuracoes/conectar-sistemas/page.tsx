import { ExternalLink } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { SalesforceRefreshButton } from "@/app/(protected)/app/_components/SalesforceRefreshButton";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
} from "@/lib/crm/salesforce/config";

export const metadata = { title: "Conectar Sistemas" };

const REPORTS = [
  ["Oportunidades", "00OU600000DrfDeMAJ"],
  ["Agendamentos", "00OU600000ELaA6MAL"],
  ["Visitas", "00OU600000EboNZMAZ"],
  ["Pastas", "00OU600000EjufWMAR"],
  ["Vendas", "00OU600000EjFyyMAF"],
  ["Corretores", "00OTT000009j0l32AA"],
  ["Canal Imob", "00OU6000006RqzxMAC"],
] as const;

function configurationLabel(configuration: { enabled: boolean; available: boolean }) {
  if (configuration.available) return "Configurada";
  return configuration.enabled ? "Configuração incompleta" : "Desativada";
}

export default async function ConnectedSystemsPage() {
  const context = await enforcePermission("crm.settings.manage");
  const ingest = getSalesforceIngestConfiguration();
  const refresh = getSalesforceRefreshConfiguration();

  return (
    <ManagementPage>
      <ManagementPageHeader
        title="Conectar Sistemas"
        description="Salesforce e atualização dos relatórios do CRM."
        status={<ManagementStatusBadge tone="warning">Sessão não verificada</ManagementStatusBadge>}
      />

      <section aria-labelledby="salesforce-title" className="grid gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="salesforce-title" className={managementStyles.sectionTitle}>
            Salesforce
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://direcional.my.salesforce.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--analytics-line)] px-4 py-2 text-sm text-[var(--analytics-ink)]"
            >
              Abrir Salesforce <ExternalLink aria-hidden="true" size={16} />
            </a>
            <a
              href="https://direcional.lightning.force.com/lightning"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--analytics-cyan-strong)]"
            >
              Console de vendas <ExternalLink aria-hidden="true" size={16} />
            </a>
          </div>
        </div>
        <dl className="grid gap-4 border-y border-[var(--analytics-line)] py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--analytics-muted)]">Ingestão no CRM</dt>
            <dd className="mt-1 font-semibold">{configurationLabel(ingest)}</dd>
          </div>
          <div>
            <dt className="text-[var(--analytics-muted)]">Atualização manual</dt>
            <dd className="mt-1 font-semibold">{configurationLabel(refresh)}</dd>
          </div>
          <div>
            <dt className="text-[var(--analytics-muted)]">Intervalo previsto</dt>
            <dd className="mt-1 font-semibold">30 minutos</dd>
          </div>
        </dl>
        <p className="max-w-3xl text-sm leading-6 text-[var(--analytics-muted)]">
          A autenticação é feita no Salesforce, com usuário, senha e aprovação no Salesforce
          Authenticator. A sessão do coletor precisa ser autorizada separadamente; abrir estes links
          não confirma a conexão automática. Se o Salesforce pedir nova aprovação, a coleta fica
          interrompida até a autenticação.
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-3xl text-sm leading-6 text-[var(--analytics-muted)]">
            A configuração deste ambiente não confirma que a agenda está em execução. A primeira
            carga deve ser conferida antes de ativar a atualização contínua.
          </p>
          {hasPermission(context, "crm.salesforce.refresh") ? (
            <SalesforceRefreshButton available={refresh.available} />
          ) : (
            <p className="text-sm text-[var(--analytics-muted)]">
              Seu perfil não pode solicitar atualização.
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="reports-title"
        className="grid gap-3 border-t border-[var(--analytics-line)] py-4"
      >
        <h2 id="reports-title" className={managementStyles.sectionTitle}>
          Relatórios previstos
        </h2>
        <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map(([name, id]) => (
            <li key={id} className="border-b border-[var(--analytics-line)]">
              <a
                href={`https://direcional.lightning.force.com/lightning/r/Report/${id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm text-[var(--analytics-cyan-strong)]"
              >
                {name}
                <ExternalLink aria-hidden="true" size={16} className="shrink-0" />
              </a>
            </li>
          ))}
        </ul>
        <p className="max-w-3xl text-sm leading-6 text-[var(--analytics-muted)]">
          Os dados atuais são preservados quando uma coleta falha. A substituição no Supabase
          acontece apenas após a validação e a aceitação do novo lote.
        </p>
      </section>
    </ManagementPage>
  );
}
