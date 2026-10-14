import { Medal } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
} from "@/app/(protected)/_components/ManagementCanvas";
import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  SectionHeading,
  UnavailableValue,
  type AnalyticsColumn,
} from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";

import styles from "./RankingCanvas.module.css";

export const metadata = { title: "Ranking de parcerias" };

const SOURCE_PENDING = "Fonte Qlik ainda não homologada";
const COVERAGE_PENDING = "Cobertura de períodos ainda não confirmada";
const PERIODS = ["Mês atual", "Mês anterior", "Ano", "Personalizado"] as const;
const PODIUM = ["Prata", "Ouro", "Bronze"] as const;

function PendingValue() {
  return <UnavailableValue reason={SOURCE_PENDING} />;
}

function PendingRanking({ kind }: { kind: "imobs" | "developments" }) {
  const isImob = kind === "imobs";
  const title = isImob ? "Top 10 imobiliárias" : "Top 10 empreendimentos";
  const columns: Array<AnalyticsColumn<never>> = [
    "Posição",
    "Variação",
    isImob ? "Imobiliária" : "Empreendimento",
    "VGV",
    "Total de contratos",
    "Classificação",
  ].map((label, index) => ({
    key: label,
    label,
    align: index === 3 || index === 4 ? "right" : "left",
    render: () => <PendingValue />,
  }));

  return (
    <section className={styles.rankingSection} aria-labelledby={`${kind}-title`}>
      <SectionHeading
        id={`${kind}-title`}
        title={title}
        density="compact"
        action={
          isImob ? (
            <label className={styles.search}>
              Buscar imobiliária
              <input type="search" disabled title={SOURCE_PENDING} />
            </label>
          ) : undefined
        }
      />
      <AnalyticsTable<never>
        caption={title}
        captionVisible={false}
        rows={[]}
        columns={columns}
        rowKey={() => ""}
        density="compact"
        emptyState={
          <p className={styles.tableState}>Resultados indisponíveis. {SOURCE_PENDING}.</p>
        }
      />
      <dl
        className={styles.summary}
        aria-label={`Resumo de ${isImob ? "imobiliárias" : "empreendimentos"}`}
      >
        {[
          "VGV total",
          "Total de contratos",
          isImob ? "Imobiliárias com produção" : "Empreendimentos com produção",
        ].map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <PendingValue />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function RankingPage() {
  await enforcePermission("crm.ranking.view");

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        eyebrow="Canal de Parcerias"
        title="Ranking das imobiliárias"
        description="Imobiliárias e empreendimentos · VGV e contratos"
        status={<ManagementStatusBadge tone="warning">Integração pendente</ManagementStatusBadge>}
      />

      <section aria-label="Estado da fonte">
        <DataState
          variant="unavailable"
          title="Dados indisponíveis"
          description="Fonte Qlik ainda não homologada. Atualização e resultados não confirmados."
          compact
        />
        <dl className={styles.sourceMeta}>
          {["Atualização da fonte", "Processamento", "Período disponível"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <PendingValue />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p id="scope-status" className={styles.pendingNote}>
        Recorte confirmado. Atualização automática ainda indisponível.
      </p>
      <FilterBar label="Filtros do ranking de parcerias" density="compact">
        <FilterGroup label="Período">
          <div className={styles.periods}>
            {PERIODS.map((period) => (
              <label key={period}>
                <input
                  type="radio"
                  name="period"
                  value={period}
                  disabled
                  title={COVERAGE_PENDING}
                />
                <span>{period}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup label="Unidade de negócio">
          <select
            aria-label="Unidade de negócio"
            aria-describedby="scope-status"
            disabled
            defaultValue="Direcional"
            title={SOURCE_PENDING}
          >
            <option value="Direcional">Direcional</option>
          </select>
        </FilterGroup>
        <FilterGroup label="Regional">
          <select
            aria-label="Regional"
            aria-describedby="scope-status"
            disabled
            defaultValue="SP CAPITAL"
            title={SOURCE_PENDING}
          >
            <option value="SP CAPITAL">SP CAPITAL</option>
          </select>
        </FilterGroup>
        <FilterGroup label="Canal">
          <select
            aria-label="Canal"
            aria-describedby="scope-status"
            disabled
            defaultValue="CANAL IMOB"
            title={SOURCE_PENDING}
          >
            <option value="CANAL IMOB">CANAL IMOB</option>
          </select>
        </FilterGroup>
      </FilterBar>

      <section className={styles.customPeriod} aria-labelledby="custom-period-title">
        <SectionHeading id="custom-period-title" title="Período personalizado" density="compact" />
        <p id="period-availability" className={styles.pendingNote}>
          {COVERAGE_PENDING}.
        </p>
        <fieldset disabled aria-label="Intervalo de meses" aria-describedby="period-availability">
          <div className={styles.monthInputs}>
            <label>
              Ano
              <input type="number" disabled />
            </label>
            <label>
              Mês inicial
              <input type="month" disabled />
            </label>
            <label>
              Mês final
              <input type="month" disabled />
            </label>
          </div>
          <div className={styles.quarters} role="group" aria-label="Trimestres">
            {[1, 2, 3, 4].map((quarter) => (
              <label key={quarter}>
                <input
                  type="checkbox"
                  name="quarter"
                  value={quarter}
                  disabled
                  title={COVERAGE_PENDING}
                  aria-describedby="period-availability"
                />
                <span>{quarter}º trimestre</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={styles.podium} aria-labelledby="ranking-podium-title">
        <SectionHeading id="ranking-podium-title" title="Pódio das parcerias" density="compact" />
        <div className={styles.podiumGrid}>
          {PODIUM.map((medal) => (
            <AnalyticsCard
              key={medal}
              className={styles.podiumEntry}
              density="compact"
              aria-label={`${medal}: resultado indisponível`}
            >
              <h3>
                <Medal size={22} aria-hidden="true" />
                {medal}
              </h3>
              <dl>
                {["Imobiliária", "VGV", "Contratos", "Próximo alvo", "Diferença ao alvo"].map(
                  (label) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <PendingValue />
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </AnalyticsCard>
          ))}
        </div>
      </section>

      <PendingRanking kind="imobs" />
      <PendingRanking kind="developments" />
    </ManagementPage>
  );
}
