import Link from "next/link";

import {
  AnalyticsCard,
  DataState,
  PageHeader,
  SectionHeading,
} from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";

export const metadata = { title: "Configurações" };

const SETTINGS = [
  {
    href: "/app/configuracoes/metas",
    badge: "Funil comercial",
    title: "Metas do funil",
    description: "Defina metas mensais, semanais e diárias para acompanhar o ritmo comercial.",
    detail: "Planejamento de vendas",
  },
  {
    href: "/app/configuracoes/metas/parcerias",
    badge: "Canal parceiro",
    title: "Metas de parcerias",
    description: "Organize os objetivos do canal de parceiros e mantenha a cadência alinhada.",
    detail: "Planejamento de parcerias",
  },
  {
    href: "/app/configuracoes/metas/pontos",
    badge: "Ranking",
    title: "Metas de pontos",
    description: "Ajuste pesos e pontuações usados para orientar o ranking comercial.",
    detail: "Regras de pontuação",
  },
] as const;

type Setting = (typeof SETTINGS)[number];

function SettingsCard({ setting, canManage }: { setting: Setting; canManage: boolean }) {
  return (
    <AnalyticsCard
      tone={canManage ? "default" : "subtle"}
      className={`h-full ${
        canManage
          ? "transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1"
          : "opacity-80"
      }`}
    >
      <div className="flex h-full min-h-64 flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase">
            {setting.badge}
          </span>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-950 text-lg font-semibold text-white"
            aria-hidden="true"
          >
            {canManage ? "→" : "—"}
          </span>
        </div>

        <h3 className="mt-8 text-2xl font-semibold tracking-tight text-slate-950">
          {setting.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">{setting.description}</p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm">
          <span className="text-slate-500">{setting.detail}</span>
          <span className="font-semibold text-slate-900">
            {canManage ? "Abrir" : "Somente leitura"}
          </span>
        </div>
      </div>
    </AnalyticsCard>
  );
}

export default async function SettingsPage() {
  const context = await enforcePermission("crm.settings.view");
  const canManage = hasPermission(context, "crm.settings.manage");

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl gap-7">
        <PageHeader
          eyebrow="Governança comercial"
          title="Configurações do CRM"
          description="Centralize metas e regras comerciais em um único ponto de administração."
          meta={
            <div>
              <p className="text-xs tracking-wide text-slate-300 uppercase">Nível de acesso</p>
              <strong className="mt-1 block text-base text-white">
                {canManage ? "Gestão autorizada" : "Somente leitura"}
              </strong>
              <p className="mt-2 text-sm text-slate-300">
                {canManage
                  ? "As áreas administrativas estão disponíveis para edição."
                  : "Os atalhos administrativos estão ocultos para este perfil."}
              </p>
            </div>
          }
        />

        {!canManage ? (
          <DataState
            variant="unavailable"
            compact
            title="Configurações administrativas indisponíveis"
            description="Você possui acesso de leitura, mas não pode alterar configurações. As áreas abaixo permanecem visíveis apenas para referência."
          />
        ) : null}

        <section aria-labelledby="settings-areas-title">
          <SectionHeading
            id="settings-areas-title"
            kicker="Áreas administrativas"
            title="Escolha o que deseja configurar"
            description="Cada área concentra uma parte específica do planejamento e das regras comerciais."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {SETTINGS.map((setting) =>
              canManage ? (
                <Link
                  key={setting.href}
                  href={setting.href}
                  className="group block rounded-3xl focus-visible:outline-offset-4"
                >
                  <SettingsCard setting={setting} canManage />
                </Link>
              ) : (
                <SettingsCard key={setting.href} setting={setting} canManage={false} />
              ),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
