"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-red-700">Falha de carregamento</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-4 text-slate-600">
          Ocorreu um erro inesperado. Tente novamente; se o problema continuar, informe o código
          abaixo ao suporte.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
          >
            Tentar novamente
          </button>
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Voltar ao início
          </Link>
        </div>
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
  );
}
