"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  CaixaAvailableUnit,
  CaixaUnitFlowDetails,
} from "@/lib/crm/simulators/caixa-available-units";
import { CAIXA_UNIT_RANKINGS } from "@/lib/crm/simulators/caixa-available-units";
import { buildCaixaProposalAnnuals } from "@/lib/crm/simulators/caixa-unit-proposal-view";
import type { HousingInput } from "@/lib/crm/simulators/caixa";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import { assessAssociativeCandidate } from "@/lib/archive-investor/associative-approval-suggestion.mjs";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import * as associativeMemory from "@/lib/archive-investor/associative-installment-memory.mjs";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import { calculateAssociativeReleaseStatus } from "@/lib/archive-investor/associative-release-rules.mjs";
import { calculateAssociativeDocumentationView } from "@/lib/archive-investor/associative-documentation-adapter.mjs";
import { buildDocumentationInstallmentSchedule } from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { DeferredInvestorLearningManual } from "./archive-investor/DeferredInvestorLearningManual";
import { CaixaUnitDocuments } from "./CaixaUnitDocuments";
import styles from "./CaixaAvailableUnits.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const date = (value: string | null | undefined) =>
  value ? value.split("-").reverse().join("/") : "Não informada";
type Payment = {
  index: number;
  date: string;
  value: number;
  approved: boolean;
  correctedValue: number;
  reason?: string;
};
type Block = {
  label: string;
  count: number;
  uncorrectedInstallment: number;
  correctedInstallment: number;
  firstInstallmentDate: string;
  lastInstallmentDate: string;
};
type Assessment = {
  valid: boolean;
  approved: boolean;
  approval: {
    proSolutoRate: number;
    linearCommitmentRate: number;
    linearMaximumIncomeRate: number;
    tier: { proSolutoRate: number; commitmentRate: number; annualIncomeLimitRate: number };
  } | null;
  result: {
    ok: boolean;
    errors: string[];
    context: {
      valueReal: number;
      income: number;
      monthlyDates: string[];
      balanceAfterResources: number;
    };
    custom: {
      actValue: number;
      balance: number;
      installmentBalanceBeforeCorrection: number;
      installmentValue: number;
      desiredInstallments: number;
      preInstallments: number;
      postInstallments: number;
      correctedProSoluto: number;
      linear: {
        adjustedPre: number;
        adjustedPost: number;
        prePayment: number;
        postPayment: number;
      };
      decreasing: { ok: boolean; blocks: Block[] };
      signals: Payment[];
      intermediaries: Payment[];
    };
  };
};
type UnitFacts = {
  street?: string;
  streetNumber?: string;
  floor?: number;
  cashBackSlack?: number;
  classification?: string;
};
function Heading({
  step,
  eyebrow,
  title,
  action,
}: {
  step: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.sectionHeading}>
      <span className={styles.step}>{step}</span>
      <div>
        <strong>{eyebrow}</strong>
        <h3>{title}</h3>
      </div>
      {action}
    </header>
  );
}
function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.moneyEditor}>
      <span aria-hidden="true">R$</span>
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </label>
  );
}

export function CaixaUnitProposal({
  selected,
  input,
  ranking,
  firstProperty,
  baseDate,
}: {
  selected: CaixaAvailableUnit;
  input: HousingInput;
  ranking: string;
  firstProperty: string;
  baseDate: string;
}) {
  const [signals, setSignals] = useState([0, 0, 0]);
  const [signalCount, setSignalCount] = useState(0);
  const [annuals, setAnnuals] = useState<Record<string, number>>({});
  const [showAnnuals, setShowAnnuals] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountAuthorized, setDiscountAuthorized] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [documentationScheduleOpen, setDocumentationScheduleOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"linear" | "decreasing" | "documentation" | null>(
    null,
  );
  const proposal = useRef<HTMLElement>(null);
  const unit = selected.unit;
  const unitDescription =
    unit.project &&
    unit.product
      .toLocaleLowerCase("pt-BR")
      .endsWith(` - ${unit.project}`.toLocaleLowerCase("pt-BR"))
      ? unit.product.slice(0, -` - ${unit.project}`.length).trim()
      : unit.product;
  const facts = unit as typeof unit & UnitFacts;
  const flow = useMemo(() => {
    const flowInput = {
      selectedUnitId: unit.id,
      baseDate,
      entryDate: baseDate,
      completionDate: unit.completionDate,
      salePrice: selected.price,
      propertyValue: unit.finalWithKit ?? selected.price,
      unitBonus: unit.unitBonus ?? 0,
      tableSlack: unit.tableSlack ?? 0,
      discountAuthorized,
      discount,
      financing: selected.financing,
      subsidy: selected.subsidy,
      fgts: selected.fgts,
      housingCheck: selected.publicContribution,
      entryValue: selected.entry,
      installments: 84,
      annualMode: true,
      income: input.income,
      signals,
      intermediaries: [] as number[],
      approvalTierId: ranking,
    };
    const calendar = assessAssociativeCandidate(flowInput, unit.progress, "linear") as Assessment;
    const annualSlots = buildCaixaProposalAnnuals({
      income: input.income,
      baseDate,
      completionDate: unit.completionDate ?? "",
      balanceAfterResources: calendar.result.context.balanceAfterResources,
      entry: selected.entry,
      signals: calendar.result.custom.signals,
      overrides: annuals,
    });
    flowInput.intermediaries = annualSlots.map((slot) => slot.amount);
    const linear = assessAssociativeCandidate(flowInput, unit.progress, "linear") as Assessment;
    const decreasing = assessAssociativeCandidate(
      flowInput,
      unit.progress,
      "decreasing",
    ) as Assessment;
    const canonical = linear.result;
    const comparison = associativeMemory.buildAssociativePaymentComparison({
      monthlyDates: canonical.context.monthlyDates,
      installments: canonical.custom.desiredInstallments,
      linearSchedule: associativeMemory.buildAssociativeInstallmentMemory({
        monthlyDates: canonical.context.monthlyDates,
        preInstallments: canonical.custom.preInstallments,
        postInstallments: canonical.custom.postInstallments,
        ...canonical.custom.linear,
      }),
      decreasingBlocks: canonical.custom.decreasing?.blocks ?? [],
      income: input.income,
      constructionProgress: unit.progress,
      baseDate,
      completionDate: unit.completionDate,
      entryPayment: {
        kind: "entry",
        label: "Entrada",
        paymentDate: baseDate,
        value: selected.entry,
      },
      signals: canonical.custom.signals
        .filter((a) => a.approved && a.value > 0)
        .map((a) => ({ ...a, paymentDate: a.date })),
      annuals: canonical.custom.intermediaries
        .filter((a) => a.approved && a.value > 0)
        .map((a) => ({ ...a, paymentDate: a.date })),
    }) as { rows: CaixaUnitFlowDetails["schedule"] };
    return {
      linear,
      decreasing,
      canonical,
      annualValues: flowInput.intermediaries,
      schedule: comparison.rows,
    };
  }, [
    annuals,
    baseDate,
    discount,
    discountAuthorized,
    input.income,
    ranking,
    selected,
    signals,
    unit,
  ]);
  const { canonical } = flow;
  const approved =
    flow.linear.valid && flow.decreasing.valid && flow.linear.approved && flow.decreasing.approved;
  const release = calculateAssociativeReleaseStatus({
    vgv: canonical.context.valueReal,
    entryValue: selected.entry,
    entryDate: baseDate,
    signals: canonical.custom.signals,
    referenceDate: baseDate,
  }) as { repasse: { status: string; reason: string } };
  const documentation = useMemo(
    () =>
      calculateAssociativeDocumentationView({
        businessUnit: unit.businessUnit,
        modality: (input.product ?? "mcmv").toUpperCase(),
        manualModalityPreference: (input.product ?? "mcmv").toUpperCase(),
        firstProperty: firstProperty === "yes" ? "SIM" : firstProperty === "no" ? "NAO" : "",
        salePrice: canonical.context.valueReal,
        reportedAppraisal: unit.appraisal ?? null,
        financing: selected.financing,
        income: input.income,
        baseDate,
        municipality:
          unit.state === "SP" &&
          unit.city
            ?.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase() === "sao paulo"
            ? "sao-paulo-sp"
            : "",
      }),
    [
      baseDate,
      canonical.context.valueReal,
      firstProperty,
      input.income,
      input.product,
      selected.financing,
      unit,
    ],
  );
  const doc = documentation.result;
  const docSchedule = doc.ok ? buildDocumentationInstallmentSchedule(doc) : [];
  const rowData = [
    ["Valor real da venda", "=", canonical.context.valueReal],
    ["Financiamento", "−", selected.financing],
    ["Subsídio", "−", selected.subsidy],
    ["FGTS", "−", selected.fgts],
    ["Cheque Moradia", "−", selected.publicContribution],
    ["Saldo após recursos", "=", canonical.context.balanceAfterResources],
    ["Entrada", "−", selected.entry],
  ] as const;
  const summary = [
    {
      label: "Linear 100%",
      count: 84,
      uncorrectedInstallment: canonical.custom.installmentBalanceBeforeCorrection / 84,
      correctedInstallment: canonical.custom.installmentValue,
      firstInstallmentDate: canonical.context.monthlyDates[0],
      lastInstallmentDate: canonical.context.monthlyDates[83],
    },
    ...(canonical.custom.decreasing?.blocks ?? []).map((block) => ({
      ...block,
      label: `Decrescente ${block.label}`,
    })),
  ];
  useEffect(() => {
    if (!printMode) return;
    const clear = () => setPrintMode(null);
    window.addEventListener("afterprint", clear, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", clear);
    };
  }, [printMode]);
  const scheduleTable = (
    <table aria-label="84 mensais e anuais do fluxo aprovado">
      <thead>
        <tr>
          <th>Parcela</th>
          <th>Vencimento</th>
          <th>Linear</th>
          <th>Decrescente</th>
          <th>Evolução de obra</th>
          <th>Anual corrigida</th>
          <th>Total Linear</th>
          <th>Total Decrescente</th>
        </tr>
      </thead>
      <tbody>
        {flow.schedule
          .filter((row) => row.kind !== "entry")
          .map((row, index) => (
            <tr key={`${row.kind}-${index}`} data-payment-kind={row.kind}>
              <th>{row.label}</th>
              <td>{date(row.paymentDate)}</td>
              <td>{money.format(row.linearPayment)}</td>
              <td>{money.format(row.decreasingPayment)}</td>
              <td>{row.workEvolution == null ? "—" : money.format(row.workEvolution)}</td>
              <td>{money.format(row.annualPayment ?? 0)}</td>
              <td>{money.format(row.linearTotal)}</td>
              <td>{money.format(row.decreasingTotal)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
  return (
    <section className={styles.proposal} aria-label={`Fluxo de ${unit.product}`} ref={proposal}>
      <article className={styles.propertySummary} aria-label="Descrição do imóvel">
        <header>
          <div>
            <h3>Descrição do Imóvel</h3>
            <p>
              <strong>{unit.project}</strong>
              <span>|</span>
              <strong>{unitDescription}</strong>
              <span>|</span>
              <strong>
                {[
                  facts.street,
                  facts.streetNumber,
                  unit.neighborhood,
                  unit.city && `${unit.city}-${unit.state}`,
                ]
                  .filter(Boolean)
                  .join(", ") || "Endereço não informado"}
              </strong>
              <span>|</span>
              <strong>VAGA: {unit.parkingSpaces ?? "Não informada"}</strong>
            </p>
          </div>
          <div className={styles.propertyPrice}>
            <span>Valor do imóvel</span>
            <strong>{money.format(selected.price)}</strong>
          </div>
        </header>
        <dl>
          {[
            ["Incorporadora", unit.businessUnit],
            ["Planta", unit.plant ?? "Não informada"],
            ["Metragem", `${unit.privateArea?.toLocaleString("pt-BR")} m²`],
            [
              "Andar",
              facts.floor == null
                ? "Não informado"
                : facts.floor === 0
                  ? "Térreo"
                  : String(facts.floor),
            ],
            ["Andamento da obra", percent.format(unit.progress ?? 0)],
            ["Data de término da obra", date(unit.completionDate)],
            ["Avaliação bancária", money.format(unit.appraisal ?? 0)],
            [
              "Volta ao caixa",
              facts.cashBackSlack == null ? "Não informada" : money.format(facts.cashBackSlack),
            ],
            ["Outras descrições", facts.classification || "Não informadas"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
      <section className={styles.flowPanel} aria-label="Fluxo editável">
        <Heading
          step="03"
          eyebrow="Fluxo editável"
          title="Monte a proposta"
          action={
            <button
              type="button"
              className={styles.guideButton}
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen((v) => !v)}
            >
              Iniciar passo a passo
            </button>
          }
        />
        {guideOpen && (
          <ol className={styles.guide}>
            <li>Confira a unidade e os valores trazidos da CAIXA.</li>
            <li>
              A entrada é o recurso próprio informado, com mínimo de R$150,00. O fluxo usa 84
              mensais.
            </li>
            <li>
              As anuais válidas já estão preenchidas. Ajustes em sinais, anuais ou desconto são
              revalidados pelo motor Associativo.
            </li>
            <li>Confira os dois fluxos e a documentação antes de imprimir.</li>
          </ol>
        )}
        <div className={styles.flowGrid}>
          <section className={styles.ledger} aria-label="Composição da proposta">
            <div className={styles.paymentActions}>
              <button
                type="button"
                disabled={signalCount >= 3}
                onClick={() => setSignalCount((c) => Math.min(3, c + 1))}
              >
                Inserir Sinal
              </button>
              <button
                type="button"
                aria-expanded={showAnnuals}
                onClick={() => setShowAnnuals((v) => !v)}
              >
                Inserir Anual
              </button>
              <button
                type="button"
                aria-expanded={showDiscount}
                onClick={() => setShowDiscount((v) => !v)}
              >
                Inserir Desconto
              </button>
            </div>
            <table>
              <tbody>
                {rowData.map(([label, operator, value]) => (
                  <tr key={label}>
                    <th>
                      {label}
                      {label === "Entrada" && <small>{date(baseDate)}</small>}
                    </th>
                    <td className={styles.operator}>{operator}</td>
                    <td className={styles.currency}>R$</td>
                    <td>{money.format(value).replace(/^R\$\s*/, "")}</td>
                  </tr>
                ))}
                {signals.slice(0, signalCount).map((value, index) => (
                  <tr key={`signal-${index}`}>
                    <th>
                      Sinal {index + 1}
                      <small>{date(canonical.custom.signals[index]?.date)}</small>
                    </th>
                    <td>−</td>
                    <td colSpan={2}>
                      <Amount
                        label={`Valor do sinal ${index + 1}`}
                        value={value}
                        onChange={(next) =>
                          setSignals((values) => values.map((v, i) => (i === index ? next : v)))
                        }
                      />
                      {value > 0 && !canonical.custom.signals[index]?.approved && (
                        <small className={styles.error}>
                          {canonical.custom.signals[index]?.reason}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
                {showAnnuals &&
                  canonical.custom.intermediaries.map((annual, index) => (
                    <tr key={`annual-${index}`}>
                      <th>
                        Anual {index + 1}
                        <small>{date(annual.date)}</small>
                      </th>
                      <td>−</td>
                      <td colSpan={2}>
                        <Amount
                          label={`Valor da anual ${index + 1}`}
                          value={flow.annualValues[index] ?? 0}
                          onChange={(next) =>
                            setAnnuals((values) => ({ ...values, [annual.date]: next }))
                          }
                        />
                        {annual.value > 0 && !annual.approved && (
                          <small className={styles.error}>{annual.reason}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                {showDiscount && (
                  <tr>
                    <th>
                      Desconto
                      <small>
                        <label>
                          <input
                            type="checkbox"
                            checked={discountAuthorized}
                            onChange={(e) => setDiscountAuthorized(e.target.checked)}
                          />{" "}
                          Desconto autorizado
                        </label>
                      </small>
                    </th>
                    <td>−</td>
                    <td colSpan={2}>
                      <Amount label="Valor do desconto" value={discount} onChange={setDiscount} />
                      {!discountAuthorized && discount > 0 && (
                        <small>Não aplicado sem autorização.</small>
                      )}
                    </td>
                  </tr>
                )}
                <tr className={styles.totalRow}>
                  <th>Saldo parcelado</th>
                  <td>=</td>
                  <td>R$</td>
                  <td>{money.format(canonical.custom.balance).replace(/^R\$\s*/, "")}</td>
                </tr>
                <tr>
                  <th>Qtd. de parcelas</th>
                  <td>÷</td>
                  <td></td>
                  <td>84</td>
                </tr>
              </tbody>
            </table>
          </section>
          <div className={styles.approvalColumn}>
            <section className={styles.approval} aria-label="Parâmetros de aprovação">
              <header>
                <div>
                  <strong>Parâmetros de aprovação</strong>
                  <p>Resultado × regra da classificação</p>
                </div>
                <span className={styles.ranking}>
                  {CAIXA_UNIT_RANKINGS.find((r) => r.id === ranking)?.label}
                </span>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Regra de aprovação</th>
                    <th>Resultado Linear</th>
                    <th>Resultado Decrescente</th>
                    <th>Limite</th>
                  </tr>
                </thead>
                <tbody>
                  {flow.linear.approval &&
                    flow.decreasing.approval &&
                    [
                      [
                        "% Pró-Soluto",
                        flow.linear.approval.proSolutoRate,
                        flow.decreasing.approval.proSolutoRate,
                        flow.linear.approval.tier.proSolutoRate,
                      ],
                      [
                        "% Comprometimento da Renda",
                        flow.linear.approval.linearCommitmentRate,
                        flow.decreasing.approval.linearCommitmentRate,
                        flow.linear.approval.tier.commitmentRate,
                      ],
                      [
                        "% Máximo da renda mensal",
                        flow.linear.approval.linearMaximumIncomeRate,
                        flow.decreasing.approval.linearMaximumIncomeRate,
                        flow.linear.approval.tier.annualIncomeLimitRate,
                      ],
                    ].map(([label, a, b, limit]) => (
                      <tr key={String(label)}>
                        <th>{label}</th>
                        <td>{percent.format(Number(a))}</td>
                        <td>{percent.format(Number(b))}</td>
                        <td>≤{percent.format(Number(limit))}</td>
                      </tr>
                    ))}
                  <tr>
                    <th>Status da proposta</th>
                    <td>
                      <span className={styles.badge}>
                        {flow.linear.approved ? "APROVADO" : "REVISAR"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.badge}>
                        {flow.decreasing.approved ? "APROVADO" : "REVISAR"}
                      </span>
                    </td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.release}>
                <strong>Repasse</strong>
                <span className={styles.badge}>
                  {release.repasse.status === "released" ? "LIBERADO" : "PENDENTE"}
                </span>
                <span>{release.repasse.reason}</span>
              </div>
              <div className={styles.approvedBanner}>
                <strong>{approved ? "APROVADO" : "REVISE A PROPOSTA"}</strong>
                <span>
                  {approved
                    ? "Linear e Decrescente estão dentro da regra selecionada."
                    : canonical.errors?.join(" ") || "Confira pagamentos e limites do ranking."}
                </span>
              </div>
            </section>
            <section className={styles.paymentSummary} aria-label="Resumo das parcelas">
              <header>
                <div>
                  <strong>Resumo das parcelas</strong>
                  <small>Fluxo linear e quatro blocos decrescentes</small>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={!approved}
                    aria-expanded={scheduleOpen}
                    onClick={() => setScheduleOpen((v) => !v)}
                  >
                    Exibir parcelas
                  </button>
                  <button
                    type="button"
                    disabled={!approved}
                    aria-expanded={readyOpen}
                    onClick={() => setReadyOpen((v) => !v)}
                  >
                    Proposta pronta - Bora Vender
                  </button>
                </div>
              </header>
              <div className={styles.compactTable}>
                <table aria-label="Comparativo das parcelas lineares e decrescentes">
                  <thead>
                    <tr>
                      <th>Resumo</th>
                      <th>Qtd.</th>
                      <th>Sem correção</th>
                      <th>Com correção</th>
                      <th>1ª mensal</th>
                      <th>Última mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.count}</td>
                        <td>{money.format(row.uncorrectedInstallment)}</td>
                        <td>{money.format(row.correctedInstallment)}</td>
                        <td>{date(row.firstInstallmentDate)}</td>
                        <td>{date(row.lastInstallmentDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
        {scheduleOpen && approved && (
          <section className={styles.schedule} aria-label="Parcelas do fluxo aprovado">
            <header>
              <h4>84 mensais e anuais do fluxo aprovado</h4>
              <button type="button" onClick={() => setScheduleOpen(false)}>
                Ocultar parcelas
              </button>
            </header>
            <div className={styles.tableScroll} tabIndex={0}>
              {scheduleTable}
            </div>
          </section>
        )}
        {readyOpen && approved && (
          <section className={styles.readyProposal} aria-label="Proposta pronta">
            <h4>Proposta pronta - Bora Vender</h4>
            <p>
              {unit.project} · {unit.product}
            </p>
            <dl>
              {rowData.map(([label, , value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{money.format(value)}</dd>
                </div>
              ))}
            </dl>
            <p>
              84 mensais · {CAIXA_UNIT_RANKINGS.find((r) => r.id === ranking)?.label} ·{" "}
              {approved ? "APROVADO" : "REVISAR"}
            </p>
            <button type="button" disabled={!approved} onClick={() => setPrintMode("linear")}>
              Imprimir proposta
            </button>
          </section>
        )}
      </section>
      <aside className={styles.documentation} aria-label="Resumo financeiro da documentação">
        <Heading
          step="03"
          eyebrow="Proposta calculada"
          title="Resumo financeiro"
          action={
            <div className={styles.headingActions}>
              <button
                type="button"
                aria-label="Exibir parcelas da documentação"
                disabled={!doc.ok}
                aria-expanded={documentationScheduleOpen}
                onClick={() => setDocumentationScheduleOpen((v) => !v)}
              >
                Exibir parcelas
              </button>
              <button
                type="button"
                disabled={!doc.ok}
                onClick={() => setPrintMode("documentation")}
              >
                Imprimir
              </button>
            </div>
          }
        />
        {doc.ok && (
          <p className={styles.note}>Estimativa automática · bases fiscais a confirmar.</p>
        )}
        {doc.ok ? (
          <div className={styles.documentationGrid}>
            <section className={styles.documentationPlan}>
              <small>Plano sugerido</small>
              <p>
                <strong>{doc.installments}x Parcelas de</strong>{" "}
                <span>{money.format(doc.installmentValue)}</span>
              </p>
              <small>
                1ª parcela para <b>{date(doc.firstInstallmentDate)}</b>
              </small>
              <div>
                <span>Total da documentação</span>
                <strong>{money.format(doc.totalCash)}</strong>
              </div>
            </section>
            <section className={styles.documentationBreakdown}>
              <h4>Composição</h4>
              <dl>
                {[
                  ["ITBI", doc.itbi],
                  ["Registro", doc.totalRegistration],
                  ["Despachante", doc.dispatchFee],
                  ["Seguro Caixa", doc.caixaInsurance],
                  ["Total da documentação", doc.totalCash],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{money.format(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        ) : (
          <div className={styles.documentationPending} role="status">
            <strong>Documentação aguardando dados</strong>
            <ul>
              {[...new Set([...documentation.missingItems, ...doc.errors])].map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {doc.ok && documentationScheduleOpen && (
          <div className={styles.tableScroll} tabIndex={0}>
            <table aria-label="Cronograma mensal da documentação">
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {docSchedule.map((row) => (
                  <tr key={row.number}>
                    <th>
                      {row.number}/{doc.installments}
                    </th>
                    <td>{date(row.paymentDate)}</td>
                    <td>{money.format(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </aside>
      <section className={styles.resourceActions} aria-label="Ajuda, documentação e impressão">
        <DeferredInvestorLearningManual associative />
        <button
          type="button"
          aria-expanded={documentsOpen}
          onClick={() => setDocumentsOpen((v) => !v)}
        >
          Doc Pessoa Física
        </button>
        <button type="button" disabled={!approved} onClick={() => setPrintMode("linear")}>
          Imprimir linear
        </button>
        <button type="button" disabled={!approved} onClick={() => setPrintMode("decreasing")}>
          Imprimir escalonado
        </button>
        <a href="https://boravender.app.br/login" target="_blank" rel="noopener noreferrer">
          <span className={`${styles.platformLogo} ${styles.boraLogo}`} aria-hidden="true" />
          <span className={styles.platformText}>
            <small>Acessar plataforma</small>
            <strong>Bora Vendas</strong>
          </span>
        </a>
        <a
          href="https://direcional.my.site.com/vendas/s/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={`${styles.platformLogo} ${styles.salesforceLogo}`} aria-hidden="true" />
          <span className={styles.platformText}>
            <small>Acessar plataforma</small>
            <strong>Salesforce</strong>
          </span>
        </a>
      </section>
      {documentsOpen && <CaixaUnitDocuments className={styles.readyProposal ?? ""} />}
      {printMode &&
        createPortal(
          <article className={styles.printSheet}>
            <h1>
              {printMode === "documentation" ? "Documentação" : "Proposta Associativo"} ·{" "}
              {printMode === "decreasing" ? "Escalonado" : "Linear"}
            </h1>
            <h2>
              {unit.project} · {unit.product}
            </h2>
            <p>
              Data: {date(baseDate)} · Renda: {money.format(input.income)}
            </p>
            {printMode === "documentation" && doc.ok ? (
              <>
                <p>
                  Total {money.format(doc.totalCash)} · {doc.installments} parcelas de{" "}
                  {money.format(doc.installmentValue)}
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Data</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docSchedule.map((row) => (
                      <tr key={row.number}>
                        <td>{row.number}</td>
                        <td>{date(row.paymentDate)}</td>
                        <td>{money.format(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <dl>
                  {rowData.map(([label, , value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{money.format(value)}</dd>
                    </div>
                  ))}
                </dl>
                <table>
                  <thead>
                    <tr>
                      <th>Pagamento</th>
                      <th>Vencimento</th>
                      <th>Parcela</th>
                      <th>Obra</th>
                      <th>Anual</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flow.schedule.map((row, index) => (
                      <tr key={index}>
                        <td>{row.label}</td>
                        <td>{date(row.paymentDate)}</td>
                        <td>
                          {money.format(
                            printMode === "decreasing" ? row.decreasingPayment : row.linearPayment,
                          )}
                        </td>
                        <td>{row.workEvolution == null ? "—" : money.format(row.workEvolution)}</td>
                        <td>{money.format(row.annualPayment ?? 0)}</td>
                        <td>
                          {money.format(
                            printMode === "decreasing" ? row.decreasingTotal : row.linearTotal,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p>Resultado preliminar sujeito à política comercial e à análise bancária.</p>
          </article>,
          document.body,
        )}
    </section>
  );
}
