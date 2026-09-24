"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  buildTabelaoExclusiveInventory,
  sortTabelaoInventory,
  summarizeTabelao,
} from "@/lib/archive-investor/tabelao-inventory.mjs";

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

const INVENTORY_WINDOW_SIZE = 60;
const DESKTOP_ROW_HEIGHT = 24;
const MOBILE_ROW_HEIGHT = 44;
const TABELAO_TOUR_STEPS = [
  {
    target: "welcome",
    eyebrow: "Visão geral",
    title: "Consulte todas as tipologias",
    description:
      "Cada empreendimento apresenta uma unidade por tipo de planta e metragem, escolhida pelo menor valor: Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela). Todas as combinações com dados válidos permanecem disponíveis.",
    tip: "Avançar no guia não altera a lista nem abre outra página.",
    checklist: ["Consulte o estoque", "Compare as unidades", "Abra a unidade correta"],
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
      "Revise produto, metragem, entrega, planta e valor. O botão circular da primeira coluna abre a página Tabela Direta para continuar o atendimento.",
    tip: "Confirme os dados antes de iniciar a proposta.",
    checklist: ["Confira produto e planta", "Revise entrega e valor", "Abra a Tabela Direta"],
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

  const matchingInventory = useMemo(
    () => sortTabelaoInventory(buildTabelaoExclusiveInventory(inventory)),
    [inventory],
  );
  const inventorySummary = useMemo(() => summarizeTabelao(matchingInventory), [matchingInventory]);
  const excludedUnits =
    inventory.length - matchingInventory.reduce((total, item) => total + item.availableUnits, 0);
  const sourceUpdatedAt = inventoryMeta?.generatedAt ? new Date(inventoryMeta.generatedAt) : null;
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
            <h2 id="tabelao-stock-title">Menor valor por tipologia</h2>
          </div>
          <div className="investor-stock-sync" role="status" aria-live="polite" aria-atomic="true">
            <small>
              {loadState === "ready"
                ? `${matchingInventory.length.toLocaleString("pt-BR")} opções exclusivas · ${inventorySummary.projects.toLocaleString("pt-BR")} empreendimentos`
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

        {loadState === "ready" && excludedUnits > 0 ? (
          <p className="investor-stock-summary" role="status">
            {excludedUnits.toLocaleString("pt-BR")} unidades com dados incompletos ou inválidos não
            participam da comparação. Menores valores entre as unidades com dados válidos.
          </p>
        ) : null}

        <p className="investor-stock-summary sr-only" aria-live="polite">
          {loadState === "ready"
            ? matchingInventory.length > 0
              ? `${matchingInventory.length.toLocaleString("pt-BR")} opções exclusivas por empreendimento, planta e metragem, em ordem de menor valor.`
              : "Nenhuma unidade com dados válidos para comparar."
            : loadState === "loading"
              ? "Carregando estoque…"
              : "Estoque indisponível"}
        </p>

        <div
          ref={inventoryResultsRef}
          className="investor-stock-results"
          role="region"
          aria-label="Menores valores por empreendimento, planta e metragem"
          tabIndex={0}
          data-tour="inventory"
          onScroll={(event) => updateInventoryWindow(event.currentTarget.scrollTop)}
        >
          <table className="investor-stock-table" aria-rowcount={matchingInventory.length + 1}>
            <caption className="sr-only">
              Todas as tipologias por empreendimento e metragem. Menor valor = Valor Final Com Kit −
              (B.A. da Unidade + Folga de Tabela).
            </caption>
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
                <th>Empreendimento / Unidade</th>
                <th>Metragem</th>
                <th>Data de Entrega</th>
                <th>Planta</th>
                <th>Menor valor</th>
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
                      aria-label={`Abrir a página Tabela Direta · ${item.product}`}
                    >
                      <span aria-hidden="true">›</span>
                    </Link>
                  </td>
                  <td data-label="Incorporadora" title={item.businessUnit}>
                    {item.businessUnit}
                  </td>
                  <td
                    className="investor-stock-product"
                    data-label="Empreendimento / Unidade"
                    title={item.product}
                  >
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
                  <td
                    className="investor-stock-price"
                    data-label="Menor valor"
                    title={`Valor Final Com Kit ${money.format(item.finalWithKit!)} − (B.A. da Unidade ${money.format(item.unitBonus!)} + Folga de Tabela ${money.format(item.tableSlack!)}) = ${money.format(item.minimumPrice)}`}
                  >
                    {money.format(item.minimumPrice)}
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
                    Nenhuma unidade com dados válidos para comparar.
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
