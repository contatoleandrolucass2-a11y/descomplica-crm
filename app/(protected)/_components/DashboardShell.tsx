"use client";

import {
  ArrowDown,
  ArrowUp,
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
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const [collapsed, setCollapsed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const contextValue = useMemo(() => ({ setUpdatedAt }), [setUpdatedAt]);
  const sidebar = useMemo(
    () =>
      pathname === "/app/etapas/agendamentos"
        ? {
            rootKey: "crm.dashboard",
            label: "Dashboard",
            navigationLabel: "do Dashboard",
            guide: true,
          }
        : pathname === "/app/links-uteis" || pathname.startsWith("/app/links-uteis/")
          ? {
              rootKey: "crm.useful_links",
              label: "Links Úteis",
              navigationLabel: "de Links Úteis",
              guide: false,
            }
          : null,
    [pathname],
  );

  useEffect(() => {
    if (!sidebar || collapsed) return;

    function collapseFromOutside(event: globalThis.PointerEvent) {
      if (!(event.target instanceof Node) || sidebarRef.current?.contains(event.target)) return;
      setCollapsed(true);
    }

    document.addEventListener("pointerdown", collapseFromOutside, true);
    return () => document.removeEventListener("pointerdown", collapseFromOutside, true);
  }, [collapsed, sidebar]);

  if (!sidebar) return children;
  // Only the server-authorized catalog supplies destinations, including profiles
  // with access to a stage but without access to the overview.
  const dashboardPages = pages
    .filter((page) => page.key === sidebar.rootKey || page.parentKey === sidebar.rootKey)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activePage = dashboardPages.find((page) => pathname === page.path);

  if (!activePage) return children;

  const toggleLabel = collapsed
    ? `Expandir navegação ${sidebar.navigationLabel}`
    : `Recolher navegação ${sidebar.navigationLabel}`;

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
        <aside ref={sidebarRef} className={styles.dashboardSidebar} aria-label={sidebar.label}>
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
            <span className={styles.dashboardLabel}>Ocultar</span>
          </button>
          <nav id="dashboard-navigation" aria-label={`Páginas de ${sidebar.label}`}>
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
          {sidebar.guide ? (
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
          ) : null}
          {sidebar.guide && updatedAt ? (
            <p className={styles.dashboardUpdatedAt}>
              <span>Atualizado em</span>
              <strong>{updatedAt}</strong>
            </p>
          ) : null}
        </aside>
        <div className={styles.dashboardContent} data-dashboard-content>
          {children}
        </div>
      </div>
    </DashboardSidebarContext.Provider>
  );
}
