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
import {
  APPOINTMENTS_REFERENCE_WIDTH,
  useAppointmentsPresentation,
} from "./appointments-presentation";
import styles from "./ProtectedShell.module.css";

const icons = {
  "crm.dashboard": LayoutDashboard,
  "crm.stage.opportunities": Target,
  "crm.stage.appointments": CalendarDays,
  "crm.stage.visits": Users,
  "crm.stage.folders": FolderOpen,
  "crm.stage.sales": CircleDollarSign,
  "crm.repasse": Handshake,
  "crm.productive_team": Users,
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
  // Only the server-authorized catalog supplies destinations, including profiles
  // with access to a stage but without access to the overview.
  const dashboardPages = pages
    .filter((page) => page.key === "crm.dashboard" || page.parentKey === "crm.dashboard")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activePage = dashboardPages.find((page) => pathname === page.path);

  if (!activePage) return children;

  return (
    <AppointmentsDashboardShell
      key={pathname}
      pages={dashboardPages}
      activePageKey={activePage.key}
    >
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
  // Remount on each Dashboard destination so pointer/focus state resets.
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const collapsed = !hovered && !keyboardFocused;
  const [updatedAt, setUpdatedAt] = useState("");
  const productiveTeam = activePageKey === "crm.productive_team";
  const appointments = activePageKey === "crm.stage.appointments";
  const [appointmentsReady, setAppointmentsReady] = useState(false);
  const appointmentsComposition = appointments && appointmentsReady;
  const [headerHeight, setHeaderHeight] = useState(58);
  const [appointmentsSidebarHeight, setAppointmentsSidebarHeight] = useState<number | null>(null);
  const contextValue = useMemo(() => ({ setUpdatedAt }), [setUpdatedAt]);
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellSize, setShellSize] = useState({ width: 0, overlay: false });

  useEffect(() => {
    const shell = shellRef.current;
    if (!appointments || !shell) return;
    const update = () =>
      setAppointmentsReady(Boolean(shell.querySelector("[data-appointments-dashboard]")));
    update();
    const observer = new MutationObserver(update);
    observer.observe(shell, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appointments]);

  useEffect(() => {
    if (!productiveTeam && !appointments) return;
    const header = document.querySelector<HTMLElement>("[data-protected-topbar]");
    if (!header) return;
    const measure = () => {
      const bounds = header.getBoundingClientRect();
      const shell = shellRef.current;
      const rootZoom =
        appointments && shell && shell.offsetWidth > 0
          ? shell.getBoundingClientRect().width / shell.offsetWidth
          : 1;
      setHeaderHeight(bounds.height / rootZoom);
      if (appointments)
        setAppointmentsSidebarHeight(Math.max(1, (window.innerHeight - bounds.bottom) / rootZoom));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [productiveTeam, appointments, shellSize.width]);

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
  const appointmentsAvailableWidth = Math.max(
    1,
    shellSize.width -
      (!collapsed && !shellSize.overlay ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_RAIL_WIDTH),
  );
  const contentScale =
    appointmentsComposition && shellSize.width > 0
      ? appointmentsAvailableWidth / APPOINTMENTS_REFERENCE_WIDTH
      : !collapsed && !shellSize.overlay && shellSize.width > 0
        ? Math.max(1, shellSize.width - SIDEBAR_EXPANDED_WIDTH) / baseWidth
        : 1;
  const surfaceStyle = {
    "--dashboard-layout-width": appointmentsComposition
      ? `${APPOINTMENTS_REFERENCE_WIDTH}px`
      : shellSize.width > 0
        ? `${baseWidth}px`
        : "100%",
    "--dashboard-content-scale": contentScale,
  } as CSSProperties;
  const presentation = useAppointmentsPresentation({
    enabled: appointmentsComposition,
    root: shellRef,
    surfaceScale: contentScale,
  });

  function guide(direction: "previous" | "next") {
    if (appointments) {
      presentation.guide(direction);
      return;
    }
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
        className={[
          styles.dashboardShell,
          productiveTeam && styles.productiveTeamShell,
          appointments && styles.appointmentsShell,
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          {
            "--dashboard-sidebar-rail": `${SIDEBAR_RAIL_WIDTH}px`,
            "--dashboard-sidebar-expanded": `${SIDEBAR_EXPANDED_WIDTH}px`,
            ...(productiveTeam || appointments
              ? { "--dashboard-header-height": `${headerHeight}px` }
              : {}),
            ...(appointments ? { "--appointments-presentation-scale": contentScale } : {}),
            ...(appointments && appointmentsSidebarHeight !== null
              ? { "--appointments-sidebar-height": `${appointmentsSidebarHeight}px` }
              : {}),
          } as CSSProperties
        }
        data-dashboard-shell
        data-appointments-composition={appointmentsComposition ? "true" : undefined}
        data-collapsed={collapsed}
        data-presentation-active={
          appointments && presentation.activeCardId !== null ? "true" : undefined
        }
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
          {appointments && presentation.activeCardId !== null ? (
            <div
              className={styles.appointmentsPresentationBar}
              aria-label="Apresentação do gráfico"
            >
              <button type="button" onClick={presentation.exit}>
                Visão geral
              </button>
              <p role="status" aria-live="polite">
                {presentation.announcement}
              </p>
            </div>
          ) : null}
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
