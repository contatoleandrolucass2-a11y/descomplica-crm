/**
 * /app — first protected content page (M6.3).
 *
 * Lives under the (protected) route group; protection is centralized in
 * the parent layout.
 */

export const metadata = {
  title: "Painel inicial",
};

import { enforcePermission } from "@/lib/authorization/enforce";

export default async function AppHomePage() {
  await enforcePermission("crm.dashboard.view");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-slate-900">Painel inicial</h1>
        <p className="mt-2 text-slate-600">Área protegida do Descomplica Platform.</p>

        <div className="mt-10 grid gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Ambiente protegido</h2>
            <p className="mt-1 text-sm text-slate-600">
              Esta área só pode ser acessada por usuários autenticados e autorizados.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Base de autorização ativa</h2>
            <p className="mt-1 text-sm text-slate-600">
              O acesso é validado no servidor antes da página ser exibida.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-medium text-slate-900">Próximas áreas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use a navegação autorizada acima para acessar etapas, ranking e configurações.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
