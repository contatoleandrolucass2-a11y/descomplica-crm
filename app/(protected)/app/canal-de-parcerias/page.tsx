import { enforcePermission } from "@/lib/authorization/enforce";

import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  PageHeader,
  SectionHeading,
  type AnalyticsColumn,
} from "../_components/analytics";

export const metadata = { title: "Canal de Parcerias" };

const INTEGRATION_PENDING_LABEL = "Dado indisponível — integração pendente";

interface ImobRankingRow {
  id: string;
  position: string;
  imob: string;
  performance: string;
}

interface DevelopmentRankingRow {
  id: string;
  position: string;
  development: string;
  performance: string;
}

const imobColumns: Array<AnalyticsColumn<ImobRankingRow>> = [
  { key: "position", label: "Posição", render: (row) => row.position },
  { key: "imob", label: "IMOB parceira", render: (row) => row.imob },
  {
    key: "performance",
    label: "Desempenho",
    align: "right",
    render: (row) => row.performance,
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
    key: "performance",
    label: "Desempenho",
    align: "right",
    render: (row) => row.performance,
  },
];

function DisabledFilter({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label}: ${INTEGRATION_PENDING_LABEL}`}
      className="flex min-h-11 w-full min-w-56 cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-500 opacity-80"
    >
      <span>{INTEGRATION_PENDING_LABEL}</span>
      <span aria-hidden="true" className="ml-3 text-base">
        ⌄
      </span>
    </button>
  );
}

function PodiumPlaceholder({ featured = false }: { featured?: boolean }) {
  return (
    <AnalyticsCard
      tone={featured ? "navy" : "default"}
      className={`relative flex min-h-72 flex-col items-center justify-center overflow-hidden text-center ${
        featured ? "lg:min-h-80" : "lg:min-h-72"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-24 place-items-center rounded-full border border-dashed ${
          featured
            ? "border-cyan-200/50 bg-white/5 ring-8 ring-white/5"
            : "border-slate-300 bg-slate-50 ring-8 ring-slate-100"
        }`}
      >
        <span
          className={`block h-8 w-11 rounded-full ${featured ? "bg-cyan-200/20" : "bg-slate-200"}`}
        />
      </span>
      <p
        className={`mt-7 text-xs font-semibold tracking-[0.16em] uppercase ${
          featured ? "text-cyan-300" : "text-cyan-700"
        }`}
      >
        Posição do pódio
      </p>
      <h3
        className={`mt-3 max-w-64 text-lg font-semibold ${featured ? "text-white" : "text-slate-950"}`}
      >
        {INTEGRATION_PENDING_LABEL}
      </h3>
      <p
        className={`mt-3 max-w-72 text-sm leading-6 ${
          featured ? "text-slate-300" : "text-slate-600"
        }`}
      >
        A posição, o nome e o resultado serão apresentados somente após a integração autorizada.
      </p>
    </AnalyticsCard>
  );
}

export default async function PartnershipsChannelPage() {
  await enforcePermission("crm.partnerships.view");

  const imobRows: ImobRankingRow[] = [];
  const developmentRows: DevelopmentRankingRow[] = [];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
        <PageHeader
          eyebrow="Canal de Parcerias"
          title="Performance das parcerias"
          description="Uma visão dedicada ao reconhecimento das IMOBs parceiras e dos empreendimentos com melhor desempenho no canal."
          meta={
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte do ranking</dt>
                <dd className="mt-1 font-semibold text-white">{INTEGRATION_PENDING_LABEL}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">
                  Última atualização
                </dt>
                <dd className="mt-1 font-semibold text-white">{INTEGRATION_PENDING_LABEL}</dd>
              </div>
            </dl>
          }
          footer={
            <p className="flex items-center gap-3 text-sm text-slate-200">
              <span className="size-2.5 rounded-full bg-amber-300" aria-hidden="true" />
              {INTEGRATION_PENDING_LABEL}
            </p>
          }
        />

        <FilterBar
          label="Filtros do Canal de Parcerias indisponíveis"
          unavailableDimensions={["Período", "IMOB", "Empreendimento"]}
        >
          <FilterGroup label="Período">
            <DisabledFilter label="Período" />
          </FilterGroup>
          <FilterGroup label="Visão do ranking">
            <DisabledFilter label="Visão do ranking" />
          </FilterGroup>
        </FilterBar>

        <section aria-labelledby="partnership-podium-title">
          <SectionHeading
            id="partnership-podium-title"
            kicker="Ranking de IMOBs"
            title="Pódio das parcerias"
            description="A composição visual está pronta para receber o ranking oficial, sem antecipar nomes, posições ou resultados."
          />
          <div className="grid items-end gap-4 lg:grid-cols-3">
            <PodiumPlaceholder />
            <PodiumPlaceholder featured />
            <PodiumPlaceholder />
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="min-w-0" aria-labelledby="imob-ranking-title">
            <AnalyticsCard className="h-full">
              <SectionHeading
                id="imob-ranking-title"
                kicker="Ranking de IMOBs"
                title="Desempenho das parceiras"
                description="Detalhamento reservado para os dados oficiais da integração."
              />
              <AnalyticsTable
                caption="Ranking de IMOBs parceiras"
                rows={imobRows}
                columns={imobColumns}
                rowKey={(row) => row.id}
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
            <AnalyticsCard className="h-full">
              <SectionHeading
                id="development-ranking-title"
                kicker="Ranking de empreendimentos"
                title="Destaques por empreendimento"
                description="Detalhamento reservado para os dados oficiais da integração."
              />
              <AnalyticsTable
                caption="Ranking de empreendimentos do canal"
                rows={developmentRows}
                columns={developmentColumns}
                rowKey={(row) => row.id}
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
      </div>
    </main>
  );
}
