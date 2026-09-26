"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoFacets,
  groupTabelaoInventoryByProject,
  matchesTabelaoFacets,
  TABELAO_FILTER_DEFAULTS,
  type TabelaoFacetFilters,
  type TabelaoFilterDimension,
  sortTabelaoInventory,
  summarizeTabelao,
} from "@/lib/archive-investor/tabelao-inventory.mjs";
import { TabelaoFilters } from "./TabelaoFilters";

type InventoryItem = {
  id: string;
  businessUnit: string;
  project: string;
  product: string;
  identifier: string | null;
  plant: string | null;
  finalPrice: number | null;
  finalWithKit: number | null;
  unitBonus: number | null;
  tableSlack: number | null;
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

const TABELAO_TOUR_STEPS = [
  {
    target: "welcome",
    eyebrow: "Visão geral",
    title: "Consulte todas as tipologias",
    description:
      "Cada empreendimento apresenta uma unidade por planta, escolhida pelo menor valor: Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela). Metragens diferentes da mesma planta não criam opções repetidas. Todas as plantas com dados válidos permanecem disponíveis.",
    tip: "Avançar no guia não altera a lista nem abre outra página.",
    checklist: ["Consulte o estoque", "Compare as unidades", "Confira as quantidades"],
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
    target: "inventory",
    eyebrow: "Consulte as unidades",
    title: "Confira a unidade correta",
    description:
      "Revise empreendimento, metragem, entrega, planta e valor. A primeira coluna informa a quantidade de unidades disponíveis no estoque de cada empreendimento e planta. Incorporadora e empreendimento aparecem uma única vez por grupo.",
    tip: "Confirme os dados antes de iniciar a proposta.",
    checklist: [
      "Confira empreendimento e planta",
      "Revise entrega e valor",
      "Confira as unidades disponíveis",
    ],
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
  const parsed = value ? new Date(`${value}T12:00:00.000Z`) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? date.format(parsed) : "Não informada";
}

function informationLabel(value?: string | null) {
  return value?.trim() || "Não informado";
}

export function TabelaoClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryMeta, setInventoryMeta] = useState<InventoryPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadKey, setLoadKey] = useState(0);
  const [filters, setFilters] = useState<TabelaoFacetFilters>(TABELAO_FILTER_DEFAULTS);
  const [priceOrder, setPriceOrder] = useState<"asc" | "desc">("asc");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourSpotlight, setTourSpotlight] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const [tourPlacement, setTourPlacement] = useState({ top: false, left: false });
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
        setLoadState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [loadKey]);

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

  const exclusiveInventory = useMemo(() => buildTabelaoExclusiveInventory(inventory), [inventory]);
  const facets = useMemo(
    () => buildTabelaoFacets(exclusiveInventory, filters),
    [exclusiveInventory, filters],
  );
  const matchingInventory = useMemo(
    () =>
      sortTabelaoInventory(
        exclusiveInventory.filter((item) => matchesTabelaoFacets(item, filters)),
        priceOrder === "desc" ? "project-desc" : "project",
      ),
    [exclusiveInventory, filters, priceOrder],
  );
  const inventorySummary = useMemo(() => summarizeTabelao(matchingInventory), [matchingInventory]);
  const inventoryGroups = useMemo(
    () => groupTabelaoInventoryByProject(matchingInventory),
    [matchingInventory],
  );
  const excludedUnits =
    inventory.length - exclusiveInventory.reduce((total, item) => total + item.pricedUnits, 0);
  const sourceUpdatedAt = inventoryMeta?.generatedAt ? new Date(inventoryMeta.generatedAt) : null;

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
    clearFilters();
    setInventory([]);
    setInventoryMeta(null);
    setLoadState("loading");
    setLoadKey((value) => value + 1);
  }

  function changeFilter(dimension: TabelaoFilterDimension, value: string) {
    setFilters((current) => ({ ...current, [dimension]: value }));
  }

  function clearFilters() {
    setFilters(TABELAO_FILTER_DEFAULTS);
    setPriceOrder("asc");
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
            <h2 id="tabelao-stock-title">Menor valor por tipologia</h2>
          </div>
          <div className="investor-stock-sync" role="status" aria-live="polite" aria-atomic="true">
            <small>
              {loadState === "ready"
                ? `${matchingInventory.length.toLocaleString("pt-BR")} ${matchingInventory.length === 1 ? "opção exclusiva" : "opções exclusivas"} · ${inventorySummary.projects.toLocaleString("pt-BR")} ${inventorySummary.projects === 1 ? "empreendimento" : "empreendimentos"}`
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
            ) : sourceUpdatedAt && Number.isFinite(sourceUpdatedAt.getTime()) ? (
              <small>Atualizado {dateTime.format(sourceUpdatedAt)}</small>
            ) : loadState === "ready" ? (
              <small>
                Fonte viva {inventoryMeta?.source || "estoque protegido"} · atualização não
                informada
              </small>
            ) : null}
          </div>
        </header>

        <TabelaoFilters
          filters={filters}
          facets={facets}
          order={priceOrder}
          disabled={loadState !== "ready"}
          onChange={changeFilter}
          onClear={clearFilters}
          onOrderChange={setPriceOrder}
        />

        {loadState === "ready" && excludedUnits > 0 ? (
          <p className="investor-stock-summary" role="status">
            {excludedUnits.toLocaleString("pt-BR")} unidades com dados incompletos ou inválidos não
            participam da comparação. Menores valores entre as unidades com dados válidos.
          </p>
        ) : null}

        <p className="investor-stock-summary sr-only" aria-live="polite">
          {loadState === "ready"
            ? matchingInventory.length > 0
              ? `${matchingInventory.length.toLocaleString("pt-BR")} ${matchingInventory.length === 1 ? "opção exclusiva agrupada" : "opções exclusivas agrupadas"} por empreendimento, em ordem alfabética, com valores ${priceOrder === "desc" ? "decrescentes" : "crescentes"} dentro de cada empreendimento.`
              : exclusiveInventory.length > 0
                ? "Nenhuma opção encontrada com esses filtros."
                : "Nenhuma unidade com dados válidos para comparar."
            : loadState === "loading"
              ? "Carregando estoque…"
              : "Estoque indisponível"}
        </p>

        <div
          className="investor-stock-results"
          role="region"
          aria-label="Menores valores por empreendimento e planta"
          tabIndex={0}
          data-tour="inventory"
        >
          <table className="investor-stock-table" aria-rowcount={matchingInventory.length + 1}>
            <caption className="sr-only">
              Todas as plantas por empreendimento. Menor valor = Valor Final Com Kit − (B.A. da
              Unidade + Folga de Tabela). Unidades: quantidade disponível no estoque por
              incorporadora, empreendimento e planta, independentemente dos filtros.
            </caption>
            <colgroup>
              <col className="tabelao-stock-col-quantity" />
              <col className="investor-stock-col-business" />
              <col className="investor-stock-col-product" />
              <col className="investor-stock-col-area" />
              <col className="investor-stock-col-date" />
              <col className="investor-stock-col-plant" />
              <col className="investor-stock-col-price" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" id="tabelao-quantity">
                  Unidades
                </th>
                <th scope="col" id="tabelao-business">
                  Incorporadora
                </th>
                <th scope="col" id="tabelao-project">
                  Empreendimento
                </th>
                <th scope="col" id="tabelao-area">
                  Metragem
                </th>
                <th scope="col" id="tabelao-delivery">
                  Data de Entrega
                </th>
                <th scope="col" id="tabelao-plant">
                  Planta
                </th>
                <th scope="col" id="tabelao-price">
                  Menor valor
                </th>
              </tr>
            </thead>
            {matchingInventory.length === 0 ? (
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
                {loadState === "ready" ? (
                  <tr>
                    <td className="investor-empty-result" colSpan={7}>
                      {exclusiveInventory.length > 0
                        ? "Nenhuma opção encontrada com esses filtros."
                        : "Nenhuma unidade com dados válidos para comparar."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            ) : null}
            {inventoryGroups.map((group, groupIndex) => (
              <tbody key={group.key} className="tabelao-project-group">
                {group.items.map((item, itemIndex) => {
                  const groupHeaders = `tabelao-business-${groupIndex} tabelao-project-${groupIndex}`;
                  return (
                    <tr
                      key={item.id}
                      aria-rowindex={group.startIndex + itemIndex + 2}
                      data-inventory-unit-id={item.id}
                      data-inventory-project={item.project}
                      data-inventory-business-unit={item.businessUnit}
                    >
                      <td
                        className="tabelao-stock-quantity"
                        data-label="Unidades"
                        headers={`tabelao-quantity ${groupHeaders}`}
                        title={`${item.availableUnits.toLocaleString("pt-BR")} unidades disponíveis no estoque · ${item.project} · ${item.plant}`}
                      >
                        {item.availableUnits.toLocaleString("pt-BR")}
                      </td>
                      {itemIndex === 0 ? (
                        <>
                          <th
                            scope="rowgroup"
                            rowSpan={group.items.length}
                            id={`tabelao-business-${groupIndex}`}
                            headers="tabelao-business"
                            className="tabelao-group-cell"
                            data-label="Incorporadora"
                          >
                            {group.businessUnit}
                          </th>
                          <th
                            scope="rowgroup"
                            rowSpan={group.items.length}
                            id={`tabelao-project-${groupIndex}`}
                            headers="tabelao-project"
                            className="tabelao-group-cell investor-stock-product"
                            data-label="Empreendimento"
                          >
                            <span className="investor-stock-product-text">{group.project}</span>
                          </th>
                        </>
                      ) : null}
                      <td data-label="Metragem" headers={`tabelao-area ${groupHeaders}`}>
                        {typeof item.privateArea === "number" &&
                        Number.isFinite(item.privateArea) &&
                        item.privateArea > 0
                          ? `${decimal.format(item.privateArea)} m²`
                          : "—"}
                      </td>
                      <td data-label="Data de Entrega" headers={`tabelao-delivery ${groupHeaders}`}>
                        {formatDate(item.completionDate)}
                      </td>
                      <td
                        className="investor-stock-plant"
                        data-label="Planta"
                        headers={`tabelao-plant ${groupHeaders}`}
                        title={informationLabel(item.plant)}
                      >
                        {informationLabel(item.plant)}
                      </td>
                      <td
                        className="investor-stock-price"
                        data-label="Menor valor"
                        headers={`tabelao-price ${groupHeaders}`}
                        title={`Valor Final Com Kit ${money.format(item.finalWithKit!)} − (B.A. da Unidade ${money.format(item.unitBonus!)} + Folga de Tabela ${money.format(item.tableSlack!)}) = ${money.format(item.minimumPrice)}`}
                      >
                        {money.format(item.minimumPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
