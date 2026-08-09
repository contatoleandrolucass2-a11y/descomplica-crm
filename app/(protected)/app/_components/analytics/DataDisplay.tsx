import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./analytics.module.css";
import { DonutChart, type ChartAccent } from "./Charts";

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderBody}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.pageTitle}>{title}</h1>
          <p className={styles.pageDescription}>{description}</p>
        </div>
        {meta ? <div className={styles.pageHeaderMeta}>{meta}</div> : null}
      </div>
      {footer ? <div className={styles.pageHeaderFooter}>{footer}</div> : null}
    </header>
  );
}

export function AnalyticsCard({
  children,
  tone = "default",
  padded = true,
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "navy" | "subtle";
  padded?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`${styles.card} ${padded ? styles.cardPadding : ""} ${className}`}
      data-tone={tone}
    >
      {children}
    </article>
  );
}

export function SectionHeading({
  kicker,
  title,
  description,
  action,
  id,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        {kicker ? <p className={styles.sectionKicker}>{kicker}</p> : null}
        <h2 className={styles.sectionTitle} id={id}>
          {title}
        </h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  ratio,
  ratioLabel,
  accent = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  ratio: number | null;
  ratioLabel: string;
  accent?: ChartAccent;
}) {
  const ratioValue = ratio === null ? "Indisponível" : ratioLabel;

  return (
    <article className={`${styles.card} ${styles.metricCard}`}>
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <strong className={styles.metricValue}>{value}</strong>
        <p className={styles.metricDetail}>{detail}</p>
      </div>
      <DonutChart
        label={`Atingimento de ${label}`}
        value={ratioValue}
        ratio={ratio}
        accent={accent}
      />
    </article>
  );
}

export function FilterBar({
  label,
  children,
  unavailableDimensions = [],
}: {
  label: string;
  children: ReactNode;
  unavailableDimensions?: string[];
}) {
  return (
    <section className={styles.filterBar} aria-label={label}>
      <div className={styles.filterLayout}>
        {children}
        {unavailableDimensions.length > 0 ? (
          <div className={styles.unavailableFilters}>
            <strong>Filtros dimensionais indisponíveis:</strong>
            {unavailableDimensions.map((dimension) => (
              <span className={styles.unavailableFilter} key={dimension}>
                {dimension}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className={styles.filterGroup}>
      <legend className={styles.filterLegend}>{label}</legend>
      <div className={styles.filterOptions}>{children}</div>
    </fieldset>
  );
}

export function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link className={styles.filterLink} href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

export interface AnalyticsColumn<Row> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
}

export function AnalyticsTable<Row>({
  caption,
  rows,
  columns,
  rowKey,
}: {
  caption: string;
  rows: Row[];
  columns: Array<AnalyticsColumn<Row>>;
  rowKey: (row: Row) => string;
}) {
  return (
    <div
      className={styles.tableWrap}
      role="region"
      aria-label={`${caption} — tabela com rolagem horizontal`}
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={column.align === "right" ? styles.alignRight : styles.alignLeft}
                key={column.key}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) => {
                const className = column.align === "right" ? styles.alignRight : styles.alignLeft;
                return index === 0 ? (
                  <th className={className} key={column.key} scope="row">
                    {column.render(row)}
                  </th>
                ) : (
                  <td className={className} key={column.key}>
                    {column.render(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankingList({
  items,
}: {
  items: Array<{ id: string; rank: number; name: string; value: string }>;
}) {
  return (
    <ol className={styles.rankingList} role="list">
      {items.map((item) => (
        <li className={styles.rankingItem} key={item.id}>
          <span className={styles.rankingPosition}>{item.rank}</span>
          <span className={styles.rankingName}>{item.name}</span>
          <strong className={styles.rankingValue}>{item.value}</strong>
        </li>
      ))}
    </ol>
  );
}
