import { AnalyticsSkeleton } from "./_components/analytics";

export default function AppLoading() {
  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl" aria-label="Carregando área analítica">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <AnalyticsSkeleton key={index} label={`Carregando indicador ${index + 1} de 5`} />
          ))}
        </div>
      </div>
    </main>
  );
}
