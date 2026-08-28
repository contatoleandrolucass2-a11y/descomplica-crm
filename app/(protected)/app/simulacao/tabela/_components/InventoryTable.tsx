"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AnalyticsTable,
  DataState,
  type AnalyticsColumn,
} from "@/app/(protected)/app/_components/analytics";
import type { InventoryItem } from "@/lib/crm/inventory/contract";

import styles from "../tabelao.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; items: InventoryItem[]; updatedAt: string };

type SortKey = "price-asc" | "price-desc" | "development-asc";
type PriceBand = "all" | "under-300" | "300-500" | "over-500";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function matchesPrice(priceCents: number, band: PriceBand): boolean {
  if (band === "under-300") return priceCents < 30_000_000;
  if (band === "300-500") return priceCents >= 30_000_000 && priceCents <= 50_000_000;
  if (band === "over-500") return priceCents > 50_000_000;
  return true;
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    ["businessUnit", "development", "floorPlan", "region", "updatedAt", "source"].every(
      (key) => typeof item[key] === "string",
    ) &&
    typeof item.priceCents === "number" &&
    Number.isSafeInteger(item.priceCents) &&
    item.priceCents >= 0
  );
}

export function InventoryTable() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [development, setDevelopment] = useState("");
  const [floorPlan, setFloorPlan] = useState("");
  const [region, setRegion] = useState("");
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [sort, setSort] = useState<SortKey>("price-asc");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/inventory", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (response.status === 503) {
          setState({
            status: "unavailable",
            message: "Estoque temporariamente indisponível",
          });
          return;
        }
        if (!response.ok || !payload || typeof payload !== "object") {
          throw new Error("inventory_request_failed");
        }
        const record = payload as Record<string, unknown>;
        if (!Array.isArray(record.items) || !record.items.every(isInventoryItem)) {
          throw new Error("inventory_payload_invalid");
        }
        setState({
          status: "ready",
          items: record.items,
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: "Não foi possível consultar o estoque." });
      });
    return () => controller.abort();
  }, []);

  const items = useMemo(() => (state.status === "ready" ? state.items : []), [state]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return items
      .filter(
        (item) =>
          (!normalizedQuery ||
            `${item.development} ${item.floorPlan}`
              .toLocaleLowerCase("pt-BR")
              .includes(normalizedQuery)) &&
          (!businessUnit || item.businessUnit === businessUnit) &&
          (!development || item.development === development) &&
          (!floorPlan || item.floorPlan === floorPlan) &&
          (!region || item.region === region) &&
          matchesPrice(item.priceCents, priceBand),
      )
      .sort((left, right) => {
        if (sort === "price-desc") return right.priceCents - left.priceCents;
        if (sort === "development-asc") {
          return (
            left.development.localeCompare(right.development, "pt-BR") ||
            left.floorPlan.localeCompare(right.floorPlan, "pt-BR")
          );
        }
        return left.priceCents - right.priceCents;
      });
  }, [businessUnit, development, floorPlan, items, priceBand, query, region, sort]);

  const columns: Array<AnalyticsColumn<InventoryItem>> = [
    { key: "development", label: "Empreendimento", render: (item) => item.development },
    { key: "floor-plan", label: "Planta", render: (item) => item.floorPlan },
    { key: "business-unit", label: "Negócio", render: (item) => item.businessUnit },
    { key: "region", label: "Região", render: (item) => item.region },
    {
      key: "price",
      label: "Menor valor de referência",
      align: "right",
      render: (item) => currency.format(item.priceCents / 100),
    },
    { key: "source", label: "Fonte", render: (item) => item.source },
    {
      key: "updated-at",
      label: "Atualização do registro",
      render: (item) => dateTime.format(new Date(item.updatedAt)),
    },
  ];

  if (state.status === "loading") {
    return (
      <DataState
        variant="warning"
        title="Carregando estoque"
        description="Consultando a fonte oficial sem usar cache do navegador."
      />
    );
  }
  if (state.status === "unavailable" || state.status === "error") {
    return (
      <DataState
        variant={state.status === "error" ? "error" : "unavailable"}
        title={state.message}
        description="Nenhuma disponibilidade, reserva ou condição comercial foi presumida."
      />
    );
  }

  return (
    <div className={styles.inventoryWorkspace}>
      <div className={styles.sourceStatus} role="status">
        <strong>Fonte oficial do estoque</strong>
        <span>
          {state.updatedAt
            ? `Registro mais antigo do conjunto: ${dateTime.format(new Date(state.updatedAt))}`
            : "Horário de atualização indisponível"}
        </span>
      </div>

      <form
        className={styles.filters}
        aria-label="Filtros do Tabelão"
        onSubmit={(e) => e.preventDefault()}
      >
        <label>
          <span>Busca rápida</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Empreendimento ou planta…"
          />
        </label>
        {[
          [
            "Negócio",
            businessUnit,
            setBusinessUnit,
            unique(items.map((item) => item.businessUnit)),
          ],
          [
            "Empreendimento",
            development,
            setDevelopment,
            unique(items.map((item) => item.development)),
          ],
          ["Planta", floorPlan, setFloorPlan, unique(items.map((item) => item.floorPlan))],
          ["Região", region, setRegion, unique(items.map((item) => item.region))],
        ].map(([label, value, setter, options]) => (
          <label key={String(label)}>
            <span>{String(label)}</span>
            <select
              value={String(value)}
              onChange={(event) => (setter as (value: string) => void)(event.target.value)}
            >
              <option value="">Todos</option>
              {(options as string[]).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          <span>Faixa de preço</span>
          <select
            value={priceBand}
            onChange={(event) => setPriceBand(event.target.value as PriceBand)}
          >
            <option value="all">Todas</option>
            <option value="under-300">Até R$ 300 mil</option>
            <option value="300-500">R$ 300 mil a R$ 500 mil</option>
            <option value="over-500">Acima de R$ 500 mil</option>
          </select>
        </label>
        <label>
          <span>Ordenar por</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="price-asc">Menor valor</option>
            <option value="price-desc">Maior valor</option>
            <option value="development-asc">Empreendimento</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setBusinessUnit("");
            setDevelopment("");
            setFloorPlan("");
            setRegion("");
            setPriceBand("all");
            setSort("price-asc");
          }}
        >
          Limpar filtros
        </button>
      </form>

      {filtered.length > 0 ? (
        <AnalyticsTable
          caption="Empreendimentos, plantas e menores valores"
          rows={filtered}
          columns={columns}
          rowKey={(item) => `${item.development}\u0000${item.floorPlan}`}
        />
      ) : (
        <DataState
          variant="empty"
          title="Nenhuma combinação encontrada"
          description="Revise ou limpe os filtros. Nenhuma unidade foi ocultada como disponível."
        />
      )}
    </div>
  );
}
