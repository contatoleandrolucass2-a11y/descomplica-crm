"use client";

import { useRef, useState } from "react";
import type { HousingResult } from "@/lib/crm/simulators/caixa";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CaixaInstallments({ result }: { result: Extract<HousingResult, { ok: true }> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  return (
    <>
      <button
        type="button"
        className="caixa-result-print"
        onClick={() => {
          setOpened(true);
          dialog.current?.showModal();
        }}
      >
        Exibir parcelas
      </button>
      <dialog
        ref={dialog}
        className="caixa-installments-dialog"
        aria-labelledby="caixa-installments-title"
        onClose={() => setOpened(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <header>
          <h2 id="caixa-installments-title">Parcelas · {result.term} meses</h2>
          <button type="button" autoFocus onClick={() => dialog.current?.close()}>
            Fechar
          </button>
        </header>
        <p>
          Projeção com taxa e seguros constantes, sem atualização futura pela TR. Valores
          indicativos.
        </p>
        <div
          className="caixa-installments-scroll"
          tabIndex={0}
          role="region"
          aria-label="Parcelas mensais"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Prestação</th>
                <th scope="col">Juros</th>
                <th scope="col">Amortização</th>
                <th scope="col">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              {opened &&
                installments(result).map((row) => (
                  <tr key={row.month}>
                    <th scope="row">{row.month}</th>
                    <td>{currency.format(row.payment)}</td>
                    <td>{currency.format(row.interest)}</td>
                    <td>{currency.format(row.amortization)}</td>
                    <td>{currency.format(row.balance)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}

export function installments(result: Extract<HousingResult, { ok: true }>) {
  const monthlyRate = result.rate / 1200;
  const base =
    monthlyRate === 0
      ? result.financing / result.term
      : (result.financing * monthlyRate) / -Math.expm1(-result.term * Math.log1p(monthlyRate));
  let balance = result.financing;
  return Array.from({ length: result.term }, (_, index) => {
    const interest = balance * monthlyRate;
    const amortization =
      index === result.term - 1
        ? balance
        : Math.min(
            balance,
            result.system === "sac" ? result.financing / result.term : base - interest,
          );
    balance = Math.max(0, balance - amortization);
    return {
      month: index + 1,
      interest,
      amortization,
      balance,
      payment: interest + amortization + result.insurance + result.operatingFee,
    };
  });
}
