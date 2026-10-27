import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  ManagementPage,
  ManagementPageHeader,
} from "@/app/(protected)/_components/ManagementCanvas";
import type { UsefulLinksPage } from "@/lib/crm/useful-links/content";

import styles from "./UsefulLinks.module.css";

export function UsefulLinksContent({ page }: { page: UsefulLinksPage }) {
  return (
    <ManagementPage className={styles.canvas!}>
      <ManagementPageHeader
        eyebrow="Links Úteis"
        title={page.title}
        description={page.description}
      />
      <div className={styles.sections}>
        {page.sections.map((section, index) => (
          <section
            className={styles.panel}
            key={section.title}
            aria-labelledby={`section-${index}`}
          >
            <h2 id={`section-${index}`}>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul className={styles.items}>
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.resource}
                      >
                        <span>{item.label}</span>
                        <ExternalLink size={18} aria-hidden="true" />
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      <strong>{item.label}</strong>
                    )}
                    {item.description ? (
                      <p className={styles.itemDescription}>{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.table ? (
              <div
                className={styles.tableScroll}
                role="region"
                aria-label={section.title}
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">{section.title}</caption>
                  <thead>
                    <tr>
                      {section.table.headers.map((header) => (
                        <th scope="col" key={header}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) =>
                          cellIndex === 0 ? (
                            <th scope="row" key={cellIndex}>
                              {cell}
                            </th>
                          ) : (
                            <td key={cellIndex}>{cell}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <footer className={styles.footer}>
        <span>Conteúdo da referência consultado em 27/10/2026.</span>
        <a
          href={`https://datastudio.google.com/reporting/6012adde-5a26-4274-b83b-67f3bac84f08/page/${page.sourcePage}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar fonte <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </footer>
    </ManagementPage>
  );
}

export function UsefulLinksCards({ pages }: { pages: UsefulLinksPage[] }) {
  return (
    <div className={styles.cards}>
      {pages.map((page) => (
        <Link
          href={`/app/links-uteis/${page.slug}`}
          prefetch={false}
          className={styles.card}
          key={page.slug}
        >
          <h2>{page.title}</h2>
          <p>{page.description}</p>
          <span className={styles.cardAction}>
            Acessar <ArrowRight size={18} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
