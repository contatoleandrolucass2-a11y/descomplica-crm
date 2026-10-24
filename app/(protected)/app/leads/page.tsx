import Link from "next/link";
import { ArrowRight, CalendarClock, Columns3, ListFilter, type LucideIcon } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import { LeadPageShell, LeadSourceNotice } from "./_components/LeadWorkspace";

export const metadata = { title: "Lead" };

const LEAD_AREAS = [
  {
    href: "/app/leads/lista",
    title: "Lista de leads",
    description: "Base para pesquisa, filtros e acompanhamento do trabalho diário.",
    icon: ListFilter,
  },
  {
    href: "/app/leads/atividades",
    title: "Atividades",
    description: "Organização de tarefas, visitas e próximos compromissos.",
    icon: CalendarClock,
  },
  {
    href: "/app/leads/funil",
    title: "Funil",
    description: "Visão das etapas comerciais sem misturar atividade com conversão.",
    icon: Columns3,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}>;

export default async function LeadsHubPage() {
  const context = await enforcePageAccess("/app/leads");
  const pages = await getAuthorizedNavigation(context);
  const authorizedPaths = new Set(pages.map((page) => page.path));
  const visibleAreas = LEAD_AREAS.filter((area) => authorizedPaths.has(area.href));

  return (
    <LeadPageShell
      eyebrow="Operação comercial"
      title="Lead"
      description="Central de acompanhamento dos contatos e oportunidades comerciais."
    >
      <LeadSourceNotice />

      <section aria-labelledby="lead-areas-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-areas-title" className={managementStyles.sectionTitle}>
              Áreas liberadas
            </h2>
            <p className={managementStyles.sectionDescription}>
              Cada área possui permissão própria e respeita os controles de acesso do CRM.
            </p>
          </div>
        </div>

        {visibleAreas.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {visibleAreas.map((area) => {
              const Icon = area.icon;

              return (
                <Link
                  key={area.href}
                  href={area.href}
                  prefetch={false}
                  aria-label={`Abrir ${area.title}`}
                  className="group block rounded-lg no-underline focus-visible:outline-offset-4"
                >
                  <article
                    className={`${managementStyles.panel} h-full p-4 group-hover:border-[var(--analytics-cyan-strong)] group-focus-visible:border-[var(--analytics-cyan-strong)]`}
                  >
                    <div className="flex h-full min-h-44 flex-col">
                      <span className={managementStyles.iconFrame}>
                        <Icon aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold text-[var(--analytics-ink)]">
                        {area.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
                        {area.description}
                      </p>
                      <span className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--analytics-line)] pt-4 text-sm font-semibold text-[var(--analytics-cyan-strong)]">
                        Abrir área
                        <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            className={`${managementStyles.panel} p-4 text-sm text-[var(--analytics-muted)]`}
            role="status"
          >
            Nenhuma área filha está liberada para este perfil.
          </div>
        )}
      </section>
    </LeadPageShell>
  );
}
