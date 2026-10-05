import { enforcePermission } from "@/lib/authorization/enforce";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "../../_components/ManagementCanvas";
import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  SectionHeading,
  type AnalyticsColumn,
} from "../_components/analytics";

import styles from "./PartnershipsCanvas.module.css";

export const metadata = { title: "Canal de Parcerias" };

const INTEGRATION_PENDING_LABEL = "Dado indisponível — integração pendente";
const SHOW_EXTENDED_PARTNERSHIP_RANKINGS = false;

interface ImobRankingRow {
  id: string;
  position: string;
  classification: string;
  imob: string;
  salesValue: string;
  contracts: string;
}

interface DevelopmentRankingRow {
  id: string;
  position: string;
  development: string;
  salesValue: string;
  contracts: string;
  participation: string;
  variation: string;
}

const imobColumns: Array<AnalyticsColumn<ImobRankingRow>> = [
  { key: "position", label: "Posição", render: (row) => row.position },
  { key: "classification", label: "Classificação", render: (row) => row.classification },
  { key: "imob", label: "Nome", render: (row) => row.imob },
  {
    key: "sales-value",
    label: "VGV",
    align: "right",
    render: (row) => row.salesValue,
  },
  {
    key: "contracts",
    label: "Contratos",
    align: "right",
    render: (row) => row.contracts,
  },
];

const developmentColumns: Array<AnalyticsColumn<DevelopmentRankingRow>> = [
  { key: "position", label: "Posição", render: (row) => row.position },
  {
    key: "development",
    label: "Empreendimento",
    render: (row) => row.development,
  },
  {
    key: "sales-value",
    label: "VGV",
    align: "right",
    render: (row) => row.salesValue,
  },
  {
    key: "contracts",
    label: "Contratos",
    align: "right",
    render: (row) => row.contracts,
  },
  {
    key: "participation",
    label: "Participação",
    align: "right",
    render: (row) => row.participation,
  },
  {
    key: "variation",
    label: "Variação",
    align: "right",
    render: (row) => row.variation,
  },
];

function DisabledFilter({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label}: ${INTEGRATION_PENDING_LABEL}`}
      className="flex min-h-11 w-full min-w-56 cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] px-3 py-2 text-left text-sm font-medium text-[var(--analytics-muted)] opacity-80"
    >
      <span>{INTEGRATION_PENDING_LABEL}</span>
      <span aria-hidden="true" className="ml-3 text-base">
        ⌄
      </span>
    </button>
  );
}

function PodiumPlaceholder({
  classification,
  featured = false,
}: {
  classification: "Prata" | "Ouro" | "Bronze";
  featured?: boolean;
}) {
  return (
    <AnalyticsCard
      tone={featured ? "navy" : "default"}
      density="compact"
      aria-label={`${classification}: posição indisponível`}
      className={`${styles.podiumCard} relative flex min-h-48 flex-col items-center justify-center overflow-hidden text-center`}
    >
      <span
        aria-hidden="true"
        className={`grid size-14 place-items-center rounded-full border border-dashed ${
          featured
            ? "border-cyan-200/50 bg-white/5 ring-8 ring-white/5"
            : "border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] ring-8 ring-[var(--analytics-surface-muted)]"
        }`}
      >
        <span
          className={`block h-5 w-8 rounded-full ${
            featured ? "bg-cyan-200/20" : "bg-[var(--analytics-line)]"
          }`}
        />
      </span>
      <div className={styles.podiumCopy}>
        <p
          className={`mt-4 text-xs font-semibold tracking-[0.16em] uppercase ${
            featured ? "text-cyan-300" : "text-[var(--analytics-cyan-strong)]"
          }`}
        >
          {classification} · posição do pódio
        </p>
        <h3
          className={`mt-3 max-w-64 text-lg font-semibold ${
            featured ? "text-white" : "text-[var(--analytics-ink)]"
          }`}
        >
          {INTEGRATION_PENDING_LABEL}
        </h3>
        <p
          className={`${styles.podiumDescription} mt-3 max-w-72 text-sm leading-6 ${
            featured ? "text-slate-300" : "text-[var(--analytics-muted)]"
          }`}
        >
          A posição, o nome e o resultado serão apresentados somente após a integração autorizada.
        </p>
      </div>
    </AnalyticsCard>
  );
}

export default async function PartnershipsChannelPage() {
  await enforcePermission("crm.partnerships.view");

  const imobRows: ImobRankingRow[] = [];
  const developmentRows: DevelopmentRankingRow[] = [];

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        eyebrow="Canal de Parcerias"
        title="Ranking das imobiliárias"
        description="Evolução comercial das parceiras e empreendimentos. Ranking, totais e mensagens aguardam a mesma base conciliada."
        status={<ManagementStatusBadge>Prévia visual · sem dados reais</ManagementStatusBadge>}
      />

      <section className={styles.sourceState} aria-label="Estado da integração do ranking">
        <DataState
          variant="unavailable"
          compact
          title={INTEGRATION_PENDING_LABEL}
          description="Aguardando conciliação das fontes. O ranking e os dados de validação ainda não foram integrados."
        />
        <dl>
          <div>
            <dt className={managementStyles.sectionKicker}>Fonte do ranking</dt>
            <dd className="mt-1 font-semibold text-[var(--analytics-ink)]">
              {INTEGRATION_PENDING_LABEL}
            </dd>
          </div>
          <div>
            <dt className={managementStyles.sectionKicker}>Última atualização</dt>
            <dd className="mt-1 font-semibold text-[var(--analytics-ink)]">
              {INTEGRATION_PENDING_LABEL}
            </dd>
          </div>
        </dl>
      </section>

      <FilterBar label="Visões e filtros do Canal de Parcerias" density="compact">
        <FilterGroup label="Visão do ranking">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Visões indisponíveis">
            {["Mês atual", "Mês anterior", "Ano", "Personalizado"].map((view) => (
              <button
                key={view}
                type="button"
                disabled
                className="min-h-11 cursor-not-allowed rounded-xl border border-dashed border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--analytics-muted)]"
              >
                {view}
              </button>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup label="Unidade de negócio">
          <DisabledFilter label="Unidade de negócio" />
        </FilterGroup>
        <FilterGroup label="Dimensão do ranking">
          <DisabledFilter label="Dimensão do ranking" />
        </FilterGroup>
      </FilterBar>

      <section className={styles.customPeriod} aria-labelledby="custom-period-title">
        <AnalyticsCard density="compact">
          <SectionHeading
            id="custom-period-title"
            kicker="Ranking personalizado"
            title="Período personalizado"
            description="Ano, meses e trimestres serão habilitados somente dentro da cobertura conciliada."
            density="compact"
          />
          <fieldset disabled className="grid gap-4 sm:grid-cols-3">
            <legend className="sr-only">Intervalo personalizado indisponível</legend>
            {[
              ["Ano", "number"],
              ["Mês inicial", "month"],
              ["Mês final", "month"],
            ].map(([label, type]) => (
              <label
                key={label}
                className="grid gap-1 text-sm font-semibold text-[var(--analytics-ink)]"
              >
                {label}
                <input
                  type={type}
                  className="min-h-11 cursor-not-allowed rounded-xl border border-dashed border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] px-3 text-[var(--analytics-muted)]"
                  aria-describedby="custom-period-pending"
                />
              </label>
            ))}
            <div
              className="flex flex-wrap gap-2 sm:col-span-3"
              role="group"
              aria-label="Atalhos de trimestre"
            >
              {["1º trimestre", "2º trimestre", "3º trimestre", "4º trimestre"].map((quarter) => (
                <button
                  key={quarter}
                  type="button"
                  className="min-h-11 rounded-xl border border-dashed border-[var(--analytics-line)] px-3 text-sm text-[var(--analytics-muted)]"
                >
                  {quarter}
                </button>
              ))}
            </div>
          </fieldset>
          <p id="custom-period-pending" className="mt-3 text-sm text-[var(--analytics-muted)]">
            {INTEGRATION_PENDING_LABEL}. Nenhum intervalo ou competência fechada foi presumido.
          </p>
        </AnalyticsCard>
      </section>

      <section aria-labelledby="partnership-podium-title">
        <div className={styles.sectionHeading}>
          <SectionHeading
            id="partnership-podium-title"
            kicker="Ranking de imobiliárias"
            title="Pódio das parcerias"
            description="A composição visual está pronta para receber o ranking oficial, sem antecipar nomes, posições ou resultados."
            density="compact"
          />
        </div>
        <div className={`${styles.podiumGrid} grid items-end gap-4 lg:grid-cols-3`}>
          <PodiumPlaceholder classification="Prata" />
          <PodiumPlaceholder classification="Ouro" featured />
          <PodiumPlaceholder classification="Bronze" />
        </div>
      </section>

      <section aria-labelledby="partnership-summary-title">
        <div className={styles.sectionHeading}>
          <SectionHeading
            id="partnership-summary-title"
            kicker="Resumo conciliado"
            title="Totais do período"
            description="Os quatro indicadores usarão exatamente a população considerada pelo ranking."
            density="compact"
          />
        </div>
        <div className={`${styles.summaryGrid} grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
          {[
            "VGV total",
            "Total de contratos",
            "Imobiliárias com produção",
            "Período e unidade",
          ].map((label) => (
            <AnalyticsCard key={label} density="compact">
              <p className="text-xs font-semibold tracking-wide text-[var(--analytics-cyan-strong)] uppercase">
                {label}
              </p>
              <div className="mt-3">
                <DataState
                  variant="unavailable"
                  compact
                  headingLevel="h3"
                  title={INTEGRATION_PENDING_LABEL}
                  description="Aguardando população conciliada."
                />
              </div>
            </AnalyticsCard>
          ))}
        </div>
      </section>

      {SHOW_EXTENDED_PARTNERSHIP_RANKINGS ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="min-w-0" aria-labelledby="imob-ranking-title">
              <AnalyticsCard density="compact" className="h-full">
                <SectionHeading
                  id="imob-ranking-title"
                  kicker="Elite Partners — Top 10"
                  title="Ranking das imobiliárias"
                  description="Período, unidade e ordem serão apresentados pelo sistema."
                  density="compact"
                />
                <label className="mb-4 grid gap-1 text-sm font-semibold text-[var(--analytics-ink)]">
                  Pesquisar por imobiliária
                  <input
                    type="search"
                    disabled
                    placeholder="Integração pendente"
                    className="min-h-11 cursor-not-allowed rounded-xl border border-dashed border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] px-3 text-[var(--analytics-muted)]"
                  />
                </label>
                <AnalyticsTable
                  caption="Ranking de imobiliárias parceiras"
                  rows={imobRows}
                  columns={imobColumns}
                  rowKey={(row) => row.id}
                  density="compact"
                />
                <div className="mt-4">
                  <DataState
                    variant="unavailable"
                    compact
                    headingLevel="h3"
                    title={INTEGRATION_PENDING_LABEL}
                    description="Nenhuma posição é inferida enquanto a fonte oficial de leitura não estiver conectada."
                  />
                </div>
              </AnalyticsCard>
            </section>

            <section className="min-w-0" aria-labelledby="development-ranking-title">
              <AnalyticsCard density="compact" className="h-full">
                <SectionHeading
                  id="development-ranking-title"
                  kicker="Performance por produto — Top 10"
                  title="Ranking dos Empreendimentos"
                  description="Mesmo período, unidade, população e base do ranking das imobiliárias."
                  density="compact"
                />
                <AnalyticsTable
                  caption="Ranking de empreendimentos do canal"
                  rows={developmentRows}
                  columns={developmentColumns}
                  rowKey={(row) => row.id}
                  density="compact"
                />
                <div className="mt-4">
                  <DataState
                    variant="unavailable"
                    compact
                    headingLevel="h3"
                    title={INTEGRATION_PENDING_LABEL}
                    description="Nenhum resultado é inferido enquanto a fonte oficial de leitura não estiver conectada."
                  />
                </div>
              </AnalyticsCard>
            </section>
          </div>

          <section aria-labelledby="reconciliation-gate-title">
            <AnalyticsCard tone="navy" density="compact">
              <SectionHeading
                id="reconciliation-gate-title"
                kicker="Validação da conciliação"
                title="Aguardando conciliação das fontes"
                description="Período, unidade, população, totais e carga completa ainda não possuem evidência comum."
                density="compact"
              />
              <dl className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                <div>
                  <dt className="text-xs tracking-wide text-cyan-300 uppercase">Motivo</dt>
                  <dd className="mt-1">Fonte oficial de leitura não conectada.</dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-cyan-300 uppercase">
                    Última base válida
                  </dt>
                  <dd className="mt-1">{INTEGRATION_PENDING_LABEL}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled
                className="mt-5 min-h-11 cursor-not-allowed rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white opacity-70"
              >
                Tentar novamente — fonte indisponível
              </button>
            </AnalyticsCard>
          </section>

          <footer
            className={`${managementStyles.panel} ${managementStyles.panelPadded} text-sm text-[var(--analytics-muted)]`}
          >
            <strong className="text-[var(--analytics-ink)]">Descomplica CRM</strong>
            <span> · Inteligência comercial do Canal de Parcerias</span>
            <span className="block">Identificação institucional configurável: indisponível.</span>
          </footer>
        </>
      ) : null}
    </ManagementPage>
  );
}
