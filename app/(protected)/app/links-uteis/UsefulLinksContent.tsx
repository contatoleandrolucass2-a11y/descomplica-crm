import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  ManagementPage,
  ManagementPageHeader,
} from "@/app/(protected)/_components/ManagementCanvas";
import type { UsefulLinksPage } from "@/lib/crm/useful-links/content";

import styles from "./UsefulLinks.module.css";
import { UsefulLinksBoard } from "./UsefulLinksBoard";

export function UsefulLinksContent({ page }: { page: UsefulLinksPage }) {
  return (
    <ManagementPage className={styles.canvas!}>
      <ManagementPageHeader
        eyebrow="Links Úteis"
        title={page.title}
        description={page.description}
      />
      <UsefulLinksBoard page={page} />
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
