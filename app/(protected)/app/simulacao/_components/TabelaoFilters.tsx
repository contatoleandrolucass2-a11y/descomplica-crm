"use client";

import type {
  TabelaoFacet,
  TabelaoFacetFilters,
  TabelaoFilterDimension,
} from "@/lib/archive-investor/tabelao-inventory.mjs";
import { InvestorInfoHint } from "./archive-investor/InvestorCalculator";
import { formatTabelaoParkingSpaces } from "@/lib/archive-investor/tabelao-inventory.mjs";
import { formatTabelaoDescription } from "@/lib/archive-investor/tabelao-presentation.mjs";

const fields: Array<{ dimension: TabelaoFilterDimension; label: string; all: string }> = [
  { dimension: "businessUnit", label: "Empresa", all: "Todas" },
  { dimension: "project", label: "Nome do empreendimento", all: "Todos" },
  { dimension: "region", label: "Região", all: "Todas" },
  { dimension: "plant", label: "Planta", all: "Todas" },
  { dimension: "parkingSpaces", label: "Quantidade de vagas", all: "Todas" },
  { dimension: "price", label: "Valor do imóvel", all: "Todos" },
];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const regionLabels: Record<string, string> = {
  centro: "Centro",
  "zona norte": "Zona Norte",
  "zona sul": "Zona Sul",
  "zona leste": "Zona Leste",
  "zona oeste": "Zona Oeste",
  localizando: "Localizando",
  "localizacao indisponivel": "Localização indisponível",
  "fora de sao paulo": "Fora de São Paulo",
};

function unavailableLabel(dimension: TabelaoFilterDimension, value: string) {
  if (dimension === "price") return money.format(Number(value) / 100);
  if (dimension === "region") return regionLabels[value] ?? value;
  if (dimension === "plant") return formatTabelaoDescription(value);
  if (dimension === "parkingSpaces")
    return formatTabelaoParkingSpaces(value === "unknown" ? null : Number(value));
  return value;
}

export function TabelaoFilters({
  filters,
  facets,
  order,
  disabled,
  onChange,
  onOrderChange,
  onClear,
}: {
  filters: TabelaoFacetFilters;
  facets: Record<TabelaoFilterDimension, TabelaoFacet>;
  order: "asc" | "desc";
  disabled: boolean;
  onChange: (dimension: TabelaoFilterDimension, value: string) => void;
  onOrderChange: (order: "asc" | "desc") => void;
  onClear: () => void;
}) {
  return (
    <div className="investor-stock-filters" data-tour="filters">
      <div className="investor-filter-heading">
        <div className="investor-filter-title-row">
          <strong>Filtros do estoque</strong>
          <InvestorInfoHint
            label="orientação dos filtros"
            title="Como usar os filtros?"
            description="Os filtros e contadores consideram uma opção por empreendimento, planta e quantidade de vagas. Vagas não informadas não equivalem a zero vagas. Valor do imóvel corresponde a Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela). A ordenação por valor mantém as opções agrupadas por empreendimento."
          />
        </div>
        <button type="button" onClick={onClear} disabled={disabled}>
          Limpar filtros
        </button>
      </div>
      {fields.map(({ dimension, label, all }) => (
        <label key={dimension}>
          <span>{label}</span>
          <select
            name={dimension}
            aria-label={label}
            value={filters[dimension]}
            disabled={disabled}
            onChange={(event) => onChange(dimension, event.target.value)}
          >
            <option value="">
              {all} ({facets[dimension].total.toLocaleString("pt-BR")})
            </option>
            {filters[dimension] &&
            !facets[dimension].options.some((item) => item.value === filters[dimension]) ? (
              <option value={filters[dimension]}>
                {unavailableLabel(dimension, filters[dimension])} (0)
              </option>
            ) : null}
            {facets[dimension].options.map((item) => (
              <option value={item.value} key={item.value}>
                {dimension === "price"
                  ? money.format(Number(item.value) / 100)
                  : dimension === "plant"
                    ? formatTabelaoDescription(item.label)
                    : item.label}{" "}
                ({item.count.toLocaleString("pt-BR")})
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="investor-stock-sort" data-tour="sort">
        <span>Ordenar valor</span>
        <select
          name="priceOrder"
          aria-label="Ordenar unidades por valor do imóvel"
          value={order}
          disabled={disabled}
          onChange={(event) => onOrderChange(event.target.value === "desc" ? "desc" : "asc")}
        >
          <option value="asc">Menor para o maior</option>
          <option value="desc">Maior para o menor</option>
        </select>
      </label>
    </div>
  );
}
