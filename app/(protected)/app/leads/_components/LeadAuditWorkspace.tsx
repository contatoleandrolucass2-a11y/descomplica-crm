import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import { LeadStatePanel, leadStyles, type LeadSourceState } from "./LeadWorkspace";

export type LeadAuditEvent = {
  id: string;
  actionLabel: string;
  resourceLabel: string;
  actorLabel: string | null;
  scopeLabel: string;
  reason: string | null;
  occurredAtLabel: string;
  changedFields: readonly string[];
};
export type LeadAuditFilters = {
  action?: string;
  actor?: string;
  record?: string;
  from?: string;
  to?: string;
};

export function LeadAuditWorkspace({
  state,
  events,
  scopeId,
  page,
  pageCount,
  total,
  filters = {},
}: {
  state: LeadSourceState;
  events: readonly LeadAuditEvent[];
  scopeId?: string | undefined;
  page: number;
  pageCount: number;
  total: number | null;
  filters?: LeadAuditFilters | undefined;
}) {
  const pageQuery = new URLSearchParams();
  if (filters.action) pageQuery.set("acao", filters.action);
  if (filters.actor) pageQuery.set("autor", filters.actor);
  if (filters.record) pageQuery.set("registro", filters.record);
  if (filters.from) pageQuery.set("desde", filters.from);
  if (filters.to) pageQuery.set("ate", filters.to);
  if (scopeId) pageQuery.set("scope", scopeId);
  const pageHref = (target: number) => {
    const query = new URLSearchParams(pageQuery);
    query.set("pagina", String(target));
    return `/app/leads/auditoria?${query.toString()}`;
  };
  return (
    <div className={leadStyles.workspace}>
      <form className={leadStyles.stack} method="get" role="search">
        {scopeId ? <input type="hidden" name="scope" value={scopeId} /> : null}
        <div className={leadStyles.filterPanel}>
          <label className={leadStyles.field}>
            Ação
            <input
              className={leadStyles.input}
              name="acao"
              defaultValue={filters.action}
              placeholder="Todas"
            />
          </label>
          <label className={leadStyles.field}>
            Autor
            <input
              className={leadStyles.input}
              name="autor"
              defaultValue={filters.actor}
              placeholder="UUID do autor"
            />
          </label>
          <label className={leadStyles.field}>
            Registro
            <input
              className={leadStyles.input}
              name="registro"
              defaultValue={filters.record}
              placeholder="Identificador exato"
            />
          </label>
          <label className={leadStyles.field}>
            Desde
            <input
              className={leadStyles.input}
              name="desde"
              type="date"
              defaultValue={filters.from}
            />
          </label>
          <label className={leadStyles.field}>
            Até
            <input className={leadStyles.input} name="ate" type="date" defaultValue={filters.to} />
          </label>
          <div className={leadStyles.inlineActions}>
            <button className={managementStyles.buttonPrimary} type="submit">
              <Search size={16} aria-hidden="true" />
              Consultar
            </button>
            <Link
              className={managementStyles.button}
              href={`/app/leads/auditoria${scopeId ? `?scope=${encodeURIComponent(scopeId)}` : ""}`}
            >
              Limpar
            </Link>
          </div>
        </div>
      </form>
      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
        aria-label="Proteção dos dados da auditoria"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" />
          <p className={leadStyles.panelDescription}>
            A auditoria apresenta somente metadados operacionais autorizados. Telefone, e-mail,
            mensagens e conteúdo importado não são exibidos.
          </p>
        </div>
      </section>
      <section className={leadStyles.stack} aria-labelledby="lead-audit-title">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-audit-title" className={managementStyles.sectionTitle}>
              Eventos de auditoria
            </h2>
            <p className={managementStyles.sectionDescription}>
              {total === null ? "Total indisponível" : `${total} evento${total === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        {state === "ready" || state === "empty" ? (
          events.length > 0 ? (
            <div
              className={leadStyles.tableRegion}
              tabIndex={0}
              aria-label="Tabela de auditoria; deslize horizontalmente em telas estreitas"
            >
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Horário</th>
                    <th scope="col">Ação</th>
                    <th scope="col">Recurso</th>
                    <th scope="col">Autor</th>
                    <th scope="col">Escopo</th>
                    <th scope="col">Campos</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.occurredAtLabel}</td>
                      <td>
                        <span className={leadStyles.pill}>{event.actionLabel}</span>
                      </td>
                      <th scope="row">{event.resourceLabel}</th>
                      <td>{event.actorLabel ?? "Sistema"}</td>
                      <td>{event.scopeLabel}</td>
                      <td>
                        {event.changedFields.length > 0
                          ? event.changedFields.join(", ")
                          : "Não informado"}
                      </td>
                      <td>{event.reason ?? "Não informado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LeadStatePanel
              state="empty"
              title="Nenhum evento encontrado"
              description="Altere os filtros ou o período da consulta."
            />
          )
        ) : (
          <LeadStatePanel
            state={state === "error" ? "error" : "not_configured"}
            title={
              state === "error"
                ? "Auditoria temporariamente indisponível"
                : state === "scope_required"
                  ? "Selecione um escopo"
                  : "Auditoria ainda não configurada"
            }
            description={
              state === "error"
                ? "A consulta falhou; eventos anteriores não foram apresentados como atuais."
                : "Os eventos aparecerão quando o read model autorizado estiver disponível."
            }
          />
        )}
      </section>
      <nav className={leadStyles.pagination} aria-label="Paginação da auditoria">
        <span>
          Página {page} de {Math.max(1, pageCount)}
        </span>
        <span className={leadStyles.paginationControls}>
          {page > 1 ? (
            <Link className={managementStyles.button} href={pageHref(page - 1)}>
              Anterior
            </Link>
          ) : (
            <span className={managementStyles.button} aria-disabled="true">
              Anterior
            </span>
          )}
          {page < pageCount ? (
            <Link className={managementStyles.button} href={pageHref(page + 1)}>
              Próxima
            </Link>
          ) : (
            <span className={managementStyles.button} aria-disabled="true">
              Próxima
            </span>
          )}
        </span>
      </nav>
    </div>
  );
}
