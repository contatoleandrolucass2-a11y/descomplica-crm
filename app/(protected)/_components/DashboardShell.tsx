"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleDollarSign,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

type DashboardSidebarContextValue = {
  setUpdatedAt: (value: string) => void;
};

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null);

export function useDashboardSidebar() {
  return useContext(DashboardSidebarContext);
}

export function DashboardShell({
  pages,
  children,
}: {
  pages: NavigationItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname !== "/app/etapas/agendamentos") return children;
  // Only the server-authorized catalog supplies destinations, including profiles
  // with access to a stage but without access to the overview.
  const dashboardPages = pages
    .filter((page) => page.key === "crm.dashboard" || page.parentKey === "crm.dashboard")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activePage = dashboardPages.find((page) => pathname === page.path);

  if (!activePage) return children;

  return (
    <AppointmentsDashboardShell pages={dashboardPages} activePageKey={activePage.key}>
      {children}
    </AppointmentsDashboardShell>
  );
}

function AppointmentsDashboardShell({
  pages: dashboardPages,
  activePageKey,
  children,
}: {
  pages: NavigationItem[];
  activePageKey: string;
  children: ReactNode;
}) {
  // Mount only on the appointments route, so pointer/focus state cannot remain
  // expanded when navigating away and returning through browser history.
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const collapsed = !hovered && !keyboardFocused;
  const [updatedAt, setUpdatedAt] = useState("");
  const contextValue = useMemo(() => ({ setUpdatedAt }), [setUpdatedAt]);

  function guide(direction: "previous" | "next") {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-appointments-section]"),
    ).filter((section) => section.getClientRects().length > 0);
    if (!sections.length) return;

    const safeTop =
      (document.querySelector<HTMLElement>("[data-protected-topbar]")?.getBoundingClientRect()
        .bottom ?? 0) + 12;
    const target =
      direction === "next"
        ? (sections.find((section) => section.getBoundingClientRect().top > safeTop + 24) ??
          sections.at(-1))
        : ([...sections]
            .reverse()
            .find((section) => section.getBoundingClientRect().top < safeTop - 24) ?? sections[0]);
    if (!target) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => target.focus({ preventScroll: true }), reducedMotion ? 0 : 260);
  }

  return (
    <DashboardSidebarContext.Provider value={contextValue}>
      <div className={styles.dashboardShell} data-dashboard-shell data-collapsed={collapsed}>
        <aside
          className={styles.dashboardSidebar}
          aria-label="Dashboard"
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") setHovered(true);
          }}
          onPointerLeave={() => setHovered(false)}
          onPointerCancel={() => setHovered(false)}
          onPointerDownCapture={() => setKeyboardFocused(false)}
          onFocusCapture={(event) => {
            if (event.target.matches(":focus-visible")) setKeyboardFocused(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false);
          }}
        >
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
                      aria-current={page.key === activePageKey ? "page" : undefined}
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
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className={styles.dashboardGuide} aria-label="Guia das seções da página">
            <button
              type="button"
              onClick={() => guide("previous")}
              aria-label="Ir para a seção anterior"
              title="Ir para a seção anterior"
            >
              <ArrowUp aria-hidden="true" size={18} />
              <span className={styles.dashboardLabel}>Subir seção</span>
            </button>
            <button
              type="button"
              onClick={() => guide("next")}
              aria-label="Ir para a próxima seção"
              title="Ir para a próxima seção"
            >
              <ArrowDown aria-hidden="true" size={18} />
              <span className={styles.dashboardLabel}>Descer seção</span>
            </button>
          </div>
        </aside>
        <div className={styles.dashboardContent} data-dashboard-content>
          {updatedAt ? (
            <p className={styles.dashboardUpdatedAt} data-dashboard-updated-at>
              <span>Atualizado em</span>
              <strong>{updatedAt}</strong>
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </DashboardSidebarContext.Provider>
  );
}
