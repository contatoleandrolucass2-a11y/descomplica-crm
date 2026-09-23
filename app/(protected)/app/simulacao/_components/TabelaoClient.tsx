"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

// @ts-expect-error — módulo de filtros preservado da Tabela Direta em JavaScript.
import { sortInvestorInventoryBySalePrice } from "@/lib/archive-investor/investor-filter-options.mjs";

type InventoryItem = {
  id: string;
  businessUnit: string;
  product: string;
  identifier: string | null;
  plant: string | null;
  finalPrice: number | null;
  privateArea: number | null;
  completionDate: string | null;
};

type InventoryPayload = {
  count: number;
  items: InventoryItem[];
};

type LoadState = "loading" | "ready" | "error";

const INVENTORY_WINDOW_SIZE = 60;
const DESKTOP_ROW_HEIGHT = 24;
const MOBILE_ROW_HEIGHT = 44;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

function formatDate(value?: string | null) {
  return value ? date.format(new Date(`${value}T12:00:00.000Z`)) : "Não informada";
}

function informationLabel(value?: string | null) {
  return value?.trim() || "Não informado";
}

export function TabelaoClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadKey, setLoadKey] = useState(0);
  const [inventoryWindowStart, setInventoryWindowStart] = useState(0);
  const [inventoryRowHeight, setInventoryRowHeight] = useState(DESKTOP_ROW_HEIGHT);
  const inventoryResultsRef = useRef<HTMLDivElement>(null);

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
    const media = window.matchMedia("(max-width: 620px)");
    const updateRowHeight = () => {
      setInventoryRowHeight(media.matches ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT);
      setInventoryWindowStart(0);
      if (inventoryResultsRef.current) inventoryResultsRef.current.scrollTop = 0;
    };
    updateRowHeight();
    media.addEventListener("change", updateRowHeight);
    return () => media.removeEventListener("change", updateRowHeight);
  }, []);

  const sortedInventory = useMemo(
    () => sortInvestorInventoryBySalePrice(inventory, "asc") as InventoryItem[],
    [inventory],
  );
  const visibleInventory = useMemo(
    () =>
      sortedInventory.slice(
        inventoryWindowStart,
        Math.min(sortedInventory.length, inventoryWindowStart + INVENTORY_WINDOW_SIZE),
      ),
    [inventoryWindowStart, sortedInventory],
  );
  const inventoryWindowEnd = inventoryWindowStart + visibleInventory.length;
  const inventoryTopSpacer = inventoryWindowStart * inventoryRowHeight;
  const inventoryBottomSpacer = (sortedInventory.length - inventoryWindowEnd) * inventoryRowHeight;

  function reloadInventory() {
    setInventory([]);
    setInventoryWindowStart(0);
    setLoadState("loading");
    setLoadKey((value) => value + 1);
  }

  function updateInventoryWindow(scrollTop: number) {
    const overscan = 10;
    const nextStart = Math.max(0, Math.floor(scrollTop / inventoryRowHeight) - overscan);
    const maximumStart = Math.max(0, sortedInventory.length - INVENTORY_WINDOW_SIZE);
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
    <section className="tabelao-workspace" aria-label="Estoque completo de unidades">
      <div
        ref={inventoryResultsRef}
        className="tabelao-stock-results"
        role="region"
        aria-label="Estoque completo de unidades"
        tabIndex={0}
        onScroll={(event) => updateInventoryWindow(event.currentTarget.scrollTop)}
      >
        <table className="tabelao-stock-table" aria-rowcount={sortedInventory.length + 1}>
          <caption className="sr-only">Unidades encontradas no estoque</caption>
          <colgroup>
            <col className="tabelao-stock-col-start" />
            <col className="tabelao-stock-col-business" />
            <col className="tabelao-stock-col-product" />
            <col className="tabelao-stock-col-area" />
            <col className="tabelao-stock-col-date" />
            <col className="tabelao-stock-col-plant" />
            <col className="tabelao-stock-col-price" />
          </colgroup>
          <thead>
            <tr>
              <th>Início</th>
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
                <td className="tabelao-stock-feedback" colSpan={7}>
                  Carregando unidades do estoque…
                </td>
              </tr>
            ) : null}
            {loadState === "error" ? (
              <tr>
                <td className="tabelao-stock-feedback" colSpan={7}>
                  <span>
                    Arquivo oficial do estoque indisponível. Nenhuma fonte alternativa foi usada.
                  </span>
                  <button type="button" onClick={reloadInventory}>
                    Tentar novamente
                  </button>
                </td>
              </tr>
            ) : null}
            {inventoryTopSpacer > 0 ? (
              <tr
                className="tabelao-stock-spacer"
                aria-hidden="true"
                style={
                  { "--tabelao-stock-spacer-height": `${inventoryTopSpacer}px` } as CSSProperties
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
                <td>
                  <Link
                    className="tabelao-stock-unit-link"
                    href="/app/simulacao/tabela-direta"
                    prefetch={false}
                    aria-label="Abrir Tabela Direta"
                  >
                    <span aria-hidden="true">›</span>
                  </Link>
                </td>
                <td title={item.businessUnit}>{item.businessUnit}</td>
                <td className="tabelao-stock-product" title={item.product}>
                  {item.product}
                </td>
                <td>{item.privateArea != null ? `${decimal.format(item.privateArea)} m²` : "—"}</td>
                <td>{formatDate(item.completionDate)}</td>
                <td className="tabelao-stock-plant" title={informationLabel(item.plant)}>
                  {informationLabel(item.plant)}
                </td>
                <td className="tabelao-stock-price">
                  {item.finalPrice ? money.format(item.finalPrice) : "Não informado"}
                </td>
              </tr>
            ))}
            {inventoryBottomSpacer > 0 ? (
              <tr
                className="tabelao-stock-spacer"
                aria-hidden="true"
                style={
                  { "--tabelao-stock-spacer-height": `${inventoryBottomSpacer}px` } as CSSProperties
                }
              >
                <td colSpan={7} />
              </tr>
            ) : null}
            {loadState === "ready" && sortedInventory.length === 0 ? (
              <tr>
                <td className="tabelao-stock-feedback" colSpan={7}>
                  Nenhuma unidade encontrada no estoque.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
