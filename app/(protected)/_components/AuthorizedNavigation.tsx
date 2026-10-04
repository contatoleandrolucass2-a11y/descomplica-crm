"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  buildNavigationGroups,
  isNavigationGroupActive,
  type DisabledNavigationItem,
  type NavigationGroup,
  type NavigationItem,
} from "@/lib/navigation/presentation";

import { AppPageIcon } from "./AppPageIcon";
import styles from "./ProtectedShell.module.css";

const NAVIGATION_ID = "authorized-navigation";
const MOBILE_MEDIA_QUERY = "(max-width: 1180px)";

type NavigationEntry =
  | { kind: "link"; item: NavigationItem }
  | { kind: "disabled"; item: DisabledNavigationItem };

function panelId(pageKey: string) {
  return `authorized-navigation-${pageKey.replaceAll(".", "-")}`;
}

function compareEntries(left: NavigationEntry, right: NavigationEntry) {
  return (
    left.item.sortOrder - right.item.sortOrder ||
    left.item.name.localeCompare(right.item.name, "pt-BR")
  );
}

function groupEntries(
  group: NavigationGroup,
  disabledItems: DisabledNavigationItem[],
): NavigationEntry[] {
  return [
    { kind: "link" as const, item: group.page },
    ...group.children.map((item) => ({ kind: "link" as const, item })),
    ...disabledItems
      .filter((item) => item.parentKey === group.page.key && item.section === group.page.section)
      .map((item) => ({ kind: "disabled" as const, item })),
  ].sort(compareEntries);
}

function NavigationDisclosure({
  disabledItems,
  group,
  onCloseNavigation,
  onFocusPanelEdge,
  onToggle,
  open,
  pathname,
  setTrigger,
}: {
  disabledItems: DisabledNavigationItem[];
  group: NavigationGroup;
  onCloseNavigation: () => void;
  onFocusPanelEdge: (pageKey: string, edge: "first" | "last") => void;
  onToggle: (pageKey: string) => void;
  open: boolean;
  pathname: string;
  setTrigger: (pageKey: string, node: HTMLButtonElement | null) => void;
}) {
  const active = isNavigationGroupActive(pathname, group);
  const disclosureId = panelId(group.page.key);
  const statusId = `${disclosureId}-status`;
  const entries = groupEntries(group, disabledItems);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) onToggle(group.page.key);
    onFocusPanelEdge(group.page.key, event.key === "ArrowDown" ? "first" : "last");
  }

  return (
    <div className={styles.navigationDisclosure}>
      <button
        ref={(node) => setTrigger(group.page.key, node)}
        type="button"
        className={styles.navigationTrigger}
        data-active={active || undefined}
        data-navigation-active={active || undefined}
        data-navigation-root-control
        aria-controls={disclosureId}
        aria-describedby={active ? statusId : undefined}
        aria-expanded={open}
        onClick={() => onToggle(group.page.key)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.navigationIcon}>
          <AppPageIcon pageKey={group.page.key} />
        </span>
        <span>{group.page.name}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {active ? (
        <span className={styles.visuallyHidden} id={statusId}>
          contém a página atual
        </span>
      ) : null}

      <div
        id={disclosureId}
        className={styles.navigationPanel}
        data-navigation-panel-for={group.page.key}
        hidden={!open}
      >
        <span className={styles.menuEyebrow}>{group.page.name}</span>
        {entries.map((entry) => {
          if (entry.kind === "disabled") {
            return (
              <span className={styles.menuDisabled} aria-disabled="true" key={entry.item.key}>
                <span className={styles.menuIcon}>
                  <AppPageIcon pageKey={entry.item.key} />
                </span>
                <span className={styles.menuCopy}>
                  <span>{entry.item.name}</span>
                  <span className={styles.menuDescription}>{entry.item.description}</span>
                </span>
                <small>{entry.item.reason}</small>
              </span>
            );
          }

          const current = pathname === entry.item.path;
          return (
            <Link
              className={styles.menuLink}
              href={entry.item.path}
              prefetch={false}
              aria-current={current ? "page" : undefined}
              key={entry.item.key}
              onClick={onCloseNavigation}
            >
              <span className={styles.menuIcon}>
                <AppPageIcon pageKey={entry.item.key} />
              </span>
              <span className={styles.menuCopy}>
                <span>{entry.item === group.page ? "Visão geral" : entry.item.name}</span>
                <span className={styles.menuDescription}>{entry.item.description}</span>
              </span>
            </Link>
          );
        })}
        <span className={styles.menuFootnote}>Somente páginas permitidas ao seu perfil.</span>
      </div>
    </div>
  );
}

interface AuthorizedNavigationProps {
  disabledItems?: DisabledNavigationItem[];
  pages: NavigationItem[];
}

export function AuthorizedNavigation(props: AuthorizedNavigationProps) {
  const pathname = usePathname();

  return <AuthorizedNavigationState key={pathname} pathname={pathname} {...props} />;
}

function AuthorizedNavigationState({
  disabledItems = [],
  pages,
  pathname,
}: AuthorizedNavigationProps & { pathname: string }) {
  const groups = buildNavigationGroups(pages);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const groupTriggerRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!mobileOpen && openGroupKey === null) return;

    function closeFromOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setMobileOpen(false);
      setOpenGroupKey(null);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (openGroupKey !== null) {
        event.preventDefault();
        const trigger = groupTriggerRefs.current.get(openGroupKey);
        setOpenGroupKey(null);
        trigger?.focus();
        return;
      }

      if (!mobileOpen) return;
      event.preventDefault();
      setMobileOpen(false);
      mobileTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("focusin", closeFromOutside, true);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("focusin", closeFromOutside, true);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [mobileOpen, openGroupKey]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    let lastFocused: HTMLElement | null = null;

    function rememberFocus(event: FocusEvent) {
      lastFocused =
        event.target instanceof HTMLElement && rootRef.current?.contains(event.target)
          ? event.target
          : null;
    }

    function clearOutsideFocus(event: PointerEvent) {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) {
        lastFocused = null;
      }
    }

    function resetNavigation() {
      const activeElement =
        document.activeElement === document.body &&
        lastFocused &&
        !lastFocused.getClientRects().length
          ? lastFocused
          : document.activeElement;
      const focusedPanel =
        activeElement instanceof Element
          ? activeElement.closest<HTMLElement>("[data-navigation-panel-for]")
          : null;

      if (media.matches) {
        if (
          activeElement instanceof Node &&
          navigationRef.current?.contains(activeElement) &&
          activeElement !== mobileTriggerRef.current
        ) {
          mobileTriggerRef.current?.focus();
        }
      } else if (focusedPanel) {
        const pageKey = focusedPanel.dataset.navigationPanelFor;
        if (pageKey) groupTriggerRefs.current.get(pageKey)?.focus();
      } else if (activeElement === mobileTriggerRef.current) {
        navigationRef.current
          ?.querySelector<HTMLElement>("[data-navigation-root-control]")
          ?.focus();
      }

      setMobileOpen(false);
      setOpenGroupKey(null);
    }

    document.addEventListener("focusin", rememberFocus);
    document.addEventListener("pointerdown", clearOutsideFocus, true);
    media.addEventListener("change", resetNavigation);

    return () => {
      document.removeEventListener("focusin", rememberFocus);
      document.removeEventListener("pointerdown", clearOutsideFocus, true);
      media.removeEventListener("change", resetNavigation);
    };
  }, []);

  function setGroupTrigger(pageKey: string, node: HTMLButtonElement | null) {
    if (node) groupTriggerRefs.current.set(pageKey, node);
    else groupTriggerRefs.current.delete(pageKey);
  }

  function closeNavigation() {
    setMobileOpen(false);
    setOpenGroupKey(null);
  }

  function toggleGroup(pageKey: string) {
    setOpenGroupKey((current) => (current === pageKey ? null : pageKey));
  }

  function focusPanelEdge(pageKey: string, edge: "first" | "last") {
    window.requestAnimationFrame(() => {
      const links = document
        .getElementById(panelId(pageKey))
        ?.querySelectorAll<HTMLElement>("a[href]");
      if (!links?.length) return;
      links[edge === "first" ? 0 : links.length - 1]?.focus();
    });
  }

  return (
    <div className={styles.navigationRoot} ref={rootRef}>
      <button
        ref={mobileTriggerRef}
        className={styles.mobileTrigger}
        type="button"
        aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"}
        aria-expanded={mobileOpen}
        aria-controls={NAVIGATION_ID}
        onClick={() => {
          setMobileOpen((current) => !current);
          setOpenGroupKey(null);
        }}
      >
        {mobileOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>

      <nav
        id={NAVIGATION_ID}
        ref={navigationRef}
        aria-label="Navegação principal"
        className={styles.navigation}
        data-open={mobileOpen}
      >
        <ul className={styles.navigationList}>
          {groups.map((group) => {
            const hasDisabledChildren = disabledItems.some(
              (item) => item.parentKey === group.page.key && item.section === group.page.section,
            );
            const hasChildren = group.children.length > 0 || hasDisabledChildren;

            return (
              <li className={styles.navigationItem} key={group.page.key}>
                {hasChildren ? (
                  <NavigationDisclosure
                    group={group}
                    pathname={pathname}
                    disabledItems={disabledItems}
                    open={openGroupKey === group.page.key}
                    setTrigger={setGroupTrigger}
                    onToggle={toggleGroup}
                    onFocusPanelEdge={focusPanelEdge}
                    onCloseNavigation={closeNavigation}
                  />
                ) : (
                  <Link
                    href={group.page.path}
                    prefetch={false}
                    aria-current={pathname === group.page.path ? "page" : undefined}
                    className={styles.navigationLink}
                    data-navigation-root-control
                    onClick={closeNavigation}
                  >
                    <span className={styles.navigationIcon}>
                      <AppPageIcon pageKey={group.page.key} />
                    </span>
                    {group.page.name}
                    <span className={styles.mobileRootChevron} aria-hidden="true">
                      ›
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
