"use client";

import {
  CircleCheck,
  CircleHelp,
  CirclePause,
  ExternalLink,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SalesforceRefreshButton } from "@/app/(protected)/app/_components/SalesforceRefreshButton";
import { SimulationCanvasHeader } from "@/app/(protected)/app/simulacao/_components/SimulationCanvasHeader";
import {
  emptySalesforceConnectionSnapshot as emptySnapshot,
  salesforceConnectionSnapshotSchema,
  type SalesforceConnectionSnapshot,
} from "@/lib/crm/salesforce/connection-contract";
import "@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css";

import styles from "./ConnectedSystemsPanel.module.css";

const REPORTS = [
  { key: "opportunities", name: "Oportunidades", id: "00OU600000DrfDeMAJ" },
  { key: "appointments", name: "Agendamentos", id: "00OU600000ELaA6MAL" },
  { key: "visits", name: "Visitas", id: "00OU600000EboNZMAZ" },
  { key: "folders", name: "Pastas", id: "00OU600000EjufWMAR" },
  { key: "sales", name: "Vendas", id: "00OU600000EjFyyMAF" },
  { key: "brokers", name: "Corretores", id: "00OTT000009j0l32AA" },
  { key: "imobAccounts", name: "Canal Imob", id: "00OU6000006RqzxMAC" },
] as const;

const STATES = {
  unconfigured: {
    label: "Status não configurado",
    note: "Monitoramento do coletor indisponível neste ambiente.",
    icon: CircleHelp,
  },
  waiting: {
    label: "Sessão não verificada",
    note: "Aguardando confirmação do coletor.",
    icon: CircleHelp,
  },
  connected: {
    label: "Coletor conectado",
    note: "Sessão confirmada pelo coletor.",
    icon: CircleCheck,
  },
  reauth_required: {
    label: "Reconexão necessária",
    note: "Reautorize a sessão no navegador dedicado do coletor.",
    icon: Unplug,
  },
  unavailable: {
    label: "Status indisponível",
    note: "Não foi possível confirmar a sessão do coletor.",
    icon: Unplug,
  },
  stale: {
    label: "Confirmação expirada",
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

export function ConnectedSystemsPanel({
  ingestLabel,
  refreshAvailable,
  canRefresh,
  statusConfigured,
}: {
  ingestLabel: string;
  refreshAvailable: boolean;
  canRefresh: boolean;
  statusConfigured: boolean;
}) {
  const [snapshot, setSnapshot] = useState<SalesforceConnectionSnapshot>(() =>
    emptySnapshot(statusConfigured ? "waiting" : "unconfigured"),
  );
  const [checking, setChecking] = useState(false);
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
      if (document.hidden) controller?.abort();
      else if (statusConfigured) void verify();
    }

    verifyRef.current = () => void verify();
    if (statusConfigured) void verify();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      verifyRef.current = null;
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [statusConfigured]);

  const connection = STATES[snapshot.state];
  const StatusIcon = connection.icon;
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
      <SimulationCanvasHeader
        title="Conectar Sistemas"
        subtitle="Salesforce"
        titleAccessory={
          <span role="status" className={styles.status} data-state={snapshot.state}>
            <StatusIcon size={16} aria-hidden="true" />
            {connection.label}
          </span>
        }
        actions={
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Verificar conexão"
              title="Verificar conexão"
              disabled={checking}
              onClick={() => verifyRef.current?.()}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
                className={checking ? styles.spinning : undefined}
              />
            </button>
            <a
              href="https://direcional.my.salesforce.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.button}
            >
              Abrir Salesforce <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        }
      />

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
            <span>7 relatórios previstos</span>
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
                return (
                  <tr key={report.key}>
                    <th scope="row">{report.name}</th>
                    <td className={styles.count}>
                      {result ? result.rows.toLocaleString("pt-BR") : "Sem dados"}
                    </td>
                    <td>
                      {result && snapshot.lastExportAt ? "Coletado" : "Sem coleta confirmada"}
                    </td>
                    <td>
                      <Timestamp value={result ? snapshot.lastExportAt : null} />
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
    </main>
  );
}
