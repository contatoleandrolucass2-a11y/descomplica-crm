"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_FILTER_SELECTION, filterCount } from "./dashboard-filtering";
import type {
  DashboardFilterData,
  DashboardFilterSelection,
} from "./types";

const STORAGE_KEY = "descomplica-dashboard-filters";

const FILTERS: Array<{
  key: keyof DashboardFilterSelection;
  label: string;
  placeholder: string;
}> = [
  { key: "salesChannels", label: "Canal de Vendas", placeholder: "Todos os canais" },
  { key: "managers", label: "Gerente de Vendas", placeholder: "Todos os gerentes" },
  { key: "owners", label: "Responsável da conta", placeholder: "Todos os responsáveis" },
  { key: "companies", label: "Empresa", placeholder: "Todas as empresas" },
];

export function useDashboardFilters() {
  const [selection, setSelection] = useState<DashboardFilterSelection>(EMPTY_FILTER_SELECTION);
  const storageReady = useRef(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        const restored = Object.fromEntries(
          FILTERS.map(({ key }) => [key, Array.isArray(parsed[key]) ? parsed[key].filter((item: unknown) => typeof item === "string") : []]),
        ) as DashboardFilterSelection;
        window.setTimeout(() => setSelection(restored), 0);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      window.setTimeout(() => {
        storageReady.current = true;
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!storageReady.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }, [selection]);

  return { selection, setSelection };
}

function MultiFilter({
  label,
  placeholder,
  options,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    if (!search) return options;
    return options.filter((option) => option.toLocaleLowerCase("pt-BR").includes(search));
  }, [options, query]);
  const summary = values.length === 0
    ? placeholder
    : values.length === 1
      ? values[0]
      : `${values.length} selecionados`;

  return (
    <details className="filter-control">
      <summary>
        <span>{label}</span>
        <strong title={values.join(", ")}>{summary}</strong>
        <i aria-hidden="true">⌄</i>
      </summary>
      <div className="filter-popover">
        <label className="filter-search">
          <span className="sr-only">Pesquisar em {label}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Pesquisar ${label.toLocaleLowerCase("pt-BR")}`}
          />
        </label>
        <div className="filter-options" role="group" aria-label={label}>
          {visibleOptions.length ? visibleOptions.map((option) => {
            const checked = values.includes(option);
            return (
              <label key={option} className={checked ? "selected" : ""}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? values.filter((item) => item !== option) : [...values, option])}
                />
                <span>{option}</span>
                <i aria-hidden="true">✓</i>
              </label>
            );
          }) : <p>Nenhuma opção encontrada.</p>}
        </div>
        {values.length ? (
          <button type="button" className="filter-clear-one" onClick={() => onChange([])}>
            Limpar {label.toLocaleLowerCase("pt-BR")}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function DashboardFilters({
  data,
  selection,
  onChange,
}: {
  data?: DashboardFilterData;
  selection: DashboardFilterSelection;
  onChange: (selection: DashboardFilterSelection) => void;
}) {
  const total = filterCount(selection);
  const selectedItems = FILTERS.flatMap(({ key, label }) =>
    selection[key].map((value) => ({ key, label, value })),
  );

  return (
    <section className="dashboard-filters" aria-label="Filtros do painel">
      <div className="filters-heading">
        <div>
          <span className="eyebrow">Filtros</span>
          <strong>Refine todo o funil</strong>
        </div>
        <div className="filters-status">
          <span>{total ? `${total} seleção${total === 1 ? "" : "ões"}` : "Todos os dados"}</span>
          {total ? <button type="button" onClick={() => onChange(EMPTY_FILTER_SELECTION)}>Limpar tudo</button> : null}
        </div>
      </div>

      <div className="filters-grid">
        {FILTERS.map((filter) => (
          <MultiFilter
            key={filter.key}
            label={filter.label}
            placeholder={filter.placeholder}
            options={data?.options[filter.key] ?? []}
            values={selection[filter.key]}
            onChange={(values) => onChange({ ...selection, [filter.key]: values })}
          />
        ))}
      </div>

      {selectedItems.length ? (
        <div className="filter-chips" aria-label="Seleções ativas">
          {selectedItems.map((item) => (
            <button
              type="button"
              key={`${item.key}-${item.value}`}
              onClick={() => onChange({
                ...selection,
                [item.key]: selection[item.key].filter((value) => value !== item.value),
              })}
              title={`Remover ${item.value}`}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <i aria-hidden="true">×</i>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
