import Link from "next/link";

import type { AppPage } from "@/lib/navigation/pages";
import styles from "./MetaAdsDashboardFrame.module.css";

export function MetaAdsSidebar({
  pages,
  path,
}: {
  pages: Pick<AppPage, "key" | "path" | "name">[];
  path: string;
}) {
  return (
    <aside className={styles.sidebar} aria-label="Navegação lateral Meta Ads">
      <div className={styles.brand}>
        Descomplica <strong>Ads</strong>
      </div>
      <nav aria-label="Visões do Meta Ads">
        {pages.map((page) => (
          <Link
            key={page.key}
            href={page.path}
            prefetch={false}
            aria-current={page.path === path ? "page" : undefined}
            className={styles.navigationLink}
          >
            <span aria-hidden="true" className={styles.navigationIcon}>
              {page.path === "/app/meta-ads"
                ? "▦"
                : page.path.endsWith("/campanhas")
                  ? "▣"
                  : page.path.endsWith("/contas-de-anuncios")
                    ? "▤"
                    : "▥"}
            </span>
            {page.path === "/app/meta-ads" ? "Visão geral" : page.name}
          </Link>
        ))}
      </nav>
      <p className={styles.sourceNote}>Meta Ads · análise de campanhas</p>
    </aside>
  );
}
