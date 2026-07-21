/**
 * /unauthorized — neutral access-denied surface (M6.2).
 *
 * Public route, intentionally OUTSIDE the (protected) route group: it must not
 * require a session and must not call any authorization guard. It is the
 * FORBIDDEN destination of lib/authorization/enforce.ts, so it cannot depend on
 * that module (which would require a session and could redirect back).
 *
 * Deliberately generic: never names the missing permission, role, email, user
 * id, or any internal detail — no enumeration surface.
 */

import Link from "next/link";

export const metadata = {
  title: "Acesso não autorizado",
};

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Acesso não autorizado</h1>
        <p className="mt-3 text-slate-600">Você não tem permissão para acessar esta área.</p>
        <p className="mt-2 text-sm text-slate-500">
          Caso acredite que isso seja um erro, solicite revisão de acesso ao responsável pelo
          sistema.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800"
          >
            Voltar para o início
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Ir para login
          </Link>
        </div>
      </div>
    </main>
  );
}
