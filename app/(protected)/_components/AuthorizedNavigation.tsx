"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent } from "react";

import {
  buildNavigationGroups,
  isNavigationGroupActive,
  type NavigationGroup,
  type NavigationItem,
} from "@/lib/navigation/presentation";

import { AppPageIcon } from "./AppPageIcon";
import styles from "./ProtectedShell.module.css";

function NavigationDisclosure({ group, pathname }: { group: NavigationGroup; pathname: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const active = isNavigationGroupActive(pathname, group);

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const disclosure = details.current;
      if (!disclosure?.open) return;
      if (event.target instanceof Node && disclosure.contains(event.target)) return;
      disclosure.open = false;
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function closeDisclosure() {
    if (details.current) details.current.open = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== "Escape" || !details.current?.open) return;
    details.current.open = false;
    summary.current?.focus();
  }

  const links = [group.page, ...group.children];

  return (
    <details
      className={styles.navigationDetails}
      name="authorized-navigation"
      ref={details}
      onKeyDown={handleKeyDown}
    >
      <summary
        className={`${styles.navigationSummary} ${active ? styles.activeSummary : ""}`}
        ref={summary}
      >
        <span className={styles.navigationIcon}>
          <AppPageIcon pageKey={group.page.key} />
        </span>
        {group.page.name}
        {active ? <span className={styles.visuallyHidden}> — contém a página atual</span> : null}
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className={styles.navigationMenu}>
        {links.map((page) => {
          const current = pathname === page.path;
          return (
            <Link
              className={styles.menuLink}
              href={page.path}
              aria-current={current ? "page" : undefined}
              key={page.key}
              onClick={closeDisclosure}
            >
              <span className={styles.menuIcon}>
                <AppPageIcon pageKey={page.key} />
              </span>
              <span className={styles.menuCopy}>
                <span>{page.name}</span>
                <span className={styles.menuDescription}>{page.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export function AuthorizedNavigation({ pages }: { pages: NavigationItem[] }) {
  const pathname = usePathname();
  const groups = buildNavigationGroups(pages);

  return (
    <nav aria-label="Navegação autorizada" className={styles.navigation}>
      <ul className={styles.navigationList}>
        {groups.map((group) => (
          <li className={styles.navigationItem} key={group.page.key}>
            {group.children.length > 0 ? (
              <NavigationDisclosure group={group} pathname={pathname} />
            ) : (
              <Link
                href={group.page.path}
                aria-current={pathname === group.page.path ? "page" : undefined}
                className={styles.navigationLink}
              >
                <span className={styles.navigationIcon}>
                  <AppPageIcon pageKey={group.page.key} />
                </span>
                {group.page.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
