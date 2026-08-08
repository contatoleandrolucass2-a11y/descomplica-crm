import { enforcePermission } from "@/lib/authorization/enforce";
import { getPermissionLabel } from "@/lib/authorization/permissions";
import { getManageablePages } from "@/lib/navigation/pages";

import { setPageVisibilityAction } from "./actions";

export const metadata = { title: "Catálogo de páginas" };

export default async function PagesAdminPage() {
  await enforcePermission("pages.manage");
  const pages = await getManageablePages();

  return (
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold text-slate-950">Catálogo de páginas</h1>
        <p className="mt-2 text-slate-600">
          Ative ou desative a navegação. A permissão da rota continua sendo validada no servidor.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="divide-y divide-slate-200">
            {pages.map((page) => {
              const action = setPageVisibilityAction.bind(null, page.key, !page.isActive);

              return (
                <section
                  key={page.key}
                  className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,auto)] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium text-slate-950">{page.name}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          page.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {page.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{page.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {page.path} · {getPermissionLabel(page.permissionKey)}
                    </p>
                  </div>
                  <form action={action} className="flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor={`reason-${page.key}`}>
                      Motivo
                    </label>
                    <input
                      id={`reason-${page.key}`}
                      name="reason"
                      maxLength={240}
                      placeholder="Motivo (opcional)"
                      className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                    <button
                      type="submit"
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                        page.isActive
                          ? "bg-slate-700 hover:bg-slate-800"
                          : "bg-emerald-700 hover:bg-emerald-800"
                      }`}
                    >
                      {page.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
