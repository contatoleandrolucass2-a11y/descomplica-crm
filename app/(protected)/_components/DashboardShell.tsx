"use client";

import {
  CalendarDays,
  CircleDollarSign,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { NavigationItem } from "@/lib/navigation/presentation";

import { AppPageIcon } from "./AppPageIcon";
import styles from "./ProtectedShell.module.css";

const icons = {
  "crm.dashboard": LayoutDashboard,
  "crm.stage.opportunities": Target,
  "crm.stage.appointments": CalendarDays,
  "crm.stage.visits": Users,
  "crm.stage.folders": FolderOpen,
  "crm.stage.sales": CircleDollarSign,
  "crm.repasse": Handshake,
};

export function DashboardShell({
  pages,
  children,
}: {
  pages: NavigationItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  if (pathname !== "/app/etapas/agendamentos") return children;
  // Only the server-authorized catalog supplies destinations, including profiles
  // with access to a stage but without access to the overview.
  const dashboardPages = pages
    .filter((page) => page.key === "crm.dashboard" || page.parentKey === "crm.dashboard")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activePage = dashboardPages.find((page) => pathname === page.path);

  if (!activePage) return children;

  const toggleLabel = collapsed
    ? "Expandir navegação do Dashboard"
    : "Recolher navegação do Dashboard";

  return (
    <div className={styles.dashboardShell} data-dashboard-shell data-collapsed={collapsed}>
      <aside className={styles.dashboardSidebar} aria-label="Dashboard">
        <button
          type="button"
          className={styles.dashboardToggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls="dashboard-navigation"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={20} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={20} />
          )}
          <span className={styles.dashboardLabel}>Dashboard</span>
        </button>
        <nav id="dashboard-navigation" aria-label="Páginas do Dashboard">
          <ul className={styles.dashboardLinks}>
            {dashboardPages.map((page) => {
              const label = page.key === "crm.dashboard" ? "Visão Geral" : page.name;
              const Icon = icons[page.key as keyof typeof icons];
              return (
                <li key={page.key}>
                  <Link
                    href={page.path}
                    prefetch={false}
                    className={styles.dashboardLink}
                    aria-label={label}
                    aria-current={page.key === activePage.key ? "page" : undefined}
                    title={label}
                  >
                    <span className={styles.dashboardIcon}>
                      {Icon ? (
                        <Icon aria-hidden="true" size={20} />
                      ) : (
                        <AppPageIcon pageKey={page.key} />
                      )}
                    </span>
                    <span className={styles.dashboardLabel}>{label}</span>
                    {collapsed ? (
                      <span className={styles.dashboardTooltip} aria-hidden="true">
                        {label}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className={styles.dashboardContent}>{children}</div>
    </div>
  );
}
