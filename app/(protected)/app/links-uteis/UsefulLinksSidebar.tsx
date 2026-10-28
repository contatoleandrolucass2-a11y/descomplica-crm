"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { AppPageIcon } from "../../_components/AppPageIcon";

import styles from "./UsefulLinksSidebar.module.css";

type UsefulLinksNavigationPage = {
  key: string;
  name: string;
  path: string;
};

export function UsefulLinksSidebar({
  pages,
  children,
}: {
  pages: UsefulLinksNavigationPage[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (collapsed) return;

    function collapseFromOutside(event: globalThis.PointerEvent) {
      if (!(event.target instanceof Node) || sidebarRef.current?.contains(event.target)) return;
      setCollapsed(true);
    }

    document.addEventListener("pointerdown", collapseFromOutside, true);
    return () => document.removeEventListener("pointerdown", collapseFromOutside, true);
  }, [collapsed]);

  const activePage = pages.find((page) => page.path === pathname);
  if (!activePage) return children;

  const toggleLabel = collapsed
    ? "Expandir navegação de Links Úteis"
    : "Recolher navegação de Links Úteis";

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <aside ref={sidebarRef} className={styles.sidebar} aria-label="Links Úteis">
        <button
          type="button"
          className={styles.toggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls="useful-links-navigation"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={20} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={20} />
          )}
          <span className={styles.label}>Ocultar</span>
        </button>
        <nav id="useful-links-navigation" aria-label="Páginas de Links Úteis">
          <ul className={styles.links}>
            {pages.map((page) => {
              const label = page.key === "crm.useful_links" ? "Visão geral" : page.name;
              return (
                <li key={page.key}>
                  <Link
                    href={page.path}
                    prefetch={false}
                    className={styles.link}
                    aria-label={label}
                    aria-current={page.key === activePage.key ? "page" : undefined}
                    title={label}
                  >
                    <span className={styles.icon}>
                      <AppPageIcon pageKey={page.key} />
                    </span>
                    <span className={styles.label}>{label}</span>
                    {collapsed ? (
                      <span className={styles.tooltip} aria-hidden="true">
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
      <div className={styles.content}>{children}</div>
    </div>
  );
}
