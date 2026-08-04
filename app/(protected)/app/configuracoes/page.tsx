import Link from "next/link";

import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";

export const metadata = { title: "Configurações" };

const SETTINGS = [
  ["/app/configuracoes/metas", "Metas do funil", "Metas mensais, semanais e diárias."],
  ["/app/configuracoes/metas/parcerias", "Metas de parcerias", "Objetivos do canal de parceiros."],
  ["/app/configuracoes/metas/pontos", "Metas de pontos", "Pesos e pontuação do ranking."],
] as const;

export default async function SettingsPage() {
  const context = await enforcePermission("crm.settings.view");
  const canManage = hasPermission(context, "crm.settings.manage");

  return (
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold text-slate-950">Configurações do CRM</h1>
        <p className="mt-2 text-slate-600">Escolha a área administrativa que deseja configurar.</p>
        {canManage ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SETTINGS.map(([href, name, description]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
              >
                <h2 className="font-medium text-slate-950">{name}</h2>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            Você possui acesso de leitura, mas não pode alterar configurações.
          </p>
        )}
      </div>
    </main>
  );
}
