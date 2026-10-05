import { ArrowRight, PanelsTopLeft, UsersRound } from "lucide-react";
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
    <ManagementPage className="admin-canvas admin-home-page">
      <ManagementPageHeader
        title="Área administrativa"
        description="Gestão centralizada de acesso e navegação."
        status={<ManagementStatusBadge>Acesso administrativo</ManagementStatusBadge>}
      />

      <section className="admin-home-links" aria-labelledby="admin-home-links-title">
        <h2 id="admin-home-links-title" className="sr-only">
          Gestão do CRM
        </h2>
        <div className="admin-home-grid">
          {hasPermission(context, "users.view") ? (
            <Link
              href="/admin/usuarios"
              prefetch={false}
              className={`${managementStyles.panel} ${managementStyles.panelPadded} admin-home-card group flex items-start gap-3 no-underline transition hover:border-[var(--analytics-cyan-strong)]`}
            >
              <span className={managementStyles.iconFrame} aria-hidden="true">
                <UsersRound />
              </span>
              <span className="admin-home-card-copy min-w-0 flex-1">
                <strong className="block text-lg text-[var(--analytics-ink)]">
                  Usuários e acessos
                </strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--analytics-muted)]">
                  Atribua papéis e configure exceções de permissão auditadas.
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="admin-home-card-arrow size-5" />
            </Link>
          ) : null}
          {hasPermission(context, "pages.manage") ? (
            <Link
              href="/admin/paginas"
              prefetch={false}
              className={`${managementStyles.panel} ${managementStyles.panelPadded} admin-home-card group flex items-start gap-3 no-underline transition hover:border-[var(--analytics-cyan-strong)]`}
            >
              <span className={managementStyles.iconFrame} aria-hidden="true">
                <PanelsTopLeft />
              </span>
              <span className="admin-home-card-copy min-w-0 flex-1">
                <strong className="block text-lg text-[var(--analytics-ink)]">
                  Catálogo de páginas
                </strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--analytics-muted)]">
                  Controle quais superfícies aparecem na navegação autorizada.
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="admin-home-card-arrow size-5" />
            </Link>
          ) : null}
        </div>
      </section>
    </ManagementPage>
  );
}
