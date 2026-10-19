"use client";

import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  DASHBOARD_FILTER_KEYS,
  type DashboardFilterKey,
  type DashboardFilterOptions,
  type DashboardFilters as FilterValues,
} from "@/lib/crm/dashboard/analysis";
import styles from "./DashboardFilters.module.css";

const labels: Record<DashboardFilterKey, string> = {
  channel: "Canal de vendas",
  manager: "Gerente de Vendas",
  owner: "Responsável da conta",
  company: "Empresa",
};
const allLabels: Record<DashboardFilterKey, string> = {
  channel: "Todos os canais",
  manager: "Todos os gerentes",
  owner: "Todos os responsáveis",
  company: "Todas as empresas",
};

export function DashboardFilters({
  values,
  options,
  available,
}: {
  values: FilterValues;
  options: DashboardFilterOptions;
  available: boolean;
}) {
  const router = useRouter();
  const query = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<DashboardFilterKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const document = root.ownerDocument;
    // Read committed disclosure state without resubscribing on each render.
    const openTrigger = () => root.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
    function dismissOutside(event: Event) {
      const trigger = openTrigger();
      if (
        trigger &&
        event.target instanceof Node &&
        !trigger.parentElement?.contains(event.target)
      ) {
        setOpenKey(null);
      }
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const trigger = openTrigger();
      if (!trigger) return;
      event.preventDefault();
      setOpenKey(null);
      trigger.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  function navigate(key: DashboardFilterKey, value: string) {
    const next = new URLSearchParams(query.toString());
    next.delete("period");
    const selected = values[key].includes(value)
      ? values[key].filter((item) => item !== value)
      : [...values[key], value];
    next.delete(key);
    selected.forEach((item) => next.append(key, item));
    startTransition(() => router.replace(`/app?${next}`, { scroll: false }));
  }
  return (
    <div ref={rootRef} className={styles.filters} aria-busy={pending}>
      <div className={styles.heading}>
        <h2>Filtros</h2>
      </div>
      <div className={styles.grid}>
        {DASHBOARD_FILTER_KEYS.map((key) => (
          <div key={key} className={styles.field}>
            <span id={`filter-${key}`}>{labels[key]}</span>
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.trigger}
                aria-labelledby={`filter-${key} value-${key}`}
                aria-expanded={openKey === key}
                aria-controls={`filter-panel-${key}`}
                onClick={() => setOpenKey((current) => (current === key ? null : key))}
              >
                <span id={`value-${key}`}>
                  {!available
                    ? "Indisponível"
                    : values[key].length === 0
                      ? allLabels[key]
                      : values[key].length === 1
                        ? values[key][0]
                        : `${values[key].length} selecionados`}
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <div
                id={`filter-panel-${key}`}
                className={styles.panel}
                role="group"
                aria-label={labels[key]}
                hidden={openKey !== key}
              >
                {[...new Set([...values[key], ...options[key]])].map((value) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={values[key].includes(value)}
                      onChange={() => navigate(key, value)}
                      disabled={
                        !available ||
                        pending ||
                        (!values[key].includes(value) &&
                          (!options[key].includes(value) || values[key].length >= 50))
                      }
                    />
                    <span>{value}</span>
                  </label>
                ))}
                {options[key].length === 0 ? (
                  <p>
                    {available
                      ? "Nenhuma opção neste recorte."
                      : "Aguardando atualização dos filtros."}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {pending ? <p role="status">Atualizando resultados...</p> : null}
      {!available ? <p role="status">Filtros aguardando coleta detalhada dos relatórios.</p> : null}
    </div>
  );
}
