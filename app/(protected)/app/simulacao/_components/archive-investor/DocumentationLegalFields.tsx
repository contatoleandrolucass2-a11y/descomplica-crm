"use client";

import { useId, useState } from "react";
import type {
  DocumentationLegalContext,
  DocumentationResult,
} from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import styles from "./DocumentationLegalFields.module.css";

const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
type LegalChange = <K extends keyof DocumentationLegalContext>(
  field: K,
  value: DocumentationLegalContext[K],
) => void;

export function useDocumentationLegalContext({
  baseDate,
  salePrice,
  reviewKey,
  municipality = "",
}: {
  baseDate: string;
  salePrice: string | number;
  reviewKey: string;
  municipality?: DocumentationLegalContext["municipality"];
}) {
  const [overrides, setOverrides] = useState<Partial<DocumentationLegalContext>>({});
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const fields: DocumentationLegalContext = {
    municipality,
    financingContractDate: baseDate,
    transactionDate: baseDate,
    registrationDate: baseDate,
    registryTable: "",
    naturalPerson: "",
    residential: "",
    firstAcquisition: "",
    program: "",
    financingSystem: "",
    funding: "",
    firstTransfer: "",
    specialRegime: "",
    itbiBase: salePrice,
    iptuValue: "",
    ...overrides,
    basesConfirmed: false,
  };
  const reviewSignature = JSON.stringify([reviewKey, fields]);
  // A confirmation belongs only to the reviewed proposal and fiscal inputs.
  if (confirmedFor !== null && confirmedFor !== reviewSignature) setConfirmedFor(null);
  const legalContext = { ...fields, basesConfirmed: confirmedFor === reviewSignature };
  const onLegalChange: LegalChange = (field, value) => {
    if (field === "basesConfirmed") {
      setConfirmedFor(value ? reviewSignature : null);
      return;
    }
    setOverrides((current) => ({ ...current, [field]: value }));
    setConfirmedFor(null);
  };
  function resetLegalContext() {
    setOverrides({});
    setConfirmedFor(null);
  }
  return { legalContext, onLegalChange, resetLegalContext };
}

export function revealDocumentationLegalInvalidField(
  root: ParentNode,
  target?: HTMLInputElement | HTMLSelectElement,
) {
  const invalid =
    target ??
    root.querySelector<HTMLInputElement | HTMLSelectElement>(
      "[data-documentation-legal] :is(input, select):invalid",
    );
  const disclosure = invalid?.closest<HTMLDetailsElement>("details[data-documentation-legal]");
  if (!invalid || !disclosure) return false;
  disclosure.open = true;
  requestAnimationFrame(() => invalid.focus());
  return true;
}

export function DocumentationLegalFields({
  value,
  onChange,
}: {
  value: DocumentationLegalContext;
  onChange: LegalChange;
}) {
  const id = useId();
  const choices = [
    ["naturalPerson", "Pessoa física?"],
    ["residential", "Imóvel residencial?"],
    ["firstAcquisition", "Primeira aquisição imobiliária?"],
    ...(value.funding === "FGTS" ? [["firstTransfer", "Primeira transmissão?"]] : []),
  ] as ["naturalPerson" | "residential" | "firstAcquisition" | "firstTransfer", string][];

  return (
    <details
      className={styles.legalFields}
      data-documentation-legal
      onInvalidCapture={(event) => {
        event.preventDefault();
        revealDocumentationLegalInvalidField(
          event.currentTarget,
          event.target as HTMLInputElement | HTMLSelectElement,
        );
      }}
    >
      <summary className={styles.summary}>
        Dados fiscais da documentação
        <span className={styles.status} role="status">
          {value.basesConfirmed ? "Confirmado" : "Pendente"}
        </span>
      </summary>
      <section aria-label="Dados fiscais da documentação">
        <p className={styles.help} id={`${id}-help`}>
          O enquadramento fiscal depende dos documentos da compra. As respostas do perfil comercial
          não confirmam isenções ou descontos.
        </p>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span id={`${id}-municipality`}>Município do imóvel</span>
            <select
              required
              aria-labelledby={`${id}-municipality`}
              value={value.municipality}
              onChange={(event) =>
                onChange(
                  "municipality",
                  event.target.value as DocumentationLegalContext["municipality"],
                )
              }
            >
              <option value="">Selecione</option>
              <option value="sao-paulo-sp">São Paulo (capital)</option>
              <option value="other">Outro município</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Data do contrato de financiamento</span>
            <input
              type="date"
              required
              value={value.financingContractDate}
              aria-describedby={`${id}-dates`}
              onChange={(event) => onChange("financingContractDate", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Data da transmissão (ITBI)</span>
            <input
              type="date"
              required
              value={value.transactionDate}
              onChange={(event) => onChange("transactionDate", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Data do registro</span>
            <input
              type="date"
              required
              value={value.registrationDate}
              onChange={(event) => onChange("registrationDate", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span id={`${id}-registry-table-label`}>Tabela de registro conferida</span>
            <select
              required
              aria-labelledby={`${id}-registry-table-label`}
              aria-describedby={`${id}-registry-table-help`}
              value={value.registryTable}
              onChange={(event) =>
                onChange(
                  "registryTable",
                  event.target.value as DocumentationLegalContext["registryTable"],
                )
              }
            >
              <option value="">Selecione</option>
              <option value="ARISP_2">ARISP 2026 - ISS 2%</option>
              <option value="QUINTO_SP_2026">5º RI de São Paulo - 2026</option>
              <option value="OTHER">Outra tabela</option>
            </select>
          </label>
          {choices.map(([field, label]) => (
            <label className={styles.field} key={field}>
              <span id={`${id}-${field}`}>{label}</span>
              <select
                required
                aria-labelledby={`${id}-${field}`}
                value={value[field]}
                aria-describedby={field === "firstTransfer" ? `${id}-first-transfer` : undefined}
                onChange={(event) => onChange(field, event.target.value as "SIM" | "NAO" | "")}
              >
                <option value="">Selecione</option>
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </label>
          ))}
          <label className={styles.field}>
            <span id={`${id}-program`}>Programa habitacional</span>
            <select
              required
              aria-labelledby={`${id}-program`}
              value={value.program}
              onChange={(event) =>
                onChange("program", event.target.value as DocumentationLegalContext["program"])
              }
            >
              <option value="">Selecione</option>
              <option value="MCMV">Minha Casa, Minha Vida</option>
              <option value="MCMV_FAR_FDS">MCMV com FAR/FDS</option>
              <option value="NONE">Nenhum</option>
            </select>
          </label>
          <label className={styles.field}>
            <span id={`${id}-financing-system`}>Sistema de financiamento</span>
            <select
              required
              aria-labelledby={`${id}-financing-system`}
              value={value.financingSystem}
              onChange={(event) =>
                onChange(
                  "financingSystem",
                  event.target.value as DocumentationLegalContext["financingSystem"],
                )
              }
            >
              <option value="">Selecione</option>
              <option value="SFH">SFH</option>
              <option value="SFI">SFI</option>
              <option value="PAR">PAR</option>
              <option value="HIS">HIS</option>
              <option value="CONSORCIO">Consórcio</option>
            </select>
          </label>
          <label className={styles.field}>
            <span id={`${id}-funding-label`}>Origem dos recursos do financiamento</span>
            <select
              required
              aria-labelledby={`${id}-funding-label`}
              value={value.funding}
              aria-describedby={`${id}-funding`}
              onChange={(event) =>
                onChange("funding", event.target.value as DocumentationLegalContext["funding"])
              }
            >
              <option value="">Selecione</option>
              <option value="FGTS">FGTS</option>
              <option value="OTHER">Outros recursos</option>
            </select>
          </label>
          <label className={styles.field}>
            <span id={`${id}-special-label`}>Outros benefícios fiscais ou de registro?</span>
            <select
              required
              aria-labelledby={`${id}-special-label`}
              value={value.specialRegime}
              aria-describedby={`${id}-special`}
              onChange={(event) =>
                onChange(
                  "specialRegime",
                  event.target.value as DocumentationLegalContext["specialRegime"],
                )
              }
            >
              <option value="">Selecione</option>
              <option value="NONE">Nenhum informado</option>
              <option value="OTHER">Benefício especial</option>
            </select>
          </label>
          {(
            [
              ["itbiBase", "Base de cálculo do ITBI (R$)"],
              ["iptuValue", "Valor venal do IPTU (R$)"],
            ] as const
          ).map(([field, label]) => (
            <label className={styles.field} key={field}>
              <span>{label}</span>
              <input
                type="text"
                inputMode="decimal"
                required
                autoComplete="off"
                aria-describedby={`${id}-bases`}
                value={value[field] === "" ? "" : decimal.format(Number(value[field]))}
                placeholder={field === "iptuValue" ? "Informe o valor venal" : "Informe a base"}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 15);
                  onChange(field, digits ? (Number(digits) / 100).toFixed(2) : "");
                }}
              />
            </label>
          ))}
        </div>
        {value.funding === "FGTS" ? (
          <p className={styles.help} id={`${id}-first-transfer`}>
            Primeira transmissão significa a primeira venda desta unidade no empreendimento. É
            diferente da primeira aquisição imobiliária do comprador; confira o histórico da
            unidade.
          </p>
        ) : null}
        <p className={styles.help} id={`${id}-dates`}>
          A data do contrato define os limites e as taxas do financiamento. A data da transmissão
          corresponde ao fato gerador do ITBI e à análise de isenção. A data do registro define a
          tabela do cartório.
        </p>
        <p className={styles.help} id={`${id}-registry-table-help`}>
          Confirme com o cartório responsável a tabela aplicável. O repasse de ISS pode mudar o
          total; outra tabela exige conferência.
        </p>
        <p className={styles.help} id={`${id}-special`}>
          Benefício especial: FMH, COHAB, CDHU, ZEIS ou decisão específica. Exige conferência do
          cartório. A classificação HIS2, por si só, não confirma benefício.
        </p>
        <p className={styles.help} id={`${id}-funding`}>
          Confira programa, sistema e origem dos recursos no contrato. Usar saldo pessoal do FGTS na
          entrada não confirma a origem dos recursos do financiamento.
        </p>
        <p className={styles.help} id={`${id}-bases`}>
          A base do ITBI começa pelo preço da compra e precisa de conferência. Informe o valor venal
          do imóvel no IPTU, não o valor do imposto. A avaliação bancária permanece separada.
        </p>
        <p className={styles.help} id={`${id}-registry-declaration`}>
          Ao marcar a confirmação, declaro que confirmei com o cartório responsável que a tabela de
          registro selecionada é aplicável a esta compra. Esta declaração não constitui validação
          independente pelo simulador.
        </p>
        <label className={styles.confirmation}>
          <input
            type="checkbox"
            required
            checked={value.basesConfirmed}
            aria-describedby={`${id}-bases ${id}-help ${id}-registry-table-help ${id}-registry-declaration`}
            onChange={(event) => onChange("basesConfirmed", event.target.checked)}
          />
          <span>
            Conferi as bases, as datas e o enquadramento fiscal com os documentos da compra.
          </span>
        </label>
        {!value.basesConfirmed ? (
          <p className={styles.pending} role="status">
            Documentação aguardando conferência dos dados fiscais.
          </p>
        ) : null}
      </section>
    </details>
  );
}

export function DocumentationLegalNotes({
  result,
  legalContext,
}: {
  result: Extract<DocumentationResult, { ok: true }>;
  legalContext: DocumentationLegalContext;
}) {
  return (
    <section className={styles.legalNotes} aria-label="Regras, fontes e vigência da documentação">
      <p>
        <strong>ITBI:</strong> {result.itbiRule}
      </p>
      <p>
        <strong>Registro e tabela:</strong> {result.registrationRule}
      </p>
      <p>
        <strong>Vigência considerada:</strong> contrato em{" "}
        <time dateTime={legalContext.financingContractDate}>
          {legalContext.financingContractDate.split("-").reverse().join("/")}
        </time>
        ; transmissão (ITBI) em{" "}
        <time dateTime={legalContext.transactionDate}>
          {legalContext.transactionDate.split("-").reverse().join("/")}
        </time>
        ; registro em{" "}
        <time dateTime={legalContext.registrationDate}>
          {legalContext.registrationDate.split("-").reverse().join("/")}
        </time>
        . Versão legal: {result.legalPolicyVersion}.
      </p>
      {result.legalWarnings.length > 0 ? (
        <ul aria-label="Alertas fiscais">
          {result.legalWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary>Fontes legais</summary>
        <ul>
          {result.legalSources.map((source) => (
            <li key={source}>
              {/^https?:\/\//.test(source) ? (
                <a href={source} target="_blank" rel="noreferrer">
                  {source}
                </a>
              ) : (
                source
              )}
            </li>
          ))}
        </ul>
      </details>
      <p>Estimativa sujeita à conferência da Prefeitura, do cartório e do agente financeiro.</p>
    </section>
  );
}
