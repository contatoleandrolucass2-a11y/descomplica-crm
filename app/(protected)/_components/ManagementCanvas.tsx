import { Info } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./ManagementCanvas.module.css";

export function ManagementPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`${styles.page} ${className}`}>
      <div className={styles.pageInner}>{children}</div>
    </main>
  );
}

export function ManagementStatusBadge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "positive";
}) {
  return (
    <span className={styles.statusBadge} data-tone={tone}>
      <Info aria-hidden="true" size={17} />
      {children}
    </span>
  );
}

export function ManagementPageHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  status?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {status}
    </header>
  );
}

export { styles as managementStyles };
