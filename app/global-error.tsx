"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50">
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm font-semibold text-red-700">Falha de carregamento</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
              Não foi possível carregar esta página
            </h1>
            <p className="mt-4 text-slate-600">
              Ocorreu um erro inesperado. Tente novamente; se o problema continuar, informe o código
              abaixo ao suporte.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-7 min-h-11 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
            >
              Tentar novamente
            </button>
            <details className="mt-6 text-xs text-slate-500">
              <summary className="mx-auto w-fit cursor-pointer underline underline-offset-2">
                Detalhes técnicos
              </summary>
              <code className="mt-2 block font-mono">
                Código para suporte: {error.digest ?? "APP-500"}
              </code>
            </details>
          </section>
        </main>
      </body>
    </html>
  );
}
