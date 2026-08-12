"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppPage } from "@/lib/navigation/pages";
import { buildBreadcrumbs } from "@/lib/navigation/presentation";

import styles from "./ProtectedShell.module.css";

export function AuthorizedBreadcrumbs({ pages }: { pages: AppPage[] }) {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname, pages);
  if (breadcrumbs.length === 0) return null;

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol>
        {breadcrumbs.map((page, index) => {
          const current = index === breadcrumbs.length - 1;
          return (
            <li key={page.key}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {current ? (
                <span aria-current="page">{page.name}</span>
              ) : (
                <Link href={page.path}>{page.name}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
