import Link from "next/link";

import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";

export const metadata = {
  title: "Área administrativa",
};

export default async function AdminHomePage() {
  const context = await enforcePermission("admin.access");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-slate-900">Área administrativa</h1>
        <p className="mt-2 text-slate-600">Gestão centralizada de acesso e navegação.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {hasPermission(context, "users.view") ? (
            <Link
              href="/admin/usuarios"
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
            >
              <h2 className="font-medium text-slate-900">Usuários e acessos</h2>
              <p className="mt-1 text-sm text-slate-600">
                Atribua papéis e configure exceções de permissão auditadas.
              </p>
            </Link>
          ) : null}
          {hasPermission(context, "pages.manage") ? (
            <Link
              href="/admin/paginas"
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
            >
              <h2 className="font-medium text-slate-900">Catálogo de páginas</h2>
              <p className="mt-1 text-sm text-slate-600">
                Controle quais superfícies aparecem na navegação autorizada.
              </p>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
