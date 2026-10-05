"use client";

import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import { getPermissionLabel } from "@/lib/authorization/permissions";
import type { AppPage } from "@/lib/navigation/pages";

import { setPageVisibilityAction } from "./actions";

const PAGE_SIZE = 8;

export function PageCatalogManager({ pages }: { pages: AppPage[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [section, setSection] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);

  const sections = useMemo(
    () =>
      [...new Set(pages.map((page) => page.section))].sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      ),
    [pages],
  );
  const filteredPages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    return pages.filter((page) => {
      const matchesSearch =
        !query ||
        `${page.name} ${page.description} ${page.path} ${page.key} ${getPermissionLabel(page.permissionKey)}`
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      const matchesStatus =
        status === "all" || (status === "active" ? page.isActive : !page.isActive);
      const matchesSection = section === "all" || page.section === section;
      return matchesSearch && matchesStatus && matchesSection;
    });
  }, [pages, search, section, status]);

  const pageCount = Math.max(1, Math.ceil(filteredPages.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePages = filteredPages.slice(pageStart, pageStart + PAGE_SIZE);

  function resetPage() {
    setPageNumber(1);
  }

  return (
    <div className="admin-pages-content">
      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded} admin-pages-toolbar`}
      >
        <div className={managementStyles.toolbar}>
          <label className={managementStyles.searchLabel} htmlFor="page-search">
            <Search aria-hidden="true" />
            <span className={managementStyles.searchCopy}>
              <span>Buscar página</span>
              <input
                id="page-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Nome, rota ou permissão"
                className={managementStyles.searchInput}
              />
            </span>
          </label>
          <label className={managementStyles.selectLabel}>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "all" | "active" | "inactive");
                resetPage();
              }}
              className={managementStyles.select}
            >
              <option value="all">Todos</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </label>
          <label className={managementStyles.selectLabel}>
            Módulo
            <select
              value={section}
              onChange={(event) => {
                setSection(event.target.value);
                resetPage();
              }}
              className={managementStyles.select}
            >
              <option value="all">Todos</option>
              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section
        className={`${managementStyles.panel} admin-pages-results`}
        aria-labelledby="page-catalog-title"
      >
        <div className="admin-pages-results-header">
          <div className="admin-results-title">
            <span className={managementStyles.iconFrame} aria-hidden="true">
              <FileText />
            </span>
            <div>
              <h2 id="page-catalog-title" className={managementStyles.sectionTitle}>
                Páginas cadastradas
              </h2>
              <p className={managementStyles.sectionDescription}>
                Rotas da aplicação e controle de navegação
              </p>
            </div>
          </div>
        </div>

        <div className={managementStyles.tableRegion}>
          <table className={managementStyles.table}>
            <caption className="sr-only">Catálogo gerenciável de páginas</caption>
            <thead>
              <tr>
                <th scope="col">Página</th>
                <th scope="col">Descrição</th>
                <th scope="col">Rota</th>
                <th scope="col">Status</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiblePages.length ? (
                visiblePages.map((page) => {
                  const action = setPageVisibilityAction.bind(null, page.key, !page.isActive);

                  return (
                    <tr key={page.key}>
                      <th scope="row" data-label="Página" className="min-w-64 text-left">
                        <strong className="block">{page.name}</strong>
                      </th>
                      <td data-label="Descrição" className="min-w-72">
                        <span className="block">{page.description}</span>
                        <span className="mt-0.5 block text-[var(--analytics-muted)]">
                          {getPermissionLabel(page.permissionKey)} · {page.section}
                        </span>
                      </td>
                      <td data-label="Rota" className="min-w-52 font-mono">
                        {page.path}
                      </td>
                      <td data-label="Status">
                        <span
                          className={managementStyles.statusPill}
                          data-state={page.isActive ? "active" : "inactive"}
                        >
                          {page.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td data-label="Ações">
                        <details className={managementStyles.disclosure}>
                          <summary
                            className={`${managementStyles.button} admin-page-action whitespace-nowrap`}
                          >
                            <MoreHorizontal aria-hidden="true" className="size-4" />
                            <span className="sr-only">Gerenciar {page.name}</span>
                          </summary>
                          <form action={action} className={managementStyles.actionPanel}>
                            <p className="max-w-80 text-xs leading-5 text-[var(--analytics-muted)]">
                              {page.description}
                            </p>
                            <label className="grid gap-1 text-xs font-semibold text-[var(--analytics-ink)]">
                              Motivo
                              <input
                                name="reason"
                                maxLength={240}
                                placeholder="Motivo (opcional)"
                                className="min-h-11 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 text-sm text-[var(--analytics-ink)]"
                              />
                            </label>
                            <button
                              type="submit"
                              className={
                                page.isActive
                                  ? managementStyles.buttonDanger
                                  : managementStyles.buttonPrimary
                              }
                            >
                              {page.isActive ? "Desativar" : "Ativar"}
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className={managementStyles.emptyCell}>
                    Nenhuma página corresponde aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`${managementStyles.panelPadded} ${managementStyles.pagination}`}>
          <span aria-live="polite">
            {filteredPages.length
              ? `Mostrando ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filteredPages.length)} de ${filteredPages.length} páginas`
              : "0 páginas"}
          </span>
          <div className={managementStyles.paginationControls}>
            <button
              type="button"
              className={managementStyles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span className={managementStyles.pageButton} aria-current="page">
              {currentPage}
            </span>
            <button
              type="button"
              className={managementStyles.pageButton}
              disabled={currentPage === pageCount}
              onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
              aria-label="Próxima página"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
