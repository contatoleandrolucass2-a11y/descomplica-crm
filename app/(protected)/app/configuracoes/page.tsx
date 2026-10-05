import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Megaphone,
  Settings2,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";

import styles from "./ConfigurationCanvas.module.css";

export const metadata = { title: "Configurações" };

const SETTINGS = [
  {
    href: "/app/configuracoes/recurso-mkt",
    badge: "Marketing",
    title: "Recurso MKT",
    description: "Fundo de investimento de Marketing e distribuição dos recursos por responsável.",
    detail: "Volta ao Caixa",
    icon: Megaphone,
  },
  {
    href: "/app/configuracoes/metas",
    badge: "Funil comercial",
    title: "Metas do funil",
    description: "Defina metas mensais, semanais e diárias para acompanhar o ritmo comercial.",
    detail: "Planejamento de vendas",
    icon: BarChart3,
  },
  {
    href: "/app/configuracoes/metas/parcerias",
    badge: "Canal parceiro",
    title: "Metas de parcerias",
    description: "Organize os objetivos do canal de parceiros e mantenha a cadência alinhada.",
    detail: "Planejamento de parcerias",
    icon: UsersRound,
  },
  {
    href: "/app/configuracoes/metas/pontos",
    badge: "Ranking",
    title: "Metas de pontos",
    description: "Ajuste pesos e pontuações usados para orientar o ranking comercial.",
    detail: "Regras de pontuação",
    icon: Trophy,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  badge: string;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
}>;

type Setting = (typeof SETTINGS)[number];

function SettingsCard({ setting, canManage }: { setting: Setting; canManage: boolean }) {
  const Icon = setting.icon;

  return (
    <article
      className={`${styles.settingsCard} ${managementStyles.panel} h-full p-4 ${
        canManage ? "group-hover:border-cyan-500 group-focus-visible:border-cyan-500" : "opacity-80"
      }`}
    >
      <div className="flex h-full min-h-56 flex-col">
        <div className="flex items-start gap-3">
          <span className={managementStyles.iconFrame}>
            <Icon aria-hidden="true" />
          </span>
          <span className="pt-2 text-[0.68rem] font-bold tracking-[0.11em] text-[var(--analytics-cyan-strong)] uppercase">
            {setting.badge}
          </span>
        </div>

        <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--analytics-ink)]">
          {setting.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
          {setting.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--analytics-line)] pt-4 text-sm">
          <span className="text-[var(--analytics-muted)]">{setting.detail}</span>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-full border ${
              canManage
                ? "border-[var(--analytics-cyan-strong)] text-[var(--analytics-cyan-strong)]"
                : "border-[var(--analytics-line)] text-[var(--analytics-muted)]"
            }`}
            aria-hidden="true"
          >
            {canManage ? <ArrowRight size={17} /> : "—"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default async function SettingsPage() {
  const context = await enforcePermission("crm.settings.view");
  const canManage = hasPermission(context, "crm.settings.manage");

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        title="Configurações do CRM"
        description="Centralize metas e regras comerciais em um único ponto de administração."
        status={
          <ManagementStatusBadge tone={canManage ? "positive" : "warning"}>
            {canManage ? "Gestão autorizada" : "Somente leitura"}
          </ManagementStatusBadge>
        }
      />

      <section
        className={`${styles.settingsGovernance} ${managementStyles.panel} ${managementStyles.panelStrong} grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)] md:items-center`}
        aria-labelledby="settings-governance-title"
      >
        <div>
          <p className={managementStyles.sectionKicker}>Governança comercial</p>
          <h2
            id="settings-governance-title"
            className="mt-1 text-2xl font-semibold text-[var(--analytics-ink)]"
          >
            Configurações do CRM
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
            Centralize metas e regras comerciais em um único ponto de administração.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] p-4">
          <div className="flex items-start gap-3">
            <span className={managementStyles.iconFrame}>
              <Settings2 aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.68rem] font-bold tracking-wide text-[var(--analytics-muted)] uppercase">
                Nível de acesso
              </p>
              <strong className="mt-1 block text-sm text-[var(--analytics-ink)]">
                {canManage ? "Gestão autorizada" : "Somente leitura"}
              </strong>
              <p className="mt-1 text-xs leading-5 text-[var(--analytics-muted)]">
                {canManage
                  ? "As áreas administrativas estão disponíveis para edição."
                  : "Os atalhos administrativos estão ocultos para este perfil."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {!canManage ? (
        <div
          className={`${managementStyles.panel} px-4 py-3 text-sm text-[var(--analytics-muted)]`}
          role="status"
        >
          <strong className="text-[var(--analytics-ink)]">
            Configurações administrativas indisponíveis.
          </strong>{" "}
          As áreas permanecem visíveis somente para referência.
        </div>
      ) : null}

      <section aria-labelledby="settings-areas-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <p className={managementStyles.sectionKicker}>Áreas administrativas</p>
            <h2 id="settings-areas-title" className={managementStyles.sectionTitle}>
              Escolha o que deseja configurar
            </h2>
            <p className={managementStyles.sectionDescription}>
              Cada área concentra uma parte específica do planejamento e das regras comerciais.
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {SETTINGS.map((setting) =>
            canManage ? (
              <Link
                key={setting.href}
                href={setting.href}
                aria-label={setting.title}
                prefetch={false}
                className="group block rounded-xl no-underline focus-visible:outline-offset-4"
              >
                <SettingsCard setting={setting} canManage />
              </Link>
            ) : (
              <SettingsCard key={setting.href} setting={setting} canManage={false} />
            ),
          )}
        </div>
      </section>
    </ManagementPage>
  );
}
