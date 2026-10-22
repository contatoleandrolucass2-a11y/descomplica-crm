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
import { useEffect, useRef, useState } from "react";

import {
  emptyMetaAdsConnectionSnapshot,
  META_ADS_ACCOUNT_ID,
  META_ADS_BUSINESS_ID,
  META_ADS_MANAGER_URL,
  type MetaAdsConnectionSnapshot,
} from "@/lib/crm/meta-ads/connection-contract";

import styles from "./ConnectedSystemsPanel.module.css";
import { startMetaAdsConnectionMonitor } from "./meta-ads-connection";

const STATES = {
  unconfigured: {
    label: "Não configurado",
    note: "Monitoramento da sessão Meta Ads indisponível neste ambiente.",
    icon: CircleHelp,
  },
  waiting: {
    label: "Não verificado",
    note: "Aguardando confirmação da conta no navegador dedicado da VPS.",
    icon: CircleHelp,
  },
  connected: {
    label: "Conectado",
    note: "Acesso somente leitura à conta de anúncios confirmado.",
    icon: CircleCheck,
  },
  reauth_required: {
    label: "Login necessário",
    note: "Abra o console Meta Ads para entrar na conta e concluir a autenticação solicitada.",
    icon: Unplug,
  },
  unavailable: {
    label: "Não conectado",
    note: "Não foi possível confirmar a sessão Meta Ads. Verifique novamente.",
    icon: Unplug,
  },
  stale: {
    label: "Sem confirmação recente",
    note: "Aguardando uma nova confirmação da sessão Meta Ads pelo monitor.",
    icon: CirclePause,
  },
  wrong_account: {
    label: "Conta divergente",
    note: "A conta aberta não corresponde à conta de anúncios configurada. Selecione a conta correta no console.",
    icon: Unplug,
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

function Timestamp({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{DATE_FORMAT.format(new Date(value))}</time>
  ) : (
    <span>Sem verificação</span>
  );
}

export function useMetaAdsConnection(configured: boolean) {
  const [snapshot, setSnapshot] = useState(() =>
    emptyMetaAdsConnectionSnapshot(configured ? "waiting" : "unconfigured"),
  );
  const [checking, setChecking] = useState(false);
  const monitorRef = useRef<ReturnType<typeof startMetaAdsConnectionMonitor> | null>(null);
  useEffect(() => {
    const monitor = startMetaAdsConnectionMonitor({
      configured,
      onSnapshot: setSnapshot,
      onChecking: setChecking,
    });
    monitorRef.current = monitor;
    return () => {
      monitorRef.current = null;
      monitor.dispose();
    };
  }, [configured]);
  return { snapshot, checking, verify: () => monitorRef.current?.verify() };
}

function MetaAdsState({ snapshot }: { snapshot: MetaAdsConnectionSnapshot }) {
  const state = STATES[snapshot.state];
  const Icon = state.icon;
  return (
    <span className={styles.status} data-state={snapshot.state}>
      <Icon size={15} aria-hidden="true" />
      {state.label}
    </span>
  );
}

export function MetaAdsServiceCard({ snapshot }: { snapshot: MetaAdsConnectionSnapshot }) {
  return (
    <article className={styles.serviceCard} data-meta-ads-service>
      <div className={styles.serviceLogoArea}>
        <Image
          className={`${styles.serviceLogo} ${styles.metaLogo} ${styles.logoLight}`}
          src="/integrations/meta-light.svg"
          width={350}
          height={360}
          alt="Meta"
        />
        <Image
          className={`${styles.serviceLogo} ${styles.metaLogo} ${styles.logoDark}`}
          src="/integrations/meta-dark.svg"
          width={350}
          height={360}
          alt=""
          aria-hidden="true"
        />
      </div>
      <h3>Meta Ads · Facebook Ads</h3>
      <p>Conexão oficial somente leitura com a conta de anúncios.</p>
      <div className={styles.serviceHealth} aria-live="polite">
        <MetaAdsState snapshot={snapshot} />
        <small>
          <Timestamp value={snapshot.checkedAt} />
        </small>
      </div>
    </article>
  );
}

export function MetaAdsStatusDetails({
  snapshot,
  checking,
  consoleAvailable,
  onVerify,
  onConnect,
}: {
  snapshot: MetaAdsConnectionSnapshot;
  checking: boolean;
  consoleAvailable: boolean;
  onVerify: () => void;
  onConnect: () => void;
}) {
  return (
    <section
      className={`${styles.salesforceDetails} ${styles.metaDetails}`}
      aria-labelledby="meta-ads-details-title"
    >
      <header className={styles.salesforceDetailsHeading}>
        <div>
          <h2 id="meta-ads-details-title">Meta Ads e conta de anúncios</h2>
          <p>API oficial da Meta com permissão exclusiva de leitura de anúncios.</p>
        </div>
        <div role="status" aria-live="polite">
          <MetaAdsState snapshot={snapshot} />
        </div>
      </header>
      <div className={styles.connection}>
        <div className={styles.connectionCopy}>
          <p>{STATES[snapshot.state].note}</p>
          <span className={styles.muted}>O CRM não publica, edita, pausa nem remove anúncios.</span>
        </div>
      </div>
      <dl className={styles.metrics}>
        <div>
          <dt>Conta de anúncios</dt>
          <dd>{META_ADS_ACCOUNT_ID}</dd>
        </div>
        <div>
          <dt>Portfólio empresarial</dt>
          <dd>{META_ADS_BUSINESS_ID}</dd>
        </div>
        <div>
          <dt>Última verificação</dt>
          <dd>
            <Timestamp value={snapshot.checkedAt} />
          </dd>
        </div>
        <div>
          <dt>Coleta de métricas</dt>
          <dd>{snapshot.state === "connected" ? "Ativa · somente leitura" : "Indisponível"}</dd>
        </div>
      </dl>
      <div className={styles.metaActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={!consoleAvailable}
          title={consoleAvailable ? "Conectar Meta Ads" : "Console indisponível para este acesso"}
          aria-haspopup="dialog"
          onClick={onConnect}
        >
          <Monitor size={16} aria-hidden="true" /> Conectar Meta Ads
        </button>
        <button type="button" className={styles.button} disabled={checking} onClick={onVerify}>
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={checking ? styles.spinning : undefined}
          />
          {checking ? "Verificando Meta Ads…" : "Verificar Meta Ads"}
        </button>
        <a
          href={META_ADS_MANAGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.button}
        >
          Abrir Gerenciador de Anúncios <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
      <footer className={styles.footer}>
        <span>
          A integração consulta desempenho e estrutura das campanhas. Nenhuma operação de escrita é
          executada no Gerenciador de Anúncios.
        </span>
      </footer>
    </section>
  );
}
