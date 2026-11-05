"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { loadInvestorInventory } from "@/lib/archive-investor/load-inventory";
import {
  CAIXA_UNIT_RANKINGS,
  assessCaixaAvailableUnit,
  caixaUnitEntry,
  type CaixaUnit,
  type CaixaAvailableUnit,
} from "@/lib/crm/simulators/caixa-available-units";
import type { HousingInput, HousingResult } from "@/lib/crm/simulators/caixa";
import styles from "./CaixaAvailableUnits.module.css";
import { CaixaUnitProposal } from "./CaixaUnitProposal";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
type Evaluation = {
  key: string;
  phase: "loading" | "ready" | "error";
  items: CaixaAvailableUnit[];
  checked: number;
  total: number;
  unavailable: number;
  generatedAt?: string;
};
type Inventory = { count: number; items: CaixaUnit[]; generatedAt?: string };
const initialFilters = {
  businessUnit: "",
  project: "",
  region: "",
  plant: "",
  price: "",
  query: "",
  order: "asc",
};
const EMPTY_UNITS: CaixaAvailableUnit[] = [];

export function CaixaAvailableUnits({
  input,
  result,
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  input: HousingInput;
  result: Extract<HousingResult, { ok: true }>;
}) {
  const [ranking, setRanking] = useState("");
  const [firstProperty, setFirstProperty] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState("");
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    setEvaluation(null);
    setSelectedId("");
  }

  const title = useId();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const firstPropertyReady = input.product === "sbpe" || firstProperty !== "";
  // The key prevents a previous profile or ranking from ever appearing while its replacement computes.
  const key = JSON.stringify({
    input,
    capacity: result.maximumFinancingByIncome,
    ranking,
    firstProperty,
    today,
    attempt,
  });
  const current = evaluation?.key === key ? evaluation : null;

  useEffect(() => {
    if (
      !open ||
      !input.officialQuickEstimate ||
      !ranking ||
      !firstPropertyReady ||
      ranking === "not-eligible" ||
      (input.product !== "sbpe" && firstProperty === "no")
    )
      return;
    const controller = new AbortController();
    const snapshot = JSON.parse(key) as { input: HousingInput; capacity: number };
    const scenario = snapshot.input;
    const capacity = { maximumFinancingByIncome: snapshot.capacity };
    const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    void (async () => {
      await pause();
      if (controller.signal.aborted) return;
      setEvaluation({ key, phase: "loading", items: [], checked: 0, total: 0, unavailable: 0 });
      try {
        await loadInvestorInventory<Inventory>({
          snapshotOnly: false,
          liveRequired: true,
          signal: controller.signal,
          canReplace: () => !controller.signal.aborted,
          onInventory: (payload) => {
            void (async () => {
              const approved: CaixaAvailableUnit[] = [];
              let unavailable = 0;
              try {
                for (let index = 0; index < payload.items.length; index++) {
                  if (controller.signal.aborted) return;
                  const unit = payload.items[index];
                  if (!unit) continue;
                  const assessment = assessCaixaAvailableUnit(
                    unit,
                    scenario,
                    capacity,
                    ranking,
                    today,
                    firstProperty !== "no",
                  );
                  if (assessment.status === "approved") approved.push(assessment.value);
                  else if (assessment.status === "unavailable") unavailable++;
                  if ((index + 1) % 25 === 0) {
                    setEvaluation({
                      key,
                      phase: "loading",
                      items: [],
                      checked: index + 1,
                      total: payload.items.length,
                      unavailable,
                    });
                    await pause();
                  }
                }
                if (controller.signal.aborted) return;
                setEvaluation({
                  key,
                  phase: "ready",
                  items: approved,
                  checked: payload.items.length,
                  total: payload.items.length,
                  unavailable,
                  ...(payload.generatedAt ? { generatedAt: payload.generatedAt } : {}),
                });
              } catch {
                if (!controller.signal.aborted)
                  setEvaluation({
                    key,
                    phase: "error",
                    items: [],
                    checked: 0,
                    total: 0,
                    unavailable: 0,
                  });
              }
            })();
          },
        });
      } catch {
        if (!controller.signal.aborted)
          setEvaluation({ key, phase: "error", items: [], checked: 0, total: 0, unavailable: 0 });
      }
    })();
    return () => controller.abort();
  }, [
    open,
    key,
    ranking,
    firstPropertyReady,
    firstProperty,
    today,
    input.product,
    input.officialQuickEstimate,
  ]);

  const items = current?.phase === "ready" ? current.items : EMPTY_UNITS;
  const visible = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (!filters.businessUnit || item.unit.businessUnit === filters.businessUnit) &&
            (!filters.project || item.unit.project === filters.project) &&
            (!filters.region || item.region === filters.region) &&
            (!filters.plant || item.unit.plant === filters.plant) &&
            (!filters.price || String(item.price) === filters.price) &&
            (!filters.query ||
              normalize(
                `${item.unit.product} ${item.unit.identifier ?? ""} ${item.unit.project}`,
              ).includes(normalize(filters.query))),
        )
        .sort(
          (a, b) =>
            (filters.order === "desc" ? -1 : 1) * (a.price - b.price) ||
            a.unit.product.localeCompare(b.unit.product, "pt-BR"),
        ),
    [items, filters],
  );
  const selectedPreview = items.find((item) => item.unit.id === selectedId);
  const selected = useMemo(() => {
    if (!selectedPreview) return null;
    const assessed = assessCaixaAvailableUnit(
      selectedPreview.unit,
      input,
      result,
      ranking,
      today,
      firstProperty !== "no",
      { includeDetails: true },
    );
    return assessed.status === "approved" ? assessed.value : null;
  }, [selectedPreview, input, result, ranking, today, firstProperty]);
  type Facet = "businessUnit" | "project" | "plant" | "region" | "price";
  const facetValue = (item: CaixaAvailableUnit, field: Facet) =>
    field === "region"
      ? item.region
      : field === "price"
        ? String(item.price)
        : (item.unit[field] ?? "");
  const facetItems = (field: Facet) =>
    items.filter(
      (item) =>
        (["businessUnit", "project", "plant", "region", "price"] as const).every(
          (other) =>
            other === field || !filters[other] || facetValue(item, other) === filters[other],
        ) &&
        (!filters.query ||
          normalize(
            `${item.unit.product} ${item.unit.identifier ?? ""} ${item.unit.project}`,
          ).includes(normalize(filters.query))),
    );
  const optionValues = (field: Facet) =>
    [
      ...new Set(
        facetItems(field)
          .map((item) => facetValue(item, field))
          .filter(Boolean),
      ),
    ].sort((a, b) => (field === "price" ? Number(a) - Number(b) : a.localeCompare(b, "pt-BR")));
  const selectUnit = (id: string) => setSelectedId((previous) => (previous === id ? "" : id));

  if (!open) return null;
  return (
    <section
      id="caixa-available-units"
      className={styles.workspace}
      aria-label="Unidades disponíveis"
    >
      <header className={styles.profileHeader}>
        <div>
          <p>Unidades disponíveis</p>
          <h2 id={title}>Seu perfil aplicado ao estoque</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setEvaluation(null);
            onClose();
          }}
        >
          Ocultar unidades
        </button>
      </header>
      <div className={styles.body}>
        <div className={styles.profile}>
          <label>
            Ranking do cliente
            <select
              aria-label="Ranking do cliente"
              value={ranking}
              onChange={(event) => {
                setRanking(event.target.value);
                setSelectedId("");
              }}
            >
              <option value="">Selecione…</option>
              {CAIXA_UNIT_RANKINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {
            <label>
              Primeiro imóvel?
              <select
                aria-label="Primeiro imóvel?"
                value={firstProperty}
                onChange={(event) => setFirstProperty(event.target.value)}
              >
                <option value="">Selecione…</option>
                <option value="yes">Sim</option>
                <option value="no">Não</option>
              </select>
            </label>
          }
          <p>
            Renda <strong>{money.format(input.income)}</strong> · Entrada{" "}
            <strong>{money.format(caixaUnitEntry(input.ownFunds))}</strong> · 84 mensais e anuais
            válidas automáticas.
          </p>
        </div>
        {!input.officialQuickEstimate ? (
          <p role="status">
            A comparação de unidades precisa de seguros específicos de cada imóvel ou da estimativa
            com seguros de referência. Os seguros da proposta atual não são transferidos para outras
            unidades.
          </p>
        ) : !ranking || !firstPropertyReady ? (
          <p role="status">
            Informe o ranking{input.product !== "sbpe" ? " e se é o primeiro imóvel" : ""} para
            conferir as unidades.
          </p>
        ) : ranking === "not-eligible" ? (
          <p role="status">Nenhuma unidade elegível para esta classificação.</p>
        ) : input.product !== "sbpe" && firstProperty === "no" ? (
          <p role="status">
            Confirme o enquadramento do cliente na CAIXA antes de buscar unidades MCMV.
          </p>
        ) : !current || current.phase === "loading" ? (
          <p role="status">
            Conferindo unidades
            {current?.total ? `: ${current.checked} de ${current.total}` : " no estoque atualizado"}
            …
          </p>
        ) : current.phase === "error" ? (
          <div role="alert">
            <p>
              Não foi possível conferir o estoque atualizado. Nenhuma disponibilidade anterior foi
              utilizada.
            </p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <section className={styles.stock} aria-label="Estoque SPC">
              <div className={styles.stockHeader}>
                <span className={styles.step}>01</span>
                <div className={styles.stockTitle}>
                  <strong>ESTOQUE SPC</strong>
                  <h3>Escolha a unidade</h3>
                </div>
                <div className={styles.sync} role="status">
                  <strong>
                    {visible.length.toLocaleString("pt-BR")} unidade
                    {visible.length === 1 ? "" : "s"} dentro do ranking
                  </strong>
                  {current.generatedAt && (
                    <small>
                      Atualizado{" "}
                      {new Date(current.generatedAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </small>
                  )}
                </div>
                <label className={styles.search}>
                  Buscar unidade
                  <input
                    aria-label="Buscar unidade"
                    value={filters.query}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, query: event.target.value }))
                    }
                    placeholder="Código ou nome"
                  />
                </label>
                <button type="button" onClick={() => setFilters(initialFilters)}>
                  Limpar filtros
                </button>
              </div>
              <div className={styles.filters}>
                {(
                  [
                    ["businessUnit", "Incorporadora"],
                    ["project", "Nome do Empreendimento"],
                    ["region", "Região"],
                    ["plant", "Planta"],
                    ["price", "Valor do imóvel"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <select
                      aria-label={label}
                      value={filters[field]}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, [field]: event.target.value }))
                      }
                    >
                      <option value="">
                        {field === "businessUnit" || field === "region" || field === "plant"
                          ? "Todas"
                          : "Todos"}{" "}
                        ({facetItems(field).length.toLocaleString("pt-BR")})
                      </option>
                      {optionValues(field).map((value) => (
                        <option key={value} value={value}>
                          {field === "price" ? money.format(Number(value)) : value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  Ordenar valor
                  <select
                    value={filters.order}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, order: event.target.value }))
                    }
                  >
                    <option value="asc">Menor para maior</option>
                    <option value="desc">Maior para menor</option>
                  </select>
                </label>
              </div>
              {visible.length ? (
                <div className={styles.tableScroll}>
                  <table>
                    <caption className={styles.srOnly}>
                      Unidades aprovadas em pelo menos um fluxo: Linear ou Decrescente
                    </caption>
                    <thead>
                      <tr>
                        <th>Início</th>
                        <th>Incorporadora</th>
                        <th>Produto</th>
                        <th>Vaga</th>
                        <th>Metragem</th>
                        <th>
                          Data de término
                          <br />
                          da obra
                        </th>
                        <th>Planta</th>
                        <th>Valor do imóvel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item) => (
                        <tr
                          key={item.unit.id}
                          className={`${styles.selectableRow} ${selectedId === item.unit.id ? styles.selectedRow : ""}`}
                          tabIndex={0}
                          aria-selected={selectedId === item.unit.id}
                          onClick={() => selectUnit(item.unit.id)}
                          onKeyDown={(event) => {
                            if (
                              event.target === event.currentTarget &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              selectUnit(item.unit.id);
                            }
                          }}
                        >
                          <td>
                            <button
                              type="button"
                              aria-label={`Exibir fluxo de ${item.unit.product}`}
                              aria-expanded={selectedId === item.unit.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                selectUnit(item.unit.id);
                              }}
                            >
                              ›
                            </button>
                          </td>
                          <td>{item.unit.businessUnit}</td>
                          <td>{item.unit.product}</td>
                          <td>{item.unit.parkingSpaces ?? "—"}</td>
                          <td>{item.unit.privateArea?.toLocaleString("pt-BR")} m²</td>
                          <td>{item.unit.completionDate?.split("-").reverse().join("/")}</td>
                          <td>{item.unit.plant || "—"}</td>
                          <td>{money.format(item.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p role="status">
                  Nenhuma unidade atende a este perfil e aos filtros selecionados.
                </p>
              )}
            </section>
            {selected && (
              <CaixaUnitProposal
                key={`${key}-${selected.unit.id}`}
                selected={selected}
                input={input}
                capacity={result.maximumFinancingByIncome}
                ranking={ranking}
                firstProperty={firstProperty}
                baseDate={today}
              />
            )}
            <p className={styles.note}>
              Aprovação comercial simulada, sujeita à análise bancária. Financiamento e subsídio são
              recalculados por unidade.{" "}
              {(input.confirmedPublicContribution ?? 0) > 0 &&
                "O aporte confirmado do imóvel anterior não foi transferido. "}
              {current.unavailable > 0 &&
                `${current.unavailable} unidades sem dados suficientes não foram exibidas.`}
              {current.generatedAt &&
                ` Estoque de ${new Date(current.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
