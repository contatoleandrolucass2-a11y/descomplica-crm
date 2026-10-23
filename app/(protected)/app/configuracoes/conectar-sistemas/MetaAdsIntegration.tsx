import Image from "next/image";
import { CircleCheck, CircleHelp, CirclePause, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  emptyMetaAdsConnectionSnapshot,
  type MetaAdsConnectionSnapshot,
} from "@/lib/crm/meta-ads/connection-contract";

import styles from "./ConnectedSystemsPanel.module.css";
import { startMetaAdsConnectionMonitor } from "./meta-ads-connection";

const STATES = {
  unconfigured: {
    label: "Não configurado",
    icon: CircleHelp,
  },
  waiting: {
    label: "Verificando",
    icon: CircleHelp,
  },
  connected: {
    label: "Conectado",
    icon: CircleCheck,
  },
  reauth_required: {
    label: "Autorização necessária",
    icon: Unplug,
  },
  unavailable: {
    label: "Indisponível",
    icon: Unplug,
  },
  stale: {
    label: "Sem verificação recente",
    icon: CirclePause,
  },
  wrong_account: {
    label: "Conta divergente",
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
      <p>API oficial somente leitura para métricas da conta de anúncios.</p>
      <div className={styles.serviceHealth} aria-live="polite">
        <MetaAdsState snapshot={snapshot} />
        <small>
          <Timestamp value={snapshot.checkedAt} />
        </small>
      </div>
    </article>
  );
}
