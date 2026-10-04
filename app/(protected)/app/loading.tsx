import { AnalyticsSkeleton } from "./_components/analytics";

export default function AppLoading() {
  return (
    <main className="min-w-0 px-3 py-5 sm:px-5 sm:py-7">
      <div
        className="mx-auto grid max-w-[100rem] min-w-0 grid-cols-1 gap-5"
        aria-label="Carregando área analítica"
      >
        <AnalyticsSkeleton label="Carregando cabeçalho comercial" />
        <AnalyticsSkeleton label="Carregando filtros autorizados" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <AnalyticsSkeleton key={index} label={`Carregando indicador ${index + 1} de 5`} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
          <AnalyticsSkeleton label="Carregando funil do período" />
          <AnalyticsSkeleton label="Carregando resumo comercial" />
        </div>
      </div>
    </main>
  );
}
