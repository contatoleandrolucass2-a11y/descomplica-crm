import { ArrowRight, PanelsTopLeft, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";

export const metadata = {
  title: "Área administrativa",
};

export default async function AdminHomePage() {
  const context = await enforcePermission("admin.access");

  return (
    <ManagementPage>
      <ManagementPageHeader
        eyebrow="Governança"
        title="Área administrativa"
        description="Gestão centralizada de acesso e navegação, limitada às permissões efetivas da sessão."
        status={<ManagementStatusBadge>Acesso administrativo</ManagementStatusBadge>}
      />

      <section className={`${managementStyles.panel} ${managementStyles.panelPadded}`}>
        <div className={managementStyles.sectionHeader}>
          <div>
            <p className={managementStyles.sectionKicker}>Ferramentas autorizadas</p>
            <h2 className={managementStyles.sectionTitle}>Gestão do CRM</h2>
            <p className={managementStyles.sectionDescription}>
              Cada destino mantém sua própria validação no servidor e no banco.
            </p>
          </div>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <ShieldCheck />
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {hasPermission(context, "users.view") ? (
            <Link
              href="/admin/usuarios"
              prefetch={false}
              className={`${managementStyles.panel} ${managementStyles.panelPadded} group flex min-h-36 items-start gap-3 no-underline transition hover:border-[var(--analytics-cyan-strong)]`}
            >
              <span className={managementStyles.iconFrame} aria-hidden="true">
                <UsersRound />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-lg text-[var(--analytics-ink)]">
                  Usuários e acessos
                </strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--analytics-muted)]">
                  Atribua papéis e configure exceções de permissão auditadas.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--analytics-cyan-strong)]">
                  Abrir gestão <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </span>
            </Link>
          ) : null}
          {hasPermission(context, "pages.manage") ? (
            <Link
              href="/admin/paginas"
              prefetch={false}
              className={`${managementStyles.panel} ${managementStyles.panelPadded} group flex min-h-36 items-start gap-3 no-underline transition hover:border-[var(--analytics-cyan-strong)]`}
            >
              <span className={managementStyles.iconFrame} aria-hidden="true">
                <PanelsTopLeft />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-lg text-[var(--analytics-ink)]">
                  Catálogo de páginas
                </strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--analytics-muted)]">
                  Controle quais superfícies aparecem na navegação autorizada.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--analytics-cyan-strong)]">
                  Abrir catálogo <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>
    </ManagementPage>
  );
}
