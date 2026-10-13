"use client";

import Image from "next/image";
import {
  CircleCheck,
  CircleHelp,
  CirclePause,
  ExternalLink,
  Monitor,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SalesforceRefreshButton } from "@/app/(protected)/app/_components/SalesforceRefreshButton";
import {
  fetchIntegrationEvidence,
  getIntegrationServiceStatuses,
  type IntegrationEvidence,
} from "@/lib/crm/integrations/service-status";
import {
  emptySalesforceConnectionSnapshot as emptySnapshot,
  salesforceConnectionSnapshotSchema,
  type SalesforceConnectionSnapshot,
} from "@/lib/crm/salesforce/connection-contract";

import styles from "./ConnectedSystemsPanel.module.css";
import { SalesforceConsoleDialog } from "./SalesforceConsoleDialog";

const REPORTS = [
  { key: "opportunities", name: "Oportunidades", id: "00OU600000DrfDeMAJ" },
  { key: "appointments", name: "Agendamentos", id: "00OU600000ELaA6MAL" },
  { key: "visits", name: "Visitas", id: "00OU600000EboNZMAZ" },
  { key: "folders", name: "Pastas", id: "00OU600000EjufWMAR" },
  { key: "sales", name: "Vendas", id: "00OU600000EjFyyMAF" },
  { key: "brokers", name: "Corretores", id: "00OTT000009j0l32AA" },
  { key: "imobAccounts", name: "Canal Imob", id: "00OU6000006RqzxMAC" },
  { key: "inventory", name: "ESTOQUE SPC · unidades", id: "00OU6000007yRpKMAU" },
] as const;

const STATES = {
  unconfigured: {
    label: "Não conectado",
    note: "Monitoramento do coletor indisponível neste ambiente.",
    icon: CircleHelp,
  },
  waiting: {
    label: "Não verificado",
    note: "Aguardando confirmação do coletor.",
    icon: CircleHelp,
  },
  connected: {
    label: "Conectado",
    note: "Sessão confirmada pelo coletor.",
    icon: CircleCheck,
  },
  reauth_required: {
    label: "Não conectado",
    note: "Reautorize a sessão no navegador dedicado do coletor.",
    icon: Unplug,
  },
  unavailable: {
    label: "Não conectado",
    note: "Não foi possível confirmar a sessão do coletor.",
    icon: Unplug,
  },
  stale: {
    label: "Suspenso",
    note: "Aguardando nova prova de sessão do coletor.",
    icon: CirclePause,
  },
} as const;

const CYCLES = {
  idle: "Em espera",
  running: "Em andamento",
  succeeded: "Concluída",
  failed: "Falhou",
} as const;
const POLL_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function Timestamp({ value, empty = "Sem registro" }: { value: string | null; empty?: string }) {
  return value ? (
    <time dateTime={value}>{DATE_FORMAT.format(new Date(value))}</time>
  ) : (
    <span>{empty}</span>
  );
}

export function getSalesforceServiceStatus(
  snapshot: Pick<SalesforceConnectionSnapshot, "cycle" | "state">,
) {
  const connection = STATES[snapshot.state];
  const connectionStateHasPriority =
    snapshot.state === "reauth_required" || snapshot.state === "unavailable";
  const isExtracting = snapshot.cycle === "running" && !connectionStateHasPriority;

  return {
    state: isExtracting ? "extracting" : snapshot.state,
    label: isExtracting ? "Extraindo" : connection.label,
  };
}

export function ConnectedSystemsPanel({
  ingestLabel,
  refreshAvailable,
  canRefresh,
  statusConfigured,
  consoleAvailable = false,
  canReadSyncStatus = false,
}: {
  ingestLabel: string;
  refreshAvailable: boolean;
  canRefresh: boolean;
  statusConfigured: boolean;
  consoleAvailable?: boolean;
  canReadSyncStatus?: boolean;
}) {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleError, setConsoleError] = useState(false);
  const closeConsole = useCallback((credentialsFailed = false) => {
    setConsoleOpen(false);
    setConsoleError(credentialsFailed);
  }, []);
  const [snapshot, setSnapshot] = useState<SalesforceConnectionSnapshot>(() =>
    emptySnapshot(statusConfigured ? "waiting" : "unconfigured"),
  );
  const [checking, setChecking] = useState(false);
  const [integrationEvidence, setIntegrationEvidence] = useState<IntegrationEvidence | null>(null);
  const verifyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    async function verify() {
      if (disposed || controller || document.hidden) return;
      clearTimeout(pollTimer);
      const request = new AbortController();
      controller = request;
      setChecking(true);
      timeoutTimer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
      async function verifySalesforce() {
        try {
          const response = await fetch("/api/salesforce/status", {
            cache: "no-store",
            credentials: "same-origin",
            headers: { accept: "application/json" },
            signal: request.signal,
          });
          if (!response.ok) throw new Error("Status unavailable");
          const body = salesforceConnectionSnapshotSchema.parse(await response.json());
          if (body.state === "connected" && (!body.checkedAt || !body.receivedAt))
            throw new Error("Missing session evidence");
          if (!disposed && !request.signal.aborted) setSnapshot(body);
        } catch {
          if (!disposed) setSnapshot(emptySnapshot("unavailable"));
        }
      }

      async function verifyIntegrations() {
        if (!canReadSyncStatus) return;
        const evidence = await fetchIntegrationEvidence(request.signal);
        if (!disposed) setIntegrationEvidence(evidence);
      }

      try {
        await Promise.all([verifySalesforce(), verifyIntegrations()]);
      } finally {
        clearTimeout(timeoutTimer);
        controller = null;
        if (!disposed) {
          setChecking(false);
          if (!document.hidden) pollTimer = setTimeout(() => void verify(), POLL_INTERVAL_MS);
        }
      }
    }

    function onVisibilityChange() {
      clearTimeout(pollTimer);
      // A resumed tab needs fresh server evidence, including the server's TTL decision.
      setSnapshot((current) => ({
        ...current,
        state: statusConfigured ? "waiting" : "unconfigured",
      }));
      setIntegrationEvidence(null);
      if (document.hidden) controller?.abort();
      else if (statusConfigured || canReadSyncStatus) void verify();
    }

    verifyRef.current = () => void verify();
    if (statusConfigured || canReadSyncStatus) void verify();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      verifyRef.current = null;
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [statusConfigured, canReadSyncStatus]);

  const services = getIntegrationServiceStatuses(canReadSyncStatus ? integrationEvidence : null);
  const N8nIcon = services.n8n.state === "confirmed" ? CircleCheck : CircleHelp;
  const SupabaseIcon = services.supabase.state === "confirmed" ? CircleCheck : CircleHelp;
  const connection = STATES[snapshot.state];
  const StatusIcon = connection.icon;
  const { state: salesforceState, label: salesforceLabel } = getSalesforceServiceStatus(snapshot);
  const hasReports = snapshot.reports !== null;
  const publicationFailed = snapshot.errorCode === "publication_failed";
  const cycleLabel =
    snapshot.errorCode === "export_failed"
      ? "Coleta não concluída"
      : publicationFailed
        ? snapshot.lastExportAt && hasReports
          ? "Concluída"
          : "Sem informação"
        : snapshot.state === "unavailable" || snapshot.state === "unconfigured"
          ? "Sem informação"
          : CYCLES[snapshot.cycle];

  return (
    <main className={styles.page} data-connected-systems>
      <header className={styles.pageHeader} data-simulation-page-heading>
        <div>
          <h1>Integrações</h1>
          <p>Sistemas conectados ao CRM e evidências operacionais disponíveis.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Verificar conexão"
            title="Verificar evidências das integrações"
            disabled={checking}
            onClick={() => verifyRef.current?.()}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={checking ? styles.spinning : undefined}
            />
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={!consoleAvailable}
            title={
              consoleAvailable ? "Conectar Salesforce" : "Console indisponível para este acesso"
            }
            aria-haspopup="dialog"
            onClick={() => {
              setConsoleError(false);
              setConsoleOpen(true);
            }}
          >
            <Monitor size={16} aria-hidden="true" /> Conectar Salesforce
          </button>
          <a
            href="https://direcional.my.salesforce.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.button}
          >
            Abrir no navegador <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      {consoleError ? (
        <p role="alert" className={styles.consoleAlert}>
          Não foi possível autorizar o console. Tente novamente.
        </p>
      ) : null}
      {consoleOpen && consoleAvailable ? <SalesforceConsoleDialog onClose={closeConsole} /> : null}

      <section className={styles.services} aria-labelledby="services-title">
        <div className={styles.servicesHeading}>
          <div>
            <h2 id="services-title">Serviços</h2>
            <p>O estado só é afirmado quando existe uma fonte real de evidência.</p>
          </div>
          <span>3 serviços</span>
        </div>
        <div className={styles.servicesGrid}>
          <article className={styles.serviceCard}>
            <div className={styles.serviceLogoArea}>
              <Image
                className={`${styles.serviceLogo} ${styles.salesforceLogo}`}
                src="/integrations/salesforce.svg"
                width={92}
                height={64}
                alt="Salesforce"
              />
            </div>
            <h3>Salesforce</h3>
            <p>Relatórios comerciais e estoque de unidades usados pelo CRM.</p>
            <div className={styles.serviceHealth}>
              <span className={styles.status} data-state={salesforceState}>
                <StatusIcon size={15} aria-hidden="true" />
                {salesforceLabel}
              </span>
              <small>
                <Timestamp value={snapshot.checkedAt} empty="Sem verificação" />
              </small>
            </div>
          </article>

          <article className={styles.serviceCard}>
            <div className={styles.serviceLogoArea}>
              <Image
                className={`${styles.serviceLogo} ${styles.logoLight}`}
                src="/integrations/n8n-light.svg"
                width={148}
                height={40}
                alt="n8n"
              />
              <Image
                className={`${styles.serviceLogo} ${styles.logoDark}`}
                src="/integrations/n8n-dark.svg"
                width={148}
                height={40}
                alt=""
                aria-hidden="true"
              />
            </div>
            <h3>n8n</h3>
            <p>Fluxos de integração e atualização de dados.</p>
            <div className={styles.serviceHealth} aria-live="polite">
              <span
                className={styles.status}
                data-state={services.n8n.state === "confirmed" ? "connected" : services.n8n.state}
              >
                <N8nIcon size={15} aria-hidden="true" />
                {services.n8n.label}
              </span>
              <small>
                {services.n8n.timestamp ? (
                  <>
                    <Timestamp value={services.n8n.timestamp} />
                    <br />
                  </>
                ) : null}
                {canReadSyncStatus
                  ? services.n8n.note
                  : "Consulta não autorizada para este acesso."}
              </small>
            </div>
          </article>

          <article className={styles.serviceCard}>
            <div className={styles.serviceLogoArea}>
              <Image
                className={`${styles.serviceLogo} ${styles.logoLight}`}
                src="/integrations/supabase-light.svg"
                width={181}
                height={36}
                alt="Supabase"
              />
              <Image
                className={`${styles.serviceLogo} ${styles.logoDark}`}
                src="/integrations/supabase-dark.svg"
                width={181}
                height={36}
                alt=""
                aria-hidden="true"
              />
            </div>
            <h3>Supabase</h3>
            <p>Banco de dados e autenticação do CRM.</p>
            <div className={styles.serviceHealth} aria-live="polite">
              <span
                className={styles.status}
                data-state={
                  services.supabase.state === "confirmed" ? "connected" : services.supabase.state
                }
              >
                <SupabaseIcon size={15} aria-hidden="true" />
                {services.supabase.label}
              </span>
              <small>
                {services.supabase.timestamp ? (
                  <>
                    <Timestamp value={services.supabase.timestamp} />
                    <br />
                  </>
                ) : null}
                {canReadSyncStatus
                  ? services.supabase.note
                  : "Consulta não autorizada para este acesso."}
              </small>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.salesforceDetails} aria-labelledby="salesforce-details-title">
        <div className={styles.salesforceDetailsHeading}>
          <div>
            <h2 id="salesforce-details-title">Salesforce e relatórios</h2>
            <p>Monitoramento operacional com evidência recebida do coletor.</p>
          </div>
          <span role="status" className={styles.status} data-state={snapshot.state}>
            <StatusIcon size={16} aria-hidden="true" />
            {connection.label}
          </span>
        </div>

        <section className={styles.connection} aria-label="Sessão do coletor">
          <div className={styles.connectionCopy}>
            <p>{connection.note}</p>
            <span className={styles.muted}>Autenticação manual com MFA</span>
          </div>
          <span className={styles.checked}>
            Última verificação: <Timestamp value={snapshot.checkedAt} />
          </span>
        </section>

        <dl className={styles.metrics}>
          <div>
            <dt>Coleta</dt>
            <dd>{cycleLabel}</dd>
          </div>
          <div>
            <dt>Última coleta</dt>
            <dd>
              <Timestamp value={snapshot.lastExportAt} />
            </dd>
          </div>
          <div>
            <dt>Última publicação no CRM</dt>
            <dd>
              {publicationFailed ? (
                <span className={styles.status} data-state="unavailable">
                  Publicação não confirmada
                </span>
              ) : null}
              {!publicationFailed || snapshot.lastPublishedAt ? (
                <Timestamp value={snapshot.lastPublishedAt} empty="Sem publicação confirmada" />
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Próxima execução</dt>
            <dd>
              <Timestamp value={snapshot.nextRunAt} empty="Sem agenda confirmada" />
            </dd>
          </div>
        </dl>

        <section className={styles.reports} aria-labelledby="reports-title">
          <header className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <h2 id="reports-title">Relatórios</h2>
              <span>7 relatórios comerciais + estoque</span>
            </div>
            <div className={styles.refreshAction}>
              {canRefresh ? (
                <SalesforceRefreshButton
                  available={refreshAvailable}
                  messageClassName={styles.muted ?? ""}
                />
              ) : (
                <span className={styles.muted}>Sem permissão para atualizar</span>
              )}
            </div>
          </header>
          <div
            className={styles.tableScroll}
            role="region"
            aria-label="Relatórios do Salesforce"
            tabIndex={0}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Relatório</th>
                  <th scope="col" className={styles.count}>
                    Linhas coletadas
                  </th>
                  <th scope="col">Última coleta</th>
                  <th scope="col">Horário da coleta</th>
                  <th scope="col">
                    <span className="sr-only">Abrir relatório</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((report) => {
                  const result = snapshot.reports?.find((item) => item.key === report.key);
                  const inventory = report.key === "inventory";
                  const rows = inventory ? snapshot.inventory?.sourceRows : result?.rows;
                  const collectedAt = inventory
                    ? (snapshot.inventory?.generatedAt ?? null)
                    : result
                      ? snapshot.lastExportAt
                      : null;
                  return (
                    <tr key={report.key}>
                      <th scope="row">{report.name}</th>
                      <td className={styles.count}>
                        {rows !== undefined ? rows.toLocaleString("pt-BR") : "Sem dados"}
                      </td>
                      <td>
                        {collectedAt
                          ? inventory
                            ? "Base validada · coleta avulsa"
                            : "Coletado"
                          : "Sem coleta confirmada"}
                      </td>
                      <td>
                        <Timestamp value={collectedAt} />
                      </td>
                      <td>
                        <a
                          className={styles.reportLink}
                          href={`https://direcional.lightning.force.com/lightning/r/Report/${report.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir ${report.name} no Salesforce`}
                          title={`Abrir ${report.name} no Salesforce`}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className={styles.footer}>
            <span>
              {hasReports
                ? "Contagens da coleta informada. Publicação no CRM verificada separadamente."
                : "Aguardando contagens do coletor."}
            </span>
            <a
              href="https://direcional.lightning.force.com/lightning"
              target="_blank"
              rel="noopener noreferrer"
            >
              Console de vendas <ExternalLink size={14} aria-hidden="true" />
            </a>
          </footer>
        </section>
        <div className={styles.configuration}>
          <span>
            Ingestão no CRM: <strong>{ingestLabel}</strong>
          </span>
          <span>
            Atualização manual: <strong>{refreshAvailable ? "Disponível" : "Indisponível"}</strong>
          </span>
          <span>Horários de Brasília</span>
        </div>
      </section>
    </main>
  );
}
