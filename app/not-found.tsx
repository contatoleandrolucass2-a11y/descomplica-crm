import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-cyan-800">Página não encontrada</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
          Este endereço ainda não está disponível
        </h1>
        <p className="mt-4 text-slate-600">
          O endereço pode estar incorreto ou a funcionalidade ainda não foi publicada. Isso é
          diferente de uma restrição de acesso.
        </p>
        <Link
          href="/app"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
        >
          Voltar ao início
        </Link>
        <p className="mt-6 font-mono text-xs text-slate-500">Código para suporte: ROUTE-404</p>
      </section>
    </main>
  );
}
