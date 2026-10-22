"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "./ProtectedShell.module.css";

const META_ADS_PATH = "/app/meta-ads";
const OPEN_ALERTS_EVENT = "descomplica:meta-ads-open-alerts";
const OPEN_ALERTS_AFTER_NAVIGATION_KEY = "descomplica-meta-ads-open-alerts";

type AlertSeverity = "danger" | "none" | "warning";

interface AlertState {
  count: number;
  severity: AlertSeverity;
}

function isAlertSeverity(value: unknown): value is AlertSeverity {
  return value === "danger" || value === "none" || value === "warning";
}

export function MetaAdsAlertButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertState>({ count: 0, severity: "none" });

  useEffect(() => {
    function handleAlertState(event: MessageEvent) {
      const frame = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Descomplica Ads — desempenho de campanhas Meta"]',
      );

      if (
        event.origin !== window.location.origin ||
        event.source !== frame?.contentWindow ||
        event.data?.type !== "descomplica:meta-ads-alert-state"
      ) {
        return;
      }

      const count = Number(event.data.count);
      const severity = event.data.severity;
      if (!Number.isInteger(count) || count < 0 || !isAlertSeverity(severity)) return;

      setAlerts({ count: Math.min(count, 999), severity });
    }

    window.addEventListener("message", handleAlertState);
    return () => window.removeEventListener("message", handleAlertState);
  }, []);

  function openAlerts() {
    if (pathname.startsWith(META_ADS_PATH)) {
      window.dispatchEvent(new Event(OPEN_ALERTS_EVENT));
      return;
    }

    try {
      window.sessionStorage.setItem(OPEN_ALERTS_AFTER_NAVIGATION_KEY, "1");
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
    router.push(META_ADS_PATH);
  }

  const visibleCount = alerts.count > 99 ? "99+" : String(alerts.count);
  const label =
    alerts.count === 0
      ? "Alertas do Meta Ads"
      : `Alertas do Meta Ads: ${alerts.count} não ${alerts.count === 1 ? "lido" : "lidos"}`;

  return (
    <button
      type="button"
      className={styles.metaAdsAlertButton}
      aria-label={label}
      title={label}
      data-meta-ads-alert-button
      data-severity={alerts.severity}
      onClick={openAlerts}
    >
      <Bell aria-hidden="true" size={20} />
      {alerts.count > 0 ? (
        <span className={styles.metaAdsAlertCount} aria-hidden="true">
          {visibleCount}
        </span>
      ) : null}
    </button>
  );
}
