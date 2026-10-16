"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
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
  const active = DASHBOARD_FILTER_KEYS.some((key) => values[key].length > 0);
  function navigate(key?: DashboardFilterKey, value?: string) {
    const next = new URLSearchParams(query.toString());
    next.delete("period");
    if (!key) DASHBOARD_FILTER_KEYS.forEach((filter) => next.delete(filter));
    else {
      const selected = values[key].includes(value!)
        ? values[key].filter((item) => item !== value)
        : [...values[key], value!];
      next.delete(key);
      selected.forEach((item) => next.append(key, item));
    }
    startTransition(() => router.replace(`/app?${next}`, { scroll: false }));
  }
  return (
    <div className={styles.filters} aria-busy={pending}>
      <div className={styles.heading}>
        <h2>Filtros</h2>
        <button
          type="button"
          onClick={() => navigate()}
          disabled={!active || pending}
          aria-label="Limpar filtros"
          title="Limpar filtros"
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className={styles.grid}>
        {DASHBOARD_FILTER_KEYS.map((key) => (
          <div key={key} className={styles.field}>
            <span id={`filter-${key}`}>{labels[key]}</span>
            <details className={styles.menu}>
              <summary aria-labelledby={`filter-${key} value-${key}`}>
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
              </summary>
              <fieldset disabled={!available || pending} aria-label={labels[key]}>
                {[...new Set([...values[key], ...options[key]])].map((value) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={values[key].includes(value)}
                      onChange={() => navigate(key, value)}
                      disabled={
                        !values[key].includes(value) &&
                        (!options[key].includes(value) || values[key].length >= 50)
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
              </fieldset>
            </details>
          </div>
        ))}
      </div>
      {pending ? <p role="status">Atualizando resultados...</p> : null}
      {!available ? <p role="status">Filtros aguardando coleta detalhada dos relatórios.</p> : null}
    </div>
  );
}
