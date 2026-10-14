"use client";

import { useState } from "react";
import { Info, Megaphone, RotateCcw, Trophy } from "lucide-react";

import { SimulationCanvasHeader } from "@/app/(protected)/app/simulacao/_components/SimulationCanvasHeader";
import {
  calculateMarketingResources,
  MARKETING_CHAMPION_CONVERSIONS,
  MARKETING_DISTRIBUTION,
  parseMarketingMoney,
} from "@/lib/crm/marketing/resources";
import styles from "./MarketingResources.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMoney = (cents: number | null) =>
  cents === null ? "Não informado" : money.format(cents / 100);

function MoneyField({
  id,
  label,
  value,
  onChange,
  positive = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  positive?: boolean;
}) {
  const cents = parseMarketingMoney(value);
  const invalid = cents === null || (positive && cents === 0);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.moneyInput}>
        <span aria-hidden="true">R$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          maxLength={20}
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (cents !== null) onChange(decimal.format(cents / 100));
          }}
        />
      </div>
      {invalid ? (
        <p id={`${id}-error`} className={styles.error}>
          {positive
            ? "Informe um valor maior que zero."
            : "Informe um valor válido, a partir de zero."}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingResources() {
  const [fund, setFund] = useState("2.500,00");
  const [saleCost, setSaleCost] = useState("1.000,00");
  const fundCents = parseMarketingMoney(fund);
  const { allocations, expectedSales } = calculateMarketingResources(
    fundCents,
    parseMarketingMoney(saleCost),
  );

  return (
    <div className={`investor-page-shell ${styles.page}`}>
      <main className={`investor-main ${styles.main}`}>
        <SimulationCanvasHeader
          eyebrow="Configurações"
          title="Recurso MKT"
          description="Volta ao Caixa · Fundo de investimento de Marketing"
          statusLabel="Fundo de Marketing"
          actions={
            <button
              type="button"
              className={styles.reset}
              aria-label="Restaurar valores iniciais"
              title="Restaurar valores iniciais"
              onClick={() => {
                setFund("2.500,00");
                setSaleCost("1.000,00");
              }}
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          }
        />

        <section className={styles.budget} aria-labelledby="marketing-fund-title">
          <div className={styles.sectionHeading}>
            <Megaphone size={20} aria-hidden="true" />
            <h2 id="marketing-fund-title">Volta ao Caixa - Fundo de investimento de Marketing</h2>
          </div>
          <div className={styles.summary}>
            <MoneyField
              id="marketing-fund"
              label="Fundo de investimento de Marketing"
              value={fund}
              onChange={setFund}
            />
            <MoneyField
              id="marketing-sale-cost"
              label="Custo venda"
              value={saleCost}
              onChange={setSaleCost}
              positive
            />
            <div className={styles.expectation}>
              <div className={styles.expectationLabel}>
                <span>Expectativa de vendas</span>
                <span
                  role="img"
                  title="Vendas inteiras estimadas: fundo dividido pelo custo por venda, arredondado para baixo."
                  tabIndex={0}
                  aria-label="Expectativa calculada em vendas inteiras, arredondada para baixo."
                >
                  <Info size={16} aria-hidden="true" />
                </span>
              </div>
              <output aria-label="Expectativa de vendas" aria-live="polite">
                {expectedSales === null ? "Não informado" : decimal.format(expectedSales)}
              </output>
            </div>
          </div>
        </section>

        <section className={styles.distribution} aria-labelledby="marketing-distribution-title">
          <div className={styles.sectionHeading}>
            <h2 id="marketing-distribution-title">Distribuição dos recursos</h2>
            <span className={styles.totalShare}>100%</span>
          </div>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Distribuição do fundo de investimento de Marketing por responsável e destino do
              recurso
            </caption>
            <thead>
              <tr>
                <th scope="col">Responsável</th>
                <th scope="col">Percentual</th>
                <th scope="col">Distribuição dos recursos</th>
                <th scope="col">Destino do recurso</th>
              </tr>
            </thead>
            <tbody>
              {MARKETING_DISTRIBUTION.map((item, index) => (
                <tr key={item.role}>
                  <th scope="row">{item.role}</th>
                  <td data-label="Percentual">
                    <span className={styles.percent}>{item.percent}%</span>
                  </td>
                  <td data-label="Distribuição dos recursos" className={styles.amount}>
                    {formatMoney(allocations?.[index] ?? null)}
                  </td>
                  <td data-label="Destino do recurso" className={styles.destination}>
                    {item.role === "Diretor" ? (
                      <>
                        <strong className={styles.champion}>
                          <Trophy size={16} aria-hidden="true" />
                          {item.destination}
                        </strong>
                        <ul>
                          {MARKETING_CHAMPION_CONVERSIONS.map((conversion) => (
                            <li key={conversion}>{conversion}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      item.destination
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">TOTAL</th>
                <td data-label="Percentual">100%</td>
                <td data-label="Distribuição dos recursos" className={styles.amount}>
                  {formatMoney(fundCents)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
        <footer className={styles.footer}>
          <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
          <small>Desenvolvido e gerenciado por Leandro Lucas</small>
        </footer>
      </main>
    </div>
  );
}
