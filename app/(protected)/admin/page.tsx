/**
 * /admin — protected admin placeholder (M6.4).
 *
 * Protection lives entirely in the parent layout.
 */

export const metadata = {
  title: "Área administrativa",
};

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-slate-900">Área administrativa</h1>
        <p className="mt-2 text-slate-600">Espaço reservado para futuras ferramentas de gestão.</p>

        <div className="mt-10 grid gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Acesso controlado</h2>
            <p className="mt-1 text-sm text-slate-600">
              Esta área é exibida apenas para usuários com acesso administrativo.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Gestão futura</h2>
            <p className="mt-1 text-sm text-slate-600">
              As ferramentas administrativas serão adicionadas conforme o escopo das próximas
              etapas.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Segurança ativa</h2>
            <p className="mt-1 text-sm text-slate-600">
              A autorização é validada no servidor antes da página ser exibida.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
