import Link from "next/link";

export const metadata = {
  title: "Acesso negado",
};

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-cyan-800">Acesso restrito</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
          Você não possui acesso a esta página
        </h1>
        <p className="mt-4 text-slate-600">
          Sua conta está autenticada, mas o papel ou as exceções atuais não permitem abrir este
          conteúdo. Fale com um administrador se precisar desse acesso.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
          >
            Voltar ao início
          </Link>
        </div>
        <p className="mt-6 font-mono text-xs text-slate-500">Código para suporte: AUTH-403</p>
      </section>
    </main>
  );
}
