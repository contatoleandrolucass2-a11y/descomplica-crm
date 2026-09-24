"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

// @ts-expect-error — módulo compartilhado preservado em JavaScript.
import * as investorFilterOptions from "@/lib/archive-investor/investor-filter-options.mjs";

import { InvestorInfoHint } from "./archive-investor/InvestorCalculator";

type InventoryItem = {
  id: string;
  businessUnit: string;
  project: string;
  product: string;
  identifier: string | null;
  plant: string | null;
  finalPrice: number | null;
  privateArea: number | null;
  completionDate: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
};

type InventoryPayload = {
  source?: string;
  generatedAt?: string;
  snapshotReferenceDate?: string;
  sourceKind?: "live" | "versioned-snapshot";
  count: number;
  items: InventoryItem[];
};

type LoadState = "loading" | "ready" | "error";
type InventoryFilters = {
  businessUnit: string;
  project: string;
  plant: string;
  region: string;
  salePrice: string;
};
type FilterOption = { value: string; count: number };
type InventoryFilterOptions = {
  businessUnits: FilterOption[];
  projects: FilterOption[];
  plants: FilterOption[];
  regions: FilterOption[];
  salePrices: FilterOption[];
  totals: Record<keyof InventoryFilters, number>;
};

const {
  buildInvestorFilterOptions,
  matchesInvestorFilters,
  reconcileInvestorFilters,
  sortInvestorInventoryBySalePrice,
} = investorFilterOptions as {
  buildInvestorFilterOptions: (
    inventory: InventoryItem[],
    filters: InventoryFilters,
  ) => InventoryFilterOptions;
  matchesInvestorFilters: (item: InventoryItem, filters: InventoryFilters) => boolean;
  reconcileInvestorFilters: (
    inventory: InventoryItem[],
    filters: InventoryFilters,
  ) => InventoryFilters;
  sortInvestorInventoryBySalePrice: (
    inventory: InventoryItem[],
    direction: "asc" | "desc",
  ) => InventoryItem[];
};

const INVENTORY_WINDOW_SIZE = 60;
const DESKTOP_ROW_HEIGHT = 23;
const MOBILE_ROW_HEIGHT = 44;
const TABELAO_TOUR_STEPS = [
  {
    target: "welcome",
    eyebrow: "Visão geral",
    title: "Consulte o estoque completo",
    description:
      "O Tabelão reúne todas as unidades do estoque SPC. O guia mostra como filtrar, comparar e abrir a unidade na Tabela Direta.",
    tip: "Avançar no guia não altera filtros nem abre outra página.",
    checklist: ["Consulte o estoque", "Combine os filtros", "Abra a unidade correta"],
  },
  {
    target: "information",
    eyebrow: "Ajuda em cada etapa",
    title: "Consulte os ícones de informação",
    description:
      "Os ícones de informação explicam a área ao lado. Passe o cursor, use o foco ou clique para manter a explicação aberta.",
    tip: "Clique em qualquer área fora da explicação para fechá-la.",
    checklist: ["Localize o ícone", "Leia a orientação", "Continue a consulta"],
  },
  {
    target: "filters",
    eyebrow: "Encontre o imóvel",
    title: "Defina o perfil desejado",
    description:
      "Combine Incorporadora, Empreendimento, Região, Planta e Valor do Imóvel. Cada escolha atualiza as opções e o total encontrado.",
    tip: "Use Limpar filtros para recomeçar.",
    checklist: ["Combine os filtros", "Confira o total", "Ajuste a busca"],
  },
  {
    target: "inventory",
    eyebrow: "Consulte as unidades",
    title: "Confira a unidade correta",
    description:
      "Revise produto, metragem, entrega, planta e valor. O botão circular da primeira coluna abre a página Tabela Direta para continuar o atendimento.",
    tip: "Confirme os dados antes de iniciar a proposta.",
    checklist: ["Confira produto e planta", "Revise entrega e valor", "Abra a Tabela Direta"],
  },
  {
    target: "sort",
    eyebrow: "Organize a comparação",
    title: "Ordene as unidades por valor",
    description:
      "Escolha Menor para o maior ou Maior para o menor. A ordenação muda somente a sequência da lista.",
    tip: "Use a ordenação para comparar unidades próximas de preço.",
    checklist: ["Escolha a direção", "Compare os valores", "Confirme a unidade"],
  },
] as const;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatDate(value?: string | null) {
  return value ? date.format(new Date(`${value}T12:00:00.000Z`)) : "Não informada";
}

function informationLabel(value?: string | null) {
  return value?.trim() || "Não informado";
}

export function TabelaoClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryMeta, setInventoryMeta] = useState<InventoryPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadKey, setLoadKey] = useState(0);
  const [businessUnit, setBusinessUnit] = useState("Todas");
  const [project, setProject] = useState("Todos");
  const [plant, setPlant] = useState("Todos");
  const [region, setRegion] = useState("Todas");
  const [salePriceFilter, setSalePriceFilter] = useState("Todos");
  const [priceSort, setPriceSort] = useState<"asc" | "desc">("asc");
  const [filterNotice, setFilterNotice] = useState("");
  const [inventoryWindowStart, setInventoryWindowStart] = useState(0);
  const [inventoryRowHeight, setInventoryRowHeight] = useState(DESKTOP_ROW_HEIGHT);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourSpotlight, setTourSpotlight] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const [tourPlacement, setTourPlacement] = useState({ top: false, left: false });
  const inventoryResultsRef = useRef<HTMLDivElement>(null);
  const tourPanel = useRef<HTMLElement>(null);
  const tourReturnFocus = useRef<HTMLButtonElement | null>(null);
  const currentTourStep = TABELAO_TOUR_STEPS[tourStep] ?? TABELAO_TOUR_STEPS[0];

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
        setInventoryMeta(payload);
        setInventoryWindowStart(0);
        setLoadState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [loadKey]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1239px)");
    const updateRowHeight = () => {
      setInventoryRowHeight(media.matches ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT);
      setInventoryWindowStart(0);
      if (inventoryResultsRef.current) inventoryResultsRef.current.scrollTop = 0;
    };
    updateRowHeight();
    media.addEventListener("change", updateRowHeight);
    return () => media.removeEventListener("change", updateRowHeight);
  }, []);

  useEffect(() => {
    const openGuide = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: HTMLButtonElement }>).detail?.trigger;
      tourReturnFocus.current = trigger ?? null;
      setTourStep(0);
      setTourOpen(true);
    };
    window.addEventListener("investor:start-guide", openGuide);
    return () => window.removeEventListener("investor:start-guide", openGuide);
  }, []);

  const activeFilters = useMemo(
    () => ({ businessUnit, project, plant, region, salePrice: salePriceFilter }),
    [businessUnit, plant, project, region, salePriceFilter],
  );
  const filterOptions = useMemo(
    () => buildInvestorFilterOptions(inventory, activeFilters),
    [activeFilters, inventory],
  );
  const matchingInventory = useMemo(
    () =>
      sortInvestorInventoryBySalePrice(
        inventory.filter((item) => matchesInvestorFilters(item, activeFilters)),
        priceSort,
      ) as InventoryItem[],
    [activeFilters, inventory, priceSort],
  );
  const visibleInventory = useMemo(
    () =>
      matchingInventory.slice(
        inventoryWindowStart,
        Math.min(matchingInventory.length, inventoryWindowStart + INVENTORY_WINDOW_SIZE),
      ),
    [inventoryWindowStart, matchingInventory],
  );
  const inventoryWindowEnd = inventoryWindowStart + visibleInventory.length;
  const inventoryTopSpacer = inventoryWindowStart * inventoryRowHeight;
  const inventoryBottomSpacer =
    (matchingInventory.length - inventoryWindowEnd) * inventoryRowHeight;

  useEffect(() => {
    const reconciledFilters = reconcileInvestorFilters(inventory, activeFilters);
    const changedDimension = (
      ["businessUnit", "project", "plant", "region", "salePrice"] as const
    ).find((dimension) => reconciledFilters[dimension] !== activeFilters[dimension]);
    if (!changedDimension) return;

    const resetInvalidFilters = window.setTimeout(() => {
      setBusinessUnit(reconciledFilters.businessUnit);
      setProject(reconciledFilters.project);
      setPlant(reconciledFilters.plant);
      setRegion(reconciledFilters.region);
      setSalePriceFilter(reconciledFilters.salePrice);
      setFilterNotice("Uma seleção indisponível foi limpa após a atualização do estoque.");
    }, 0);
    return () => window.clearTimeout(resetInvalidFilters);
  }, [activeFilters, inventory]);

  useEffect(() => {
    if (!tourOpen) return;

    const currentTarget = document.querySelector<HTMLElement>(
      `[data-tour="${currentTourStep.target}"]`,
    );
    if (!currentTarget) return;

    let spotlightFrame = 0;
    const updateSpotlight = () => {
      const rect = currentTarget.getBoundingClientRect();
      const gutter = window.innerWidth <= 760 ? 6 : 10;
      setTourSpotlight({
        top: Math.max(gutter, rect.top - gutter),
        left: Math.max(gutter, rect.left - gutter),
        width: Math.min(window.innerWidth - gutter * 2, rect.width + gutter * 2),
        height: Math.min(window.innerHeight - gutter * 2, rect.height + gutter * 2),
      });
      setTourPlacement({
        top: rect.top + rect.height / 2 > window.innerHeight / 2,
        left: rect.left + rect.width / 2 > window.innerWidth / 2,
      });
    };
    const scheduleSpotlight = () => {
      if (spotlightFrame) return;
      spotlightFrame = window.requestAnimationFrame(() => {
        spotlightFrame = 0;
        updateSpotlight();
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const popupControl =
        event.target instanceof Element ? event.target.closest("select,[aria-haspopup]") : null;
      if (!event.defaultPrevented && !popupControl && event.key === "Escape") closeGuidedTour();
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stockScroller = currentTarget.closest<HTMLElement>(".investor-stock-results");
    const previousScrollLeft = stockScroller?.scrollLeft ?? 0;

    currentTarget.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
    if (stockScroller) stockScroller.scrollLeft = previousScrollLeft;
    const focusFrame = window.requestAnimationFrame(() => {
      scheduleSpotlight();
      tourPanel.current?.focus({ preventScroll: true });
    });
    const resizeObserver = new ResizeObserver(scheduleSpotlight);
    resizeObserver.observe(currentTarget);
    window.addEventListener("resize", scheduleSpotlight);
    window.addEventListener("scroll", scheduleSpotlight, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (spotlightFrame) window.cancelAnimationFrame(spotlightFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSpotlight);
      window.removeEventListener("scroll", scheduleSpotlight, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [currentTourStep.target, tourOpen]);

  function closeGuidedTour() {
    setTourOpen(false);
    window.requestAnimationFrame(() => tourReturnFocus.current?.focus());
  }

  function showPreviousTourStep() {
    setTourStep((current) => Math.max(0, current - 1));
  }

  function showNextTourStep() {
    if (tourStep === TABELAO_TOUR_STEPS.length - 1) {
      closeGuidedTour();
      return;
    }
    setTourStep((current) => Math.min(TABELAO_TOUR_STEPS.length - 1, current + 1));
  }

  function reloadInventory() {
    setInventory([]);
    setInventoryMeta(null);
    setInventoryWindowStart(0);
    setLoadState("loading");
    setLoadKey((value) => value + 1);
  }

  function clearFilters() {
    setBusinessUnit("Todas");
    setProject("Todos");
    setPlant("Todos");
    setRegion("Todas");
    setSalePriceFilter("Todos");
    setPriceSort("asc");
    setFilterNotice("");
    resetInventoryWindow();
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setFilterNotice("");
    resetInventoryWindow();
  }

  function resetInventoryWindow() {
    setInventoryWindowStart(0);
    if (inventoryResultsRef.current) inventoryResultsRef.current.scrollTop = 0;
  }

  function updateInventoryWindow(scrollTop: number) {
    const overscan = 10;
    const nextStart = Math.max(0, Math.floor(scrollTop / inventoryRowHeight) - overscan);
    const maximumStart = Math.max(0, matchingInventory.length - INVENTORY_WINDOW_SIZE);
    const boundedStart = Math.min(nextStart, maximumStart);
    if (boundedStart !== inventoryWindowStart) {
      const focusedRow = inventoryResultsRef.current?.querySelector<HTMLTableRowElement>(
        "tr:focus-within[aria-rowindex]",
      );
      const focusedIndex = Number(focusedRow?.getAttribute("aria-rowindex")) - 2;
      if (
        Number.isInteger(focusedIndex) &&
        (focusedIndex < boundedStart || focusedIndex >= boundedStart + INVENTORY_WINDOW_SIZE)
      ) {
        inventoryResultsRef.current?.focus({ preventScroll: true });
      }
    }
    setInventoryWindowStart((current) => (boundedStart === current ? current : boundedStart));
  }

  return (
    <div className="investor-workspace investor-direct-workspace investor-direct-design-copy">
      {tourOpen ? (
        <>
          <div
            className="investor-tour-spotlight"
            aria-hidden="true"
            style={{
              top: tourSpotlight.top,
              left: tourSpotlight.left,
              width: tourSpotlight.width,
              height: tourSpotlight.height,
            }}
          />
          <aside
            id="investor-guided-tour"
            ref={tourPanel}
            className={[
              "investor-guided-tour",
              tourPlacement.top ? "at-top" : null,
              tourPlacement.left ? "at-left" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-modal="false"
            aria-labelledby="investor-guided-tour-title"
            aria-describedby="investor-guided-tour-description"
            tabIndex={-1}
          >
            <header>
              <span>
                Passo {tourStep + 1} de {TABELAO_TOUR_STEPS.length}
              </span>
              <button type="button" onClick={closeGuidedTour} aria-label="Fechar passo a passo">
                ×
              </button>
            </header>
            <div
              className="investor-tour-progress"
              role="progressbar"
              aria-label="Progresso do guia"
              aria-valuemin={1}
              aria-valuemax={TABELAO_TOUR_STEPS.length}
              aria-valuenow={tourStep + 1}
            >
              <span style={{ width: `${((tourStep + 1) / TABELAO_TOUR_STEPS.length) * 100}%` }} />
            </div>
            <div className="investor-tour-copy" aria-live="polite">
              <span>{currentTourStep.eyebrow}</span>
              <h2 id="investor-guided-tour-title">{currentTourStep.title}</h2>
              <p id="investor-guided-tour-description">{currentTourStep.description}</p>
              <ul>
                {currentTourStep.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <small>{currentTourStep.tip}</small>
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={showPreviousTourStep}
                disabled={tourStep === 0}
              >
                Anterior
              </button>
              <button type="button" onClick={showNextTourStep}>
                {tourStep === TABELAO_TOUR_STEPS.length - 1 ? "Concluir guia" : "Próximo"}
              </button>
            </footer>
          </aside>
        </>
      ) : null}

      <section className="investor-stock-panel" aria-labelledby="tabelao-stock-title">
        <header className="investor-section-heading">
          <span>01</span>
          <div>
            <p>Estoque SPC</p>
            <h2 id="tabelao-stock-title">Escolha a unidade</h2>
          </div>
          <div className="investor-stock-sync" role="status" aria-live="polite" aria-atomic="true">
            <small>
              {loadState === "ready"
                ? `${inventory.length.toLocaleString("pt-BR")} unidades`
                : loadState === "error"
                  ? "Estoque indisponível"
                  : "Carregando estoque"}
            </small>
            {inventoryMeta?.sourceKind === "versioned-snapshot" &&
            inventoryMeta.snapshotReferenceDate ? (
              <small>
                Arquivo {inventoryMeta.source || "ESTOQUE SPC.xlsx"} · referência{" "}
                {formatDate(inventoryMeta.snapshotReferenceDate)}
              </small>
            ) : inventoryMeta?.generatedAt ? (
              <small>Atualizado {dateTime.format(new Date(inventoryMeta.generatedAt))}</small>
            ) : loadState === "ready" ? (
              <small>
                Fonte viva {inventoryMeta?.source || "estoque protegido"} · atualização não
                informada
              </small>
            ) : null}
          </div>
        </header>

        <div className="investor-stock-filters" data-tour="filters">
          <div className="investor-filter-heading">
            <div className="investor-filter-title-row">
              <strong>Filtros do estoque</strong>
              <InvestorInfoHint
                label="orientação dos filtros"
                title="Como usar os filtros?"
                description="Use os filtros para localizar a unidade exata do estoque SPC que será consultada no Tabelão."
              />
            </div>
            <button type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
          <label>
            <span>Incorporadora</span>
            <select
              value={businessUnit}
              onChange={(event) => updateFilter(setBusinessUnit, event.target.value)}
            >
              <option value="Todas">
                Todas ({filterOptions.totals.businessUnit.toLocaleString("pt-BR")})
              </option>
              {filterOptions.businessUnits.map((item: { value: string; count: number }) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Nome do Empreendimento</span>
            <select
              value={project}
              onChange={(event) => updateFilter(setProject, event.target.value)}
            >
              <option value="Todos">
                Todos ({filterOptions.totals.project.toLocaleString("pt-BR")})
              </option>
              {filterOptions.projects.map((item: { value: string; count: number }) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Região</span>
            <select
              value={region}
              onChange={(event) => updateFilter(setRegion, event.target.value)}
            >
              <option value="Todas">
                Todas ({filterOptions.totals.region.toLocaleString("pt-BR")})
              </option>
              {filterOptions.regions.map((item: { value: string; count: number }) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Planta</span>
            <select value={plant} onChange={(event) => updateFilter(setPlant, event.target.value)}>
              <option value="Todos">
                Todos ({filterOptions.totals.plant.toLocaleString("pt-BR")})
              </option>
              {filterOptions.plants.map((item: { value: string; count: number }) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Valor do Imóvel</span>
            <select
              value={salePriceFilter}
              onChange={(event) => updateFilter(setSalePriceFilter, event.target.value)}
            >
              <option value="Todos">
                Todos ({filterOptions.totals.salePrice.toLocaleString("pt-BR")})
              </option>
              {filterOptions.salePrices.map((item: { value: string; count: number }) => (
                <option value={item.value} key={item.value}>
                  {money.format(Number(item.value))} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label className="investor-stock-sort" data-tour="sort">
            <span>Ordenar valor</span>
            <select
              aria-label="Ordenar unidades por valor do imóvel"
              value={priceSort}
              onChange={(event) => {
                setPriceSort(event.target.value as "asc" | "desc");
                resetInventoryWindow();
              }}
            >
              <option value="asc">Menor para o maior</option>
              <option value="desc">Maior para o menor</option>
            </select>
          </label>
          {filterNotice ? (
            <span className="sr-only" aria-live="polite">
              {filterNotice}
            </span>
          ) : null}
        </div>

        <p className="investor-stock-summary sr-only" aria-live="polite">
          {loadState === "ready"
            ? matchingInventory.length > 0
              ? `${matchingInventory.length.toLocaleString("pt-BR")} unidades encontradas.`
              : "Nenhuma unidade disponível com os filtros atuais."
            : loadState === "loading"
              ? "Carregando estoque…"
              : "Estoque indisponível"}
        </p>

        <div
          ref={inventoryResultsRef}
          className="investor-stock-results"
          role="region"
          aria-label="Estoque completo de unidades"
          tabIndex={0}
          data-tour="inventory"
          onScroll={(event) => updateInventoryWindow(event.currentTarget.scrollTop)}
        >
          <table className="investor-stock-table" aria-rowcount={matchingInventory.length + 1}>
            <caption className="sr-only">Unidades encontradas no estoque</caption>
            <colgroup>
              <col className="investor-stock-col-start" />
              <col className="investor-stock-col-business" />
              <col className="investor-stock-col-product" />
              <col className="investor-stock-col-area" />
              <col className="investor-stock-col-date" />
              <col className="investor-stock-col-plant" />
              <col className="investor-stock-col-price" />
            </colgroup>
            <thead>
              <tr>
                <th className="investor-stock-start-heading">Início</th>
                <th>Incorporadora</th>
                <th>Produto</th>
                <th>Metragem</th>
                <th>Data de Entrega</th>
                <th>Planta</th>
                <th>Valor do imóvel</th>
              </tr>
            </thead>
            <tbody>
              {loadState === "loading" ? (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Carregando unidades do estoque…
                  </td>
                </tr>
              ) : null}
              {loadState === "error" ? (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Arquivo oficial do estoque indisponível. Nenhuma fonte alternativa foi usada.{" "}
                    <button
                      type="button"
                      className="investor-stock-action-button investor-stock-retry-button"
                      onClick={reloadInventory}
                    >
                      Tentar novamente
                    </button>
                  </td>
                </tr>
              ) : null}
              {inventoryTopSpacer > 0 ? (
                <tr
                  className="investor-stock-spacer"
                  aria-hidden="true"
                  style={
                    {
                      "--investor-stock-spacer-height": `${inventoryTopSpacer}px`,
                    } as CSSProperties
                  }
                >
                  <td colSpan={7} />
                </tr>
              ) : null}
              {visibleInventory.map((item, visibleIndex) => (
                <tr
                  key={item.id}
                  aria-rowindex={inventoryWindowStart + visibleIndex + 2}
                  data-inventory-unit-id={item.id}
                >
                  <td className="investor-stock-start-cell" data-label="Início">
                    <Link
                      className="investor-stock-unit-button tabelao-stock-unit-link"
                      href="/app/simulacao/tabela-direta"
                      prefetch={false}
                      aria-label="Abrir a página Tabela Direta"
                    >
                      <span aria-hidden="true">›</span>
                    </Link>
                  </td>
                  <td data-label="Incorporadora" title={item.businessUnit}>
                    {item.businessUnit}
                  </td>
                  <td className="investor-stock-product" data-label="Produto" title={item.product}>
                    <span className="investor-stock-product-text">{item.product}</span>
                  </td>
                  <td data-label="Metragem">
                    {item.privateArea != null ? `${decimal.format(item.privateArea)} m²` : "—"}
                  </td>
                  <td data-label="Data de Entrega">{formatDate(item.completionDate)}</td>
                  <td
                    className="investor-stock-plant"
                    data-label="Planta"
                    title={informationLabel(item.plant)}
                  >
                    {informationLabel(item.plant)}
                  </td>
                  <td className="investor-stock-price" data-label="Valor do imóvel">
                    {item.finalPrice ? money.format(item.finalPrice) : "Não informado"}
                  </td>
                </tr>
              ))}
              {inventoryBottomSpacer > 0 ? (
                <tr
                  className="investor-stock-spacer"
                  aria-hidden="true"
                  style={
                    {
                      "--investor-stock-spacer-height": `${inventoryBottomSpacer}px`,
                    } as CSSProperties
                  }
                >
                  <td colSpan={7} />
                </tr>
              ) : null}
              {loadState === "ready" && matchingInventory.length === 0 ? (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Nenhuma unidade encontrada com esses filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
