import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Settings2,
  Trophy,
  UsersRound,
  WalletCards,
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
    href: "/app/configuracoes/metas",
    title: "Metas do funil",
    description: "Defina conversões, metas mensais e capacidade da equipe.",
    detail: "Planejamento de vendas",
    icon: BarChart3,
  },
  {
    href: "/app/configuracoes/metas/parcerias",
    title: "Metas de parcerias",
    description: "Organize os objetivos do canal e a produção das imobiliárias.",
    detail: "Planejamento de parcerias",
    icon: UsersRound,
  },
  {
    href: "/app/configuracoes/metas/pontos",
    title: "Metas de pontos",
    description: "Ajuste os pesos e objetivos de cada atividade comercial.",
    detail: "Regras de pontuação",
    icon: Trophy,
  },
] as const satisfies ReadonlyArray<{
  href: string;
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
        description="Centralize metas e regras comerciais em um único ponto."
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
          <p className={managementStyles.sectionKicker}>Gestão comercial</p>
          <h2
            id="settings-governance-title"
            className="mt-1 text-2xl font-semibold text-[var(--analytics-ink)]"
          >
            Planejamento da operação
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
            Metas do funil, parcerias e pontuação da equipe.
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
                  ? "As áreas autorizadas estão disponíveis para edição."
                  : "As áreas permanecem disponíveis apenas para consulta."}
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
            Edição de configurações indisponível.
          </strong>{" "}
          As áreas permanecem visíveis somente para referência.
        </div>
      ) : null}

      <section aria-labelledby="settings-areas-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="settings-areas-title" className={managementStyles.sectionTitle}>
              Escolha o que deseja configurar
            </h2>
            <p className={managementStyles.sectionDescription}>
              Cada área reúne seus campos de planejamento e regras comerciais.
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

      <section aria-label="Recurso de marketing">
        {canManage ? (
          <Link
            href="/app/configuracoes/recurso-mkt"
            prefetch={false}
            aria-label="Recurso MKT"
            className={`${styles.marketingResource} ${managementStyles.panel} group no-underline`}
          >
            <span className={managementStyles.iconFrame} aria-hidden="true">
              <WalletCards />
            </span>
            <span className={styles.marketingResourceCopy}>
              <strong>Recurso MKT</strong>
              <span>Fundo de investimento de Marketing e distribuição dos recursos.</span>
            </span>
            <span className={styles.marketingResourceAction}>
              Abrir <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
        ) : (
          <div className={`${styles.marketingResource} ${managementStyles.panel} opacity-80`}>
            <span className={managementStyles.iconFrame} aria-hidden="true">
              <WalletCards />
            </span>
            <span className={styles.marketingResourceCopy}>
              <strong>Recurso MKT</strong>
              <span>Fundo de investimento de Marketing e distribuição dos recursos.</span>
            </span>
            <span className={styles.marketingResourceAction}>Indisponível</span>
          </div>
        )}
      </section>
    </ManagementPage>
  );
}
