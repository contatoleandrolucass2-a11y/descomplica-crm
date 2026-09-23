"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoOptions,
  matchesTabelaoFilters,
  sortTabelaoInventory,
  summarizeTabelao,
  TABELAO_PRICE_RANGES,
} from "@/lib/archive-investor/tabelao-inventory.mjs";
import { resolveInvestorRegion } from "@/lib/archive-investor/investor-region.mjs";

type InventoryItem = {
  id: string;
  businessUnit: string;
  project: string;
  product: string;
  identifier: string | null;
  plant: string | null;
  description: string | null;
  finalPrice: number | null;
  privateArea: number | null;
  constructionStatus: string | null;
  completionDate: string | null;
  neighborhood?: string | null;
  district?: string | null;
  region?: string | null;
};

type ExclusiveInventoryItem = InventoryItem & {
  exclusiveKey: string;
  availableUnits: number;
};

type InventoryPayload = {
  source: string;
  reportId?: string;
  generatedAt?: string;
  count: number;
  items: InventoryItem[];
};

type LoadState = "loading" | "ready" | "refreshing" | "error";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatPrice(value?: number | null) {
  return value != null && value > 0 ? money.format(value) : "Não informado";
}

export function TabelaoClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [meta, setMeta] = useState<InventoryPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadKey, setLoadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [businessUnit, setBusinessUnit] = useState("all");
  const [project, setProject] = useState("all");
  const [plant, setPlant] = useState("all");
  const [region, setRegion] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [order, setOrder] = useState("project");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/inventory", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("inventory_unavailable");
        const payload = (await response.json()) as InventoryPayload;
        if (!Array.isArray(payload.items) || payload.items.length !== Number(payload.count)) {
          throw new Error("inventory_payload_invalid");
        }
        setInventory(payload.items);
        setMeta(payload);
        setLoadState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [loadKey]);

  const exclusiveInventory = useMemo(
    () => buildTabelaoExclusiveInventory(inventory) as ExclusiveInventoryItem[],
    [inventory],
  );
  const options = useMemo(() => buildTabelaoOptions(exclusiveInventory), [exclusiveInventory]);
  const filters = useMemo(
    () => ({ query, businessUnit, project, plant, region, priceRange }),
    [query, businessUnit, project, plant, region, priceRange],
  );
  const filteredInventory = useMemo(
    () =>
      sortTabelaoInventory(
        exclusiveInventory.filter((item) => matchesTabelaoFilters(item, filters)),
        order,
      ) as ExclusiveInventoryItem[],
    [exclusiveInventory, filters, order],
  );
  const summary = useMemo(() => summarizeTabelao(filteredInventory), [filteredInventory]);
  const activeFilterCount = [
    query,
    businessUnit !== "all",
    project !== "all",
    plant !== "all",
    region !== "all",
    priceRange !== "all",
    order !== "project",
  ].filter(Boolean).length;

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
  }

  function reloadInventory() {
    setLoadState(inventory.length ? "refreshing" : "loading");
    setLoadKey((value) => value + 1);
  }

  function clearFilters() {
    setQuery("");
    setBusinessUnit("all");
    setProject("all");
    setPlant("all");
    setRegion("all");
    setPriceRange("all");
    setOrder("project");
  }

  return (
    <section className="tabelao-workspace" aria-labelledby="tabelao-results-title">
      <div className="tabelao-command-bar">
        <div className="tabelao-command-copy">
          <p>Consulta exclusiva</p>
          <h2 id="tabelao-results-title">Empreendimentos, plantas e menores valores</h2>
          <span>Cada combinação aparece uma única vez, sempre com o menor valor disponível.</span>
        </div>
        <div className="tabelao-source-status" role="status" aria-live="polite">
          <span className={`tabelao-status-dot ${loadState}`} aria-hidden="true" />
          <div>
            <strong>
              {loadState === "loading"
                ? "Carregando estoque"
                : loadState === "refreshing"
                  ? "Atualizando dados"
                  : loadState === "error"
                    ? "Estoque indisponível"
                    : `${exclusiveInventory.length.toLocaleString("pt-BR")} combinações exclusivas`}
            </strong>
            <small>
              {meta?.generatedAt
                ? `${inventory.length.toLocaleString("pt-BR")} unidades analisadas · Atualizado em ${dateTime.format(new Date(meta.generatedAt))}`
                : "Fonte oficial do estoque SPC"}
            </small>
          </div>
          <button
            type="button"
            onClick={reloadInventory}
            disabled={loadState === "loading" || loadState === "refreshing"}
          >
            {loadState === "loading" || loadState === "refreshing"
              ? "Atualizando…"
              : loadState === "error"
                ? "Tentar novamente"
                : "Atualizar dados"}
          </button>
        </div>
      </div>

      <div className="tabelao-filters" aria-label="Filtros do Tabelão">
        <label className="tabelao-search-field">
          <span>Busca rápida</span>
          <input
            name="tabelao-search"
            autoComplete="off"
            value={query}
            onChange={(event) => updateFilter(setQuery, event.target.value)}
            placeholder="Empreendimento ou planta…"
            type="search"
          />
        </label>
        <label>
          <span>Negócio</span>
          <select
            name="tabelao-business-unit"
            value={businessUnit}
            onChange={(event) => updateFilter(setBusinessUnit, event.target.value)}
          >
            <option value="all">Todos</option>
            {options.businessUnits.map((item: string) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Empreendimento</span>
          <select
            name="tabelao-project"
            value={project}
            onChange={(event) => updateFilter(setProject, event.target.value)}
          >
            <option value="all">Todos</option>
            {options.projects.map((item: string) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Planta</span>
          <select
            name="tabelao-plant"
            value={plant}
            onChange={(event) => updateFilter(setPlant, event.target.value)}
          >
            <option value="all">Todas</option>
            {options.plants.map((item: string) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Região</span>
          <select
            name="tabelao-region"
            value={region}
            onChange={(event) => updateFilter(setRegion, event.target.value)}
          >
            <option value="all">Todas</option>
            {options.regions.map((item: string) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Menor valor</span>
          <select
            name="tabelao-price"
            value={priceRange}
            onChange={(event) => updateFilter(setPriceRange, event.target.value)}
          >
            {TABELAO_PRICE_RANGES.map((item: { value: string; label: string }) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ordenar por</span>
          <select
            name="tabelao-order"
            value={order}
            onChange={(event) => updateFilter(setOrder, event.target.value)}
          >
            <option value="project">Empreendimento (A–Z)</option>
            <option value="price-asc">Menor valor</option>
            <option value="price-desc">Maior valor</option>
          </select>
        </label>
        <button
          className="tabelao-clear-filters"
          type="button"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          Limpar filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {loadState === "error" ? (
        <div className="tabelao-feedback error" role="alert">
          <div>
            <strong>Não foi possível carregar o estoque.</strong>
            <span>
              Nenhum dado alternativo foi exibido. Tente novamente para consultar a fonte oficial.
            </span>
          </div>
          <button type="button" onClick={reloadInventory}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loadState === "loading" ? (
        <div className="tabelao-loading" aria-label="Carregando combinações exclusivas">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {loadState !== "loading" && loadState !== "error" ? (
        <>
          <div className="tabelao-summary" aria-label="Resumo do resultado">
            <article>
              <span>Combinações exclusivas</span>
              <strong>{summary.exclusiveOptions.toLocaleString("pt-BR")}</strong>
            </article>
            <article>
              <span>Empreendimentos</span>
              <strong>{summary.projects.toLocaleString("pt-BR")}</strong>
            </article>
            <article>
              <span>Plantas</span>
              <strong>{summary.plants.toLocaleString("pt-BR")}</strong>
            </article>
            <article>
              <span>Menor valor</span>
              <strong>{formatPrice(summary.minimumPrice)}</strong>
            </article>
          </div>

          {filteredInventory.length === 0 ? (
            <div className="tabelao-feedback empty" role="status">
              <div>
                <strong>Nenhuma combinação encontrada.</strong>
                <span>Remova um filtro ou tente outro empreendimento ou planta.</span>
              </div>
              <button type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div
                className="tabelao-table-shell"
                role="region"
                aria-label="Empreendimentos, plantas e menores valores"
                tabIndex={0}
              >
                <table className="tabelao-table">
                  <caption className="sr-only">
                    Uma linha por empreendimento e planta, com o menor valor disponível no estoque
                    SPC
                  </caption>
                  <thead>
                    <tr>
                      <th>Empreendimento</th>
                      <th>Planta</th>
                      <th>Região</th>
                      <th>Unidades disponíveis</th>
                      <th>Menor valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.exclusiveKey}>
                        <td>
                          <strong>{item.project}</strong>
                          <small>{item.businessUnit}</small>
                        </td>
                        <td>{item.plant ?? "Não informada"}</td>
                        <td>{resolveInvestorRegion(item)}</td>
                        <td>{item.availableUnits.toLocaleString("pt-BR")}</td>
                        <td className="tabelao-price">{formatPrice(item.finalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tabelao-mobile-list" aria-label="Empreendimentos e plantas">
                {filteredInventory.map((item) => (
                  <article key={item.exclusiveKey} className="tabelao-unit-card">
                    <header>
                      <div>
                        <span>{item.businessUnit}</span>
                        <strong>{item.project}</strong>
                      </div>
                      <div className="tabelao-card-price">
                        <span>A partir de</span>
                        <strong>{formatPrice(item.finalPrice)}</strong>
                      </div>
                    </header>
                    <h3>{item.plant ?? "Planta não informada"}</h3>
                    <dl>
                      <div>
                        <dt>Região</dt>
                        <dd>{resolveInvestorRegion(item)}</dd>
                      </div>
                      <div>
                        <dt>Unidades disponíveis</dt>
                        <dd>{item.availableUnits.toLocaleString("pt-BR")}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
