"use client";

import Link from "next/link";
import { useState } from "react";

import type { ReadModelV3Response, ReadModelV3Scope } from "@/lib/crm/read-model-v3/contracts";
import type {
  ReadModelV3Dimension,
  ReadModelV3FilterSelection,
} from "@/lib/crm/read-model-v3/filters";

const DIMENSIONS: Array<{
  key: ReadModelV3Dimension;
  optionKey: keyof ReadModelV3Response["options"];
  label: string;
}> = [
  { key: "origins", optionKey: "origins", label: "Origem" },
  { key: "organizations", optionKey: "organizations", label: "Organização / House" },
  { key: "teams", optionKey: "teams", label: "Equipe" },
  { key: "portfolios", optionKey: "portfolios", label: "Carteira" },
  { key: "coordinators", optionKey: "coordinators", label: "Coordenador" },
  { key: "managers", optionKey: "managers", label: "Gestor" },
  { key: "brokers", optionKey: "brokers", label: "Corretor" },
  { key: "developments", optionKey: "developments", label: "Empreendimento" },
  { key: "locations", optionKey: "locations", label: "Região / stand" },
];

const EMPTY_OPTIONS: ReadModelV3Response["options"] = {
  organizations: [],
  teams: [],
  portfolios: [],
  coordinators: [],
  managers: [],
  brokers: [],
  origins: [],
  developments: [],
  locations: [],
};

type FilterOption = ReadModelV3Response["options"][keyof ReadModelV3Response["options"]][number];

export function preserveSelectedFilterOption(
  options: FilterOption[],
  selectedId: string | undefined,
): FilterOption[] {
  if (!selectedId || options.some((option) => option.id === selectedId)) return options;
  return [{ id: selectedId, label: "Seleção atual autorizada" }, ...options.slice(0, 99)];
}

export function ReadModelV3Filters({
  action,
  scopes,
  selection,
  options = EMPTY_OPTIONS,
}: {
  action: string;
  scopes: ReadModelV3Scope[];
  selection: ReadModelV3FilterSelection;
  options?: ReadModelV3Response["options"];
}) {
  const [period, setPeriod] = useState(selection.period);

  return (
    <form
      action={action}
      method="get"
      className="rounded-2xl border border-cyan-950/10 bg-white p-4 shadow-sm"
      aria-label="Filtros dimensionais autorizados"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Escopo autorizado
          <select
            name="scope"
            defaultValue={selection.scopeId ?? ""}
            required={scopes.length > 1}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950"
          >
            {scopes.length !== 1 ? <option value="">Selecione</option> : null}
            {scopes.map((scope) => (
              <option key={scope.scope_id} value={scope.scope_id}>
                {scope.scope_label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Período
          <select
            name="period"
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as ReadModelV3FilterSelection["period"])
            }
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950"
          >
            <option value="month">Mês até a referência</option>
            <option value="week">Semana até a referência</option>
            <option value="today">Data de referência</option>
            <option value="custom">Intervalo personalizado</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Início inclusivo
          <input
            type="date"
            name="from"
            required={period === "custom"}
            disabled={period !== "custom"}
            defaultValue={selection.from ?? ""}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 disabled:bg-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Fim exclusivo
          <input
            type="date"
            name="to"
            required={period === "custom"}
            disabled={period !== "custom"}
            defaultValue={selection.to ?? ""}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 disabled:bg-slate-100"
          />
        </label>

        {DIMENSIONS.map(({ key, optionKey, label }) => {
          const selectedId = selection.dimensions[key][0];
          const dimensionOptions = preserveSelectedFilterOption(options[optionKey], selectedId);
          return (
            <label className="grid gap-1 text-sm font-medium text-slate-700" key={key}>
              {label}
              <select
                name={key}
                defaultValue={selectedId ?? ""}
                disabled={dimensionOptions.length === 0}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">
                  {dimensionOptions.length === 0 ? "Indisponível na fonte" : "Geral no escopo"}
                </option>
                {dimensionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0d304d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164b70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
        >
          Aplicar filtros
        </button>
        <Link
          href={action}
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-cyan-900 ring-1 ring-cyan-900/20 hover:bg-cyan-50"
        >
          Limpar
        </Link>
        <p className="text-xs text-slate-500">
          “Geral” nunca ultrapassa o escopo selecionado. Parâmetros inválidos falham fechados.
        </p>
      </div>
    </form>
  );
}
