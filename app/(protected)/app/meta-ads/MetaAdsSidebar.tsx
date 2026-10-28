"use client";

import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileChartColumn,
  LockKeyhole,
  MapPinned,
  Menu,
  Megaphone,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AppPage } from "@/lib/navigation/pages";
import styles from "./MetaAdsDashboardFrame.module.css";

export function MetaAdsSidebar({
  pages,
  path,
}: {
  pages: Pick<AppPage, "key" | "path" | "name">[];
  path: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const visuallyCollapsed = collapsed && !hoverPreview;
  const order = new Map([
    ["/app/meta-ads", 0],
    ["/app/meta-ads/campanhas", 1],
    ["/app/meta-ads/relatorios", 2],
    ["/app/meta-ads/contas-de-anuncios", 3],
  ]);
  const links = pages
    .map((page) => ({
      ...page,
      name:
        page.path === "/app/meta-ads"
          ? "Visão macro"
          : page.path === "/app/meta-ads/contas-de-anuncios"
            ? "Limites"
            : page.name,
    }))
    .sort((left, right) => (order.get(left.path) ?? 99) - (order.get(right.path) ?? 99));
  if (pages.some((page) => page.path === "/app/meta-ads")) {
    links.push(
      { key: "map-panel", path: "/app/meta-ads?panel=map", name: "Mapa de São Paulo" },
      { key: "settings-panel", path: "/app/meta-ads?panel=settings", name: "Ajustes" },
    );
  }
  const activePath = path;
  const iconFor = (page: (typeof links)[number]) => {
    if (page.key === "map-panel") return MapPinned;
    if (page.key === "settings-panel") return SlidersHorizontal;
    if (page.path === "/app/meta-ads") return BarChart3;
    if (page.path.endsWith("/campanhas")) return Megaphone;
    return FileChartColumn;
  };
  return (
    <aside
      className={styles.sidebar}
      aria-label="Navegação lateral Meta Ads"
      data-collapsed={visuallyCollapsed || undefined}
      data-mobile-open={mobileOpen || undefined}
      onMouseEnter={() => {
        if (collapsed) setHoverPreview(true);
      }}
      onMouseLeave={() => setHoverPreview(false)}
      onFocusCapture={() => {
        if (collapsed) setHoverPreview(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHoverPreview(false);
      }}
    >
      <div className={styles.mobileHeader}>
        <span className={styles.mobileTitle}>Descomplica Ads</span>
        <button
          type="button"
          className={styles.mobileMenuToggle}
          aria-controls="meta-ads-sidebar-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Fechar menu Meta Ads" : "Abrir menu Meta Ads"}
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>
      </div>
      <div className={styles.sidebarPanel}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <span aria-hidden="true" className={styles.brandMark}>
              D
            </span>
            <span className={styles.brandLabel}>Descomplica Ads</span>
          </div>
          <button
            type="button"
            className={styles.mobileClose}
            aria-label="Fechar menu Meta Ads"
            onClick={() => setMobileOpen(false)}
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>
        <nav id="meta-ads-sidebar-navigation" aria-label="Navegação lateral Meta Ads">
          {links.map((page) => {
            const Icon = iconFor(page);
            const isBlocked = page.key === "map-panel" || page.key === "settings-panel";
            const maintenanceMessage =
              "Página temporariamente desabilitada para melhorias. Consulte o desenvolvedor para mais informações.";
            if (isBlocked) {
              return (
                <button
                  key={page.key}
                  type="button"
                  aria-disabled="true"
                  aria-label={`${page.name}. ${maintenanceMessage}`}
                  title={maintenanceMessage}
                  data-tooltip={maintenanceMessage}
                  className={`${styles.navigationLink} ${styles.navigationButton} ${styles.navigationDisabled}`}
                >
                  <span aria-hidden="true" className={styles.navigationIcon}>
                    <Icon size={19} strokeWidth={1.9} />
                  </span>
                  <span className={styles.navigationLabel}>{page.name}</span>
                  <LockKeyhole aria-hidden="true" className={styles.navigationLock} size={15} />
                </button>
              );
            }
            return (
              <Link
                key={page.key}
                href={page.path}
                prefetch={false}
                aria-current={page.path === activePath ? "page" : undefined}
                aria-label={page.name}
                title={visuallyCollapsed ? page.name : undefined}
                className={styles.navigationLink}
                onClick={() => setMobileOpen(false)}
              >
                <span aria-hidden="true" className={styles.navigationIcon}>
                  <Icon size={19} strokeWidth={1.9} />
                </span>
                <span className={styles.navigationLabel}>{page.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <p className={styles.sourceNote}>Meta Ads · análise de campanhas</p>
          <button
            type="button"
            className={styles.soundToggle}
            aria-pressed={soundMuted}
            aria-label={soundMuted ? "Ativar sons discretos" : "Silenciar sons discretos"}
            title={soundMuted ? "Ativar sons discretos" : "Silenciar sons discretos"}
            onClick={() => {
              let next = !soundMuted;
              try {
                next = localStorage.getItem("descomplica-ui-sounds-muted") !== "true";
              } catch {
                // Usa o estado da interface quando o armazenamento está indisponível.
              }
              setSoundMuted(next);
              try {
                localStorage.setItem("descomplica-ui-sounds-muted", String(next));
              } catch {
                // O dashboard continua funcional quando o armazenamento está indisponível.
              }
            }}
          >
            {soundMuted ? (
              <VolumeX aria-hidden="true" size={18} />
            ) : (
              <Volume2 aria-hidden="true" size={18} />
            )}
            <span>{soundMuted ? "Ativar sons" : "Sons discretos"}</span>
          </button>
          <button
            type="button"
            className={styles.sidebarToggle}
            aria-controls="meta-ads-sidebar-navigation"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            onClick={() => {
              setHoverPreview(false);
              setCollapsed((current) => !current);
            }}
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" size={19} />
            ) : (
              <ChevronLeft aria-hidden="true" size={19} />
            )}
            <span>{collapsed ? "Expandir" : "Recolher"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
