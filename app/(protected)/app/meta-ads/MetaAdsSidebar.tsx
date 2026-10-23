import Link from "next/link";

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
  const links = pages.map((page) => ({
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
    path === "/app/meta-ads" && (view === "map" || view === "settings")
      ? `${path}?panel=${view}`
      : path;
  return (
    <aside className={styles.sidebar} aria-label="Navegação lateral Meta Ads">
      <div className={styles.brand}>
        Descomplica <strong>Ads</strong>
      </div>
      <nav aria-label="Visões do Meta Ads">
        {links.map((page) => (
          <Link
            key={page.key}
            href={page.path}
            prefetch={false}
            aria-current={page.path === activePath ? "page" : undefined}
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
                      : page.path.endsWith("/contas-de-anuncios")
                        ? "▤"
                        : "▥"}
            </span>
            {page.name}
          </Link>
        ))}
      </nav>
      <p className={styles.sourceNote}>Meta Ads · análise de campanhas</p>
    </aside>
  );
}
