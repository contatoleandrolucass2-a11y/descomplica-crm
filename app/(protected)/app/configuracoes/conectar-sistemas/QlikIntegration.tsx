import Image from "next/image";
import { CircleCheck, CircleHelp, CirclePause, RefreshCw, Unplug } from "lucide-react";
import type { QlikStatusSnapshot } from "@/lib/crm/qlik/status-contract";
import styles from "./ConnectedSystemsPanel.module.css";

const STATES = {
  waiting: {
    label: "Não verificado",
    note: "Aguardando confirmação do coletor Qlik.",
    icon: CircleHelp,
  },
  unconfigured: {
    label: "Não configurado",
    note: "Coleta Qlik indisponível neste ambiente.",
    icon: CircleHelp,
  },
  running: {
    label: "Atualizando ranking",
    note: "Coleta em andamento. A publicação depende da validação completa dos dados.",
    icon: RefreshCw,
  },
  succeeded: {
    label: "Publicação confirmada",
    note: "O último ciclo publicou dados validados no CRM.",
    icon: CircleCheck,
  },
  reauth_required: {
    label: "Login necessário",
    note: "A sessão Qlik precisa ser renovada no navegador dedicado da VPS.",
    icon: Unplug,
  },
  unavailable: {
    label: "Atualização indisponível",
    note: "A última tentativa não confirmou a publicação. A última base válida é preservada.",
    icon: Unplug,
  },
  stale: {
    label: "Sem confirmação recente",
    note: "O coletor não enviou evidência recente. A última base válida é preservada.",
    icon: CirclePause,
  },
} as const;
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
function QlikState({ snapshot }: { snapshot: QlikStatusSnapshot }) {
  const state = STATES[snapshot.state];
  const Icon = state.icon;
  return (
    <span
      className={styles.status}
      data-state={
        snapshot.state === "succeeded"
          ? "connected"
          : snapshot.state === "running"
            ? "extracting"
            : snapshot.state
      }
    >
      <Icon size={15} aria-hidden="true" />
      {state.label}
    </span>
  );
}
export function QlikServiceCard({ snapshot }: { snapshot: QlikStatusSnapshot }) {
  return (
    <article className={styles.serviceCard}>
      <div className={styles.serviceLogoArea}>
        <Image
          className={`${styles.serviceLogo} ${styles.logoLight}`}
          src="/integrations/qlik-light.svg"
          width={116}
          height={52}
          alt="Qlik"
        />
        <Image
          className={`${styles.serviceLogo} ${styles.logoDark}`}
          src="/integrations/qlik-dark.svg"
          width={116}
          height={52}
          alt=""
          aria-hidden="true"
        />
      </div>
      <h3>Qlik</h3>
      <p>Ranking de imobiliárias e empreendimentos do Canal Imob.</p>
      <div className={styles.serviceHealth} aria-live="polite">
        <QlikState snapshot={snapshot} />
        <small>
          <Timestamp value={snapshot.checkedAt} empty="Sem verificação" />
        </small>
      </div>
    </article>
  );
}
export function QlikStatusDetails({ snapshot }: { snapshot: QlikStatusSnapshot }) {
  return (
    <section
      className={`${styles.salesforceDetails} ${styles.qlikDetails}`}
      aria-labelledby="qlik-details-title"
    >
      <header className={styles.salesforceDetailsHeading}>
        <div>
          <h2 id="qlik-details-title">Qlik · Canal de Parcerias</h2>
          <p>Direcional · SP Capital · Canal Imob</p>
        </div>
        <QlikState snapshot={snapshot} />
      </header>
      <div className={styles.connection}>
        <div className={styles.connectionCopy}>
          <p>{STATES[snapshot.state].note}</p>
          <span className={styles.muted}>
            Dados da fonte: <Timestamp value={snapshot.sourceUpdatedAt} />
          </span>
        </div>
      </div>
      <dl className={styles.metrics}>
        <div>
          <dt>Última coleta validada</dt>
          <dd>
            <Timestamp value={snapshot.lastCollectedAt} />
          </dd>
        </div>
        <div>
          <dt>Publicação confirmada no CRM</dt>
          <dd>
            <Timestamp value={snapshot.lastPublishedAt} empty="Sem publicação confirmada" />
          </dd>
        </div>
        <div>
          <dt>Próxima coleta prevista</dt>
          <dd>
            <Timestamp value={snapshot.nextRunAt} empty="Sem agenda confirmada" />
          </dd>
        </div>
        <div>
          <dt>Último contato do coletor</dt>
          <dd>
            <Timestamp value={snapshot.receivedAt} />
          </dd>
        </div>
      </dl>
      <footer className={styles.footer}>
        <span>
          A coleta automática ocorre uma hora após o término de cada ciclo. Horários de Brasília.
        </span>
      </footer>
    </section>
  );
}
