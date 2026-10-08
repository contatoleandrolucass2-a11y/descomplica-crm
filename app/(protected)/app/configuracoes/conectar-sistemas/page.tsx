import Link from "next/link";

import {
  AnalyticsCard,
  DataState,
  PageHeader,
  SectionHeading,
} from "@/app/(protected)/app/_components/analytics";
import { SalesforceRefreshButton } from "@/app/(protected)/app/_components/SalesforceRefreshButton";
import { enforcePermission } from "@/lib/authorization/enforce";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
} from "@/lib/crm/salesforce/config";

export const metadata = { title: "Conectar Sistemas" };

const SALESFORCE_LOGIN_URL = "https://direcional.my.salesforce.com/";
const SALESFORCE_LIGHTNING_URL = "https://direcional.lightning.force.com/lightning";

const AUTH_STEPS = [
  "Abrir o Salesforce em um Chrome dedicado e autenticar com usuário, senha e liberação no Salesforce Authenticator.",
  "Manter o Chrome com depuração CDP restrita a loopback para o exportador usar somente o cookie de sessão aprovado.",
  "Falhar fechado quando a sessão voltar para a tela de login, exigindo nova liberação manual no celular.",
] as const;

const REPORTS = [
  ["Oportunidades", "00OU600000DrfDeMAJ", "Opportunity 006"],
  ["Agendamentos", "00OU600000ELaA6MAL", "Código de agendamento"],
  ["Visitas", "00OU600000EboNZMAZ", "Código de agendamento"],
  ["Pastas", "00OU600000EjufWMAR", "Avaliação a1V"],
  ["Vendas", "00OU600000EjFyyMAF", "Opportunity 006"],
  ["Corretores", "00OTT000009j0l32AA", "Contact 003 com hash"],
  ["Canal Imob", "00OU6000006RqzxMAC", "Conta 001"],
] as const;

const PIPELINE_STEPS = [
  {
    title: "Exportação a cada 30 minutos",
    description:
      "O runner serial executa uma coleta por vez, reutiliza a sessão Salesforce validada por MFA e rejeita ciclos concorrentes.",
  },
  {
    title: "Transformação sem PII",
    description:
      "O payload mantém IDs Salesforce brutos apenas em memória, descarta CPF, CNPJ, telefone, e-mail, dados bancários e endereço.",
  },
  {
    title: "Substituição transacional",
    description:
      "A RPC de ingestão remove os filhos antigos do snapshot e insere os novos valores dentro da mesma transação do Supabase.",
  },
] as const;

function StatusBadge({ available, enabled }: { available: boolean; enabled: boolean }) {
  const label = available ? "Configurado" : enabled ? "Incompleto" : "Desativado";
  const tone = available
    ? "bg-emerald-100 text-emerald-800"
    : enabled
      ? "bg-amber-100 text-amber-900"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

export default async function ConnectedSystemsPage() {
  const authorization = await enforcePermission("crm.settings.manage");
  const ingestConfiguration = getSalesforceIngestConfiguration();
  const refreshConfiguration = getSalesforceRefreshConfiguration();
  const canRefresh = authorization.permissions.includes("crm.salesforce.refresh");

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl gap-7">
        <PageHeader
          eyebrow="Integrações"
          title="Conectar Sistemas"
          description="Máscara operacional para conectar o Salesforce da Direcional, acompanhar o refresh e proteger a ingestão que alimenta o CRM."
          meta={
            <div className="grid gap-4">
              <div>
                <p className="text-xs tracking-wide text-slate-300 uppercase">Destino Salesforce</p>
                <a
                  className="mt-1 block break-words text-sm font-semibold text-cyan-100 underline decoration-cyan-300/60 underline-offset-4"
                  href={SALESFORCE_LOGIN_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  {SALESFORCE_LOGIN_URL}
                </a>
              </div>
              {canRefresh ? (
                <SalesforceRefreshButton available={refreshConfiguration.available} />
              ) : (
                <p className="text-sm text-slate-300">
                  Seu perfil não possui a permissão de refresh Salesforce.
                </p>
              )}
            </div>
          }
        />

        <section aria-labelledby="salesforce-connection-title">
          <SectionHeading
            id="salesforce-connection-title"
            kicker="Conexão assistida"
            title="Salesforce com MFA manual e execução autônoma"
            description="A conexão não grava usuário ou senha no CRM. A sessão nasce de um login manual aprovado no Salesforce Authenticator e depois é usada pelo exportador enquanto continuar válida."
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
            <AnalyticsCard>
              <div className="grid gap-4">
                {AUTH_STEPS.map((step, index) => (
                  <div
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[2.5rem_1fr]"
                    key={step}
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </AnalyticsCard>

            <AnalyticsCard tone="navy">
              <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
                Página interna após login
              </p>
              <a
                className="mt-3 block break-words text-sm font-semibold text-white underline decoration-cyan-300/60 underline-offset-4"
                href={SALESFORCE_LIGHTNING_URL}
                rel="noreferrer"
                target="_blank"
              >
                {SALESFORCE_LIGHTNING_URL}
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                O runner confirma a origem exata antes de usar a sessão. Se o Salesforce voltar ao
                login, o ciclo falha e aguarda nova autenticação manual.
              </p>
            </AnalyticsCard>
          </div>
        </section>

        <section aria-labelledby="salesforce-status-title">
          <SectionHeading
            id="salesforce-status-title"
            kicker="Capacidades server-side"
            title="Status da integração"
            description="Flags, Bearers e URL de automação continuam no ambiente do servidor. O navegador nunca recebe credenciais Salesforce, secret key ou Bearer de máquina."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <AnalyticsCard>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-cyan-700 uppercase">
                    Ingestão M2M
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">
                    Salesforce para Supabase
                  </h3>
                </div>
                <StatusBadge
                  available={ingestConfiguration.available}
                  enabled={ingestConfiguration.enabled}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                O endpoint `/api/ingest/salesforce` aceita somente contrato v2, Bearer dedicado e
                payload agregado de até 1 MB. A RPC substitui snapshots antigos de forma atômica.
              </p>
            </AnalyticsCard>

            <AnalyticsCard>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-cyan-700 uppercase">
                    Refresh
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">
                    Disparo controlado
                  </h3>
                </div>
                <StatusBadge
                  available={refreshConfiguration.available}
                  enabled={refreshConfiguration.enabled}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                O endpoint `/api/refresh/salesforce` valida sessão, permissão, mesma origem, lock,
                cooldown e timeout antes de chamar o webhook configurado.
              </p>
            </AnalyticsCard>
          </div>
        </section>

        <section aria-labelledby="salesforce-reports-title">
          <SectionHeading
            id="salesforce-reports-title"
            kicker="Relatórios autorizados"
            title="Base exportada para alimentar o CRM"
            description="A extração versionada consulta sete relatórios pela Analytics Reports API e transforma tudo em um snapshot normalizado para dashboard e ranking."
          />
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">
              <span>Relatório</span>
              <span>Report ID</span>
              <span>Identidade</span>
            </div>
            {REPORTS.map(([name, id, identity]) => (
              <div
                className="grid grid-cols-[minmax(8rem,1fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)] gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                key={id}
              >
                <strong className="text-slate-900">{name}</strong>
                <code className="break-words text-slate-600">{id}</code>
                <span className="text-slate-600">{identity}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="salesforce-pipeline-title">
          <SectionHeading
            id="salesforce-pipeline-title"
            kicker="Ciclo de meia hora"
            title="Exportar, validar e substituir"
            description="A rotina deve rodar fora do navegador do usuário, em host controlado, com Chrome dedicado já autenticado e segredos de máquina rotacionados por ambiente."
          />
          <div className="grid gap-5 md:grid-cols-3">
            {PIPELINE_STEPS.map((step) => (
              <AnalyticsCard key={step.title}>
                <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              </AnalyticsCard>
            ))}
          </div>
        </section>

        <DataState
          variant={ingestConfiguration.available ? "warning" : "unavailable"}
          title={
            ingestConfiguration.available
              ? "Pronto para receber snapshots configurados"
              : "Ingestão ainda indisponível neste ambiente"
          }
          description={
            ingestConfiguration.available
              ? "A primeira coleta real ainda deve ser reconciliada antes de declarar o CRM alimentado por Salesforce em produção."
              : "Configure `SALESFORCE_INGEST_ENABLED`, `SUPABASE_SECRET_KEY` e `SALESFORCE_INGEST_SECRET` no servidor para habilitar a escrita M2M."
          }
          action={
            <Link
              className="inline-flex min-h-11 items-center rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-800"
              href="/app/configuracoes"
              prefetch={false}
            >
              Voltar para Configurações
            </Link>
          }
        />
      </div>
    </main>
  );
}
