"use client";

import { useEffect, useState } from "react";

import {
  AnalyticsTable,
  DataState,
  type AnalyticsColumn,
} from "@/app/(protected)/app/_components/analytics";

import styles from "../discador.module.css";

type ForecastCategory = "visits" | "sales";
type ForecastRow = { label: string; forecast: string; realized: string };
type LoadState = "loading" | "ready" | "error";

const columns: Array<AnalyticsColumn<ForecastRow>> = [
  { key: "label", label: "Corretor e empreendimento", render: (row) => row.label },
  { key: "forecast", label: "Previsão", align: "right", render: (row) => row.forecast },
  { key: "realized", label: "Realizado", align: "right", render: (row) => row.realized },
];

function currentMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  now.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  return now.toISOString().slice(0, 10);
}

export function WeekendForecastWorkspace() {
  const [week, setWeek] = useState(currentMonday);
  const [category, setCategory] = useState<ForecastCategory>("visits");
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/weekend-forecast?week=${encodeURIComponent(week)}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          !payload ||
          typeof payload !== "object" ||
          !("writable" in payload) ||
          payload.writable !== false
        ) {
          throw new Error("invalid_forecast_contract");
        }
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [week]);

  const rows: ForecastRow[] = [
    {
      label: "Nenhum dado operacional carregado",
      forecast: "Indisponível",
      realized: "Indisponível",
    },
  ];

  return (
    <section className={styles.forecastSection} aria-labelledby="forecast-title">
      <div className={styles.forecastToolbar}>
        <label>
          <span>Semana de referência</span>
          <input
            type="date"
            value={week}
            onChange={(event) => {
              setState("loading");
              setWeek(event.currentTarget.value);
            }}
          />
          <small>Selecione uma segunda-feira.</small>
        </label>
        <div className={styles.forecastTabs} role="tablist" aria-label="Tipo de previsão">
          {[
            ["visits", "Visitas"],
            ["sales", "Vendas"],
          ].map(([key, label]) => (
            <button
              aria-selected={category === key}
              data-active={category === key || undefined}
              key={key}
              onClick={() => setCategory(key as ForecastCategory)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.summaryGrid} aria-label="Totais da semana">
        {["Previsão", "Realizado"].map((label) => (
          <article key={label}>
            <span>{`${category === "visits" ? "Visitas" : "Vendas"} · ${label}`}</span>
            <strong>Indisponível</strong>
          </article>
        ))}
      </div>

      {state === "loading" ? (
        <DataState
          variant="warning"
          compact
          title="Carregando previsão"
          description="Consultando somente o contrato sintético protegido."
        />
      ) : state === "error" ? (
        <DataState
          variant="error"
          compact
          title="Previsão temporariamente indisponível"
          description="Nenhum valor parcial foi tratado como válido."
        />
      ) : (
        <>
          <AnalyticsTable
            caption={`${category === "visits" ? "Visitas" : "Vendas"} — contrato sem dados operacionais`}
            rows={rows}
            columns={columns}
            rowKey={(row) => row.label}
          />
          <DataState
            variant="empty"
            compact
            title="Nenhum corretor ou empreendimento carregado"
            description="Dados reais, nomes e metas não foram copiados da referência."
          />
        </>
      )}
      <p className={styles.writeNotice}>Gravação indisponível nesta etapa.</p>
    </section>
  );
}
