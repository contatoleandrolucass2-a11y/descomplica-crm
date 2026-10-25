"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AppPage } from "@/lib/navigation/pages";
import styles from "./MetaAdsDashboardFrame.module.css";

export function MetaAdsSidebar({
  pages,
  path,
  view = "overview",
}: {
  pages: Pick<AppPage, "key" | "path" | "name">[];
  path: string;
  view?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const links = pages
    .filter((page) => page.path !== "/app/meta-ads/contas-de-anuncios")
    .map((page) => ({
      ...page,
      name: page.path === "/app/meta-ads" ? "Visão macro" : page.name,
    }));
  if (pages.some((page) => page.path === "/app/meta-ads")) {
    links.splice(
      Math.min(2, links.length),
      0,
      { key: "map-panel", path: "/app/meta-ads?panel=map", name: "Mapa de São Paulo" },
      { key: "settings-panel", path: "/app/meta-ads?panel=settings", name: "Ajustes" },
    );
  }
  const activePath =
    view === "accounts"
      ? "/app/meta-ads?panel=settings"
      : path === "/app/meta-ads" && (view === "map" || view === "settings")
        ? `${path}?panel=${view}`
        : path;
  return (
    <aside
      className={styles.sidebar}
      aria-label="Navegação lateral Meta Ads"
      data-collapsed={collapsed || undefined}
    >
      <div className={styles.brand}>
        Descomplica <strong>Ads</strong>
      </div>
      <nav id="meta-ads-sidebar-navigation" aria-label="Visões do Meta Ads">
        {links.map((page) => (
          <Link
            key={page.key}
            href={page.path}
            prefetch={false}
            aria-current={page.path === activePath ? "page" : undefined}
            aria-label={page.name}
            title={collapsed ? page.name : undefined}
            className={styles.navigationLink}
          >
            <span aria-hidden="true" className={styles.navigationIcon}>
              {page.key === "map-panel"
                ? "⌖"
                : page.key === "settings-panel"
                  ? "⚙"
                  : page.path === "/app/meta-ads"
                    ? "▦"
                    : page.path.endsWith("/campanhas")
                      ? "▣"
                      : "▥"}
            </span>
            <span className={styles.navigationLabel}>{page.name}</span>
          </Link>
        ))}
      </nav>
      <p className={styles.sourceNote}>Meta Ads · análise de campanhas</p>
      <button
        type="button"
        className={styles.sidebarToggle}
        aria-controls="meta-ads-sidebar-navigation"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? (
          <ChevronRight aria-hidden="true" size={19} />
        ) : (
          <ChevronLeft aria-hidden="true" size={19} />
        )}
        <span>{collapsed ? "Expandir" : "Recolher"}</span>
      </button>
    </aside>
  );
}
