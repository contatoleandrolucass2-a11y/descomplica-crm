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
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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

const SIDEBAR_RAIL_WIDTH = 44;
const SIDEBAR_EXPANDED_WIDTH = 136;

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
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellSize, setShellSize] = useState({ width: 0, overlay: false });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const narrow = window.matchMedia("(max-width: 760px)");
    const updateWidth = (width: number) => {
      setShellSize((current) =>
        current.width === width && current.overlay === narrow.matches
          ? current
          : { width, overlay: narrow.matches },
      );
    };
    const updateOverlay = () => {
      setShellSize((current) =>
        current.overlay === narrow.matches ? current : { ...current, overlay: narrow.matches },
      );
    };
    updateWidth(shell.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(shell);
    narrow.addEventListener("change", updateOverlay);
    return () => {
      observer.disconnect();
      narrow.removeEventListener("change", updateOverlay);
    };
  }, []);

  // Preserve the canvas's layout width during hover. Native zoom participates in
  // document flow, so rows and proportions remain stable without a tall empty
  // transformed wrapper or rewriting the user's saved card dimensions.
  const baseWidth = Math.max(1, shellSize.width - SIDEBAR_RAIL_WIDTH);
  const contentScale =
    !collapsed && !shellSize.overlay && shellSize.width > 0
      ? Math.max(1, shellSize.width - SIDEBAR_EXPANDED_WIDTH) / baseWidth
      : 1;
  const surfaceStyle = {
    "--dashboard-layout-width": shellSize.width > 0 ? `${baseWidth}px` : "100%",
    "--dashboard-content-scale": contentScale,
  } as CSSProperties;

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
      <div
        ref={shellRef}
        className={styles.dashboardShell}
        style={
          {
            "--dashboard-sidebar-rail": `${SIDEBAR_RAIL_WIDTH}px`,
            "--dashboard-sidebar-expanded": `${SIDEBAR_EXPANDED_WIDTH}px`,
          } as CSSProperties
        }
        data-dashboard-shell
        data-collapsed={collapsed}
      >
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
                          <Icon aria-hidden="true" size={18} />
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
          <div
            className={styles.dashboardSurface}
            style={surfaceStyle}
            data-dashboard-surface
            data-content-scale={contentScale}
          >
            {updatedAt ? (
              <p className={styles.dashboardUpdatedAt} data-dashboard-updated-at>
                <span>Atualizado em</span>
                <strong>{updatedAt}</strong>
              </p>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </DashboardSidebarContext.Provider>
  );
}
