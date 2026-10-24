import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  MessageSquareText,
  Plus,
  RotateCcw,
  Search,
  Send,
  Tag,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import { LeadStatePanel, leadStyles, type LeadSourceState } from "./LeadWorkspace";

export type LeadListView = "todo" | "visits" | "future" | "favorites" | "all";

export type LeadListItem = {
  id: string;
  customerName: string;
  interest: string | null;
  responsibleName: string | null;
  statusLabel: string;
  stageLabel: string;
  lastInteractionLabel: string | null;
  isFavorite: boolean;
};

export type LeadTimelineItem = {
  id: string;
  title: string;
  description: string | null;
  occurredAtLabel: string;
  authorLabel: string | null;
};

export type LeadDetail = LeadListItem & {
  phone: string | null;
  email: string | null;
  channelLabel: string | null;
  sourceLabel: string | null;
  message: string | null;
  tags: readonly string[];
  timeline: readonly LeadTimelineItem[];
  isArchived: boolean;
};

export type LeadFilterOption = { value: string; label: string };

type LeadMutation = (formData: FormData) => void | Promise<void>;

const VIEWS: ReadonlyArray<{ key: LeadListView; label: string }> = [
  { key: "todo", label: "A fazer" },
  { key: "visits", label: "Visitas" },
  { key: "future", label: "Futuras" },
  { key: "favorites", label: "Favoritos" },
  { key: "all", label: "Todos" },
];

function viewHref(view: LeadListView, query: string, scopeId?: string) {
  const params = new URLSearchParams();
  params.set("visao", view);
  if (query) params.set("busca", query);
  if (scopeId) params.set("scope", scopeId);
  return `/app/leads/lista?${params.toString()}`;
}

export function LeadListWorkspace({
  state,
  items,
  selectedLead = null,
  query = "",
  view = "todo",
  page = 1,
  pageCount = 1,
  total = null,
  scopeId,
  channels = [],
  sources = [],
  responsibles = [],
  saveLeadAction,
  addMessageAction,
  addActivityAction,
  toggleFavoriteAction,
  archiveAction,
  rescueAction,
  closeAction,
}: {
  state: LeadSourceState;
  items: readonly LeadListItem[];
  selectedLead?: LeadDetail | null;
  query?: string;
  view?: LeadListView;
  page?: number;
  pageCount?: number;
  total?: number | null;
  scopeId?: string | undefined;
  channels?: readonly LeadFilterOption[];
  sources?: readonly LeadFilterOption[];
  responsibles?: readonly LeadFilterOption[];
  saveLeadAction?: LeadMutation | undefined;
  addMessageAction?: LeadMutation | undefined;
  addActivityAction?: LeadMutation | undefined;
  toggleFavoriteAction?: LeadMutation | undefined;
  archiveAction?: LeadMutation | undefined;
  rescueAction?: LeadMutation | undefined;
  closeAction?: LeadMutation | undefined;
}) {
  const mutationsReady = Boolean(saveLeadAction);

  return (
    <div className={leadStyles.workspace}>
      <nav className={leadStyles.tabs} aria-label="Visões da lista de leads">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={viewHref(item.key, query, scopeId)}
            className={leadStyles.tab}
            aria-current={view === item.key ? "page" : undefined}
            prefetch={false}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <form className={leadStyles.stack} method="get" role="search">
        <input type="hidden" name="visao" value={view} />
        {scopeId ? <input type="hidden" name="scope" value={scopeId} /> : null}
        <div className={leadStyles.toolbar}>
          <label className={managementStyles.searchLabel}>
            <Search aria-hidden="true" />
            <span className={managementStyles.searchCopy}>
              <span>Pesquisar leads</span>
              <input
                className={managementStyles.searchInput}
                type="search"
                name="busca"
                defaultValue={query}
                autoComplete="off"
                placeholder="Nome, telefone, e-mail ou interesse"
              />
            </span>
          </label>
          <div className={leadStyles.toolbarActions}>
            <button type="submit" className={managementStyles.buttonPrimary}>
              <Search size={16} aria-hidden="true" />
              Buscar
            </button>
            <Link href={viewHref(view, "", scopeId)} className={managementStyles.button}>
              Limpar
            </Link>
          </div>
        </div>

        <details className={managementStyles.disclosure}>
          <summary className={`${managementStyles.button} w-full justify-between`}>
            <span className="inline-flex items-center gap-2">
              <Filter size={16} aria-hidden="true" />
              Filtros avançados
            </span>
            <span className={leadStyles.meta}>Canal, origem, responsável, etapa e período</span>
          </summary>
          <div className={leadStyles.filterPanel}>
            <FilterSelect name="canal" label="Canal" options={channels} />
            <FilterSelect name="origem" label="Origem" options={sources} />
            <FilterSelect name="responsavel" label="Responsável" options={responsibles} />
            <label className={leadStyles.field}>
              Etapa
              <input className={leadStyles.input} name="etapa" placeholder="Todas as etapas" />
            </label>
            <label className={leadStyles.field}>
              Interação desde
              <input className={leadStyles.input} name="desde" type="date" />
            </label>
            <label className={leadStyles.field}>
              Interação até
              <input className={leadStyles.input} name="ate" type="date" />
            </label>
            <div className={`${leadStyles.inlineActions} ${leadStyles.fieldWide}`}>
              <button type="submit" className={managementStyles.buttonPrimary}>
                Aplicar filtros
              </button>
              <Link href={viewHref(view, "", scopeId)} className={managementStyles.button}>
                Remover filtros
              </Link>
            </div>
          </div>
        </details>
      </form>

      <div className={leadStyles.split}>
        <section className={leadStyles.stack} aria-labelledby="lead-results-title">
          <div className={managementStyles.sectionHeader}>
            <div>
              <h2 id="lead-results-title" className={managementStyles.sectionTitle}>
                Resultados
              </h2>
              <p className={managementStyles.sectionDescription} aria-live="polite">
                {total === null ? "Total indisponível" : `${total} lead${total === 1 ? "" : "s"}`}
              </p>
            </div>
            <details className={managementStyles.disclosure}>
              <summary className={managementStyles.buttonPrimary}>
                <Plus size={16} aria-hidden="true" />
                Novo lead
              </summary>
              <LeadEditorForm
                action={saveLeadAction}
                channels={channels}
                sources={sources}
                responsibles={responsibles}
                scopeId={scopeId}
              />
            </details>
          </div>

          {state === "ready" || state === "empty" ? (
            <LeadResultsTable items={items} query={query} view={view} scopeId={scopeId} />
          ) : (
            <LeadStatePanel
              state={state === "error" ? "error" : "not_configured"}
              title={
                state === "error"
                  ? "Lista temporariamente indisponível"
                  : "Nenhum lead foi consultado"
              }
              description={
                state === "error"
                  ? "A consulta falhou. Tente novamente; nenhuma informação anterior foi apresentada como atual."
                  : "Conecte a DAL autorizada para pesquisar e paginar registros reais."
              }
            />
          )}

          <nav className={leadStyles.pagination} aria-label="Paginação de leads">
            <span>
              Página {page} de {Math.max(1, pageCount)}
            </span>
            <span className={leadStyles.paginationControls}>
              <PaginationLink
                direction="previous"
                page={page - 1}
                disabled={page <= 1}
                view={view}
                query={query}
                scopeId={scopeId}
              />
              <PaginationLink
                direction="next"
                page={page + 1}
                disabled={page >= pageCount}
                view={view}
                query={query}
                scopeId={scopeId}
              />
            </span>
          </nav>
        </section>

        <LeadDetailPanel
          lead={selectedLead}
          editAction={saveLeadAction}
          addMessageAction={addMessageAction}
          addActivityAction={addActivityAction}
          toggleFavoriteAction={toggleFavoriteAction}
          archiveAction={archiveAction}
          rescueAction={rescueAction}
          closeAction={closeAction}
          channels={channels}
          sources={sources}
          responsibles={responsibles}
          scopeId={scopeId}
        />
      </div>

      {!mutationsReady ? (
        <p className={leadStyles.helper} role="status">
          Cadastro, edição e ações de ciclo de vida permanecem bloqueados até a integração com ações
          de servidor autorizadas.
        </p>
      ) : null}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly LeadFilterOption[];
}) {
  return (
    <label className={leadStyles.field}>
      {label}
      <select className={leadStyles.select} name={name} defaultValue="">
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeadResultsTable({
  items,
  query,
  view,
  scopeId,
}: {
  items: readonly LeadListItem[];
  query: string;
  view: LeadListView;
  scopeId?: string | undefined;
}) {
  return (
    <div
      className={leadStyles.tableRegion}
      tabIndex={0}
      aria-label="Tabela de leads; deslize horizontalmente em telas estreitas"
    >
      <table className={leadStyles.table}>
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Interesse</th>
            <th scope="col">Responsável</th>
            <th scope="col">Status</th>
            <th scope="col">Etapa</th>
            <th scope="col">Última interação</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((lead) => {
              const params = new URLSearchParams({ visao: view, lead: lead.id });
              if (query) params.set("busca", query);
              if (scopeId) params.set("scope", scopeId);
              return (
                <tr key={lead.id}>
                  <th scope="row">
                    <Link
                      className={leadStyles.cardLink}
                      href={`/app/leads/lista?${params.toString()}`}
                      prefetch={false}
                    >
                      {lead.customerName}
                    </Link>
                    {lead.isFavorite ? <span className="sr-only">, favorito</span> : null}
                  </th>
                  <td>{lead.interest ?? "Não informado"}</td>
                  <td>{lead.responsibleName ?? "Não atribuído"}</td>
                  <td>
                    <span className={leadStyles.pill}>{lead.statusLabel}</span>
                  </td>
                  <td>{lead.stageLabel}</td>
                  <td>{lead.lastInteractionLabel ?? "Sem interação"}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className={leadStyles.emptyCell}>
                Nenhum lead corresponde a esta visão e aos filtros aplicados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadEditorForm({
  action,
  lead,
  channels,
  sources,
  responsibles,
  scopeId,
}: {
  action?: LeadMutation | undefined;
  lead?: LeadDetail;
  channels: readonly LeadFilterOption[];
  sources: readonly LeadFilterOption[];
  responsibles: readonly LeadFilterOption[];
  scopeId?: string | undefined;
}) {
  const disabled = !action;
  return (
    <form {...(action ? { action } : {})} className={managementStyles.actionPanel}>
      {lead ? <input type="hidden" name="leadId" value={lead.id} /> : null}
      {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
      <div className={leadStyles.formGrid}>
        <label className={leadStyles.field}>
          Nome do cliente
          <input
            className={leadStyles.input}
            name="customerName"
            defaultValue={lead?.customerName}
            required
            disabled={disabled}
          />
        </label>
        <label className={leadStyles.field}>
          Telefone
          <input
            className={leadStyles.input}
            name="phone"
            type="tel"
            defaultValue={lead?.phone ?? ""}
            autoComplete="tel"
            disabled={disabled}
          />
        </label>
        <label className={leadStyles.field}>
          E-mail
          <input
            className={leadStyles.input}
            name="email"
            type="email"
            defaultValue={lead?.email ?? ""}
            autoComplete="email"
            disabled={disabled}
          />
        </label>
        <label className={leadStyles.field}>
          Interesse
          <input
            className={leadStyles.input}
            name="interest"
            defaultValue={lead?.interest ?? ""}
            disabled={disabled}
          />
        </label>
        <EditorSelect name="channelId" label="Canal" options={channels} disabled={disabled} />
        <EditorSelect name="sourceId" label="Origem" options={sources} disabled={disabled} />
        <EditorSelect
          name="responsibleId"
          label="Responsável"
          options={responsibles}
          disabled={disabled}
        />
        <label className={`${leadStyles.field} ${leadStyles.fieldWide}`}>
          Mensagem inicial
          <textarea
            className={leadStyles.textarea}
            name="message"
            defaultValue={lead?.message ?? ""}
            disabled={disabled}
          />
        </label>
      </div>
      <div className={leadStyles.inlineActions}>
        <button className={managementStyles.buttonPrimary} type="submit" disabled={disabled}>
          {lead ? "Salvar alterações" : "Cadastrar lead"}
        </button>
        {disabled ? (
          <span className={leadStyles.helper}>Ação de servidor não configurada.</span>
        ) : null}
      </div>
    </form>
  );
}

function EditorSelect({
  name,
  label,
  options,
  disabled,
}: {
  name: string;
  label: string;
  options: readonly LeadFilterOption[];
  disabled: boolean;
}) {
  return (
    <label className={leadStyles.field}>
      {label}
      <select className={leadStyles.select} name={name} defaultValue="" disabled={disabled}>
        <option value="">Não informado</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeadDetailPanel({
  lead,
  editAction,
  addMessageAction,
  addActivityAction,
  toggleFavoriteAction,
  archiveAction,
  rescueAction,
  closeAction,
  channels,
  sources,
  responsibles,
  scopeId,
}: {
  lead: LeadDetail | null;
  editAction?: LeadMutation | undefined;
  addMessageAction?: LeadMutation | undefined;
  addActivityAction?: LeadMutation | undefined;
  toggleFavoriteAction?: LeadMutation | undefined;
  archiveAction?: LeadMutation | undefined;
  rescueAction?: LeadMutation | undefined;
  closeAction?: LeadMutation | undefined;
  channels: readonly LeadFilterOption[];
  sources: readonly LeadFilterOption[];
  responsibles: readonly LeadFilterOption[];
  scopeId?: string | undefined;
}) {
  if (!lead) {
    return (
      <aside aria-label="Detalhes do lead">
        <LeadStatePanel
          state="empty"
          title="Selecione um lead"
          description="Abra um resultado para consultar cadastro, histórico, mensagens e ações."
        />
      </aside>
    );
  }

  return (
    <aside className={leadStyles.stack} aria-labelledby="selected-lead-title">
      <section className={managementStyles.panel}>
        <header className={leadStyles.panelHeader}>
          <div>
            <h2 id="selected-lead-title" className={leadStyles.panelTitle}>
              {lead.customerName}
            </h2>
            <p className={leadStyles.panelDescription}>
              {lead.stageLabel} · {lead.statusLabel}
            </p>
          </div>
          <MutationButton
            action={toggleFavoriteAction}
            leadId={lead.id}
            label={lead.isFavorite ? "Remover favorito" : "Marcar favorito"}
            icon={Heart}
          />
        </header>
        <div className={leadStyles.panelBody}>
          <dl className={leadStyles.detailGrid}>
            <DetailItem label="Telefone" value={lead.phone} />
            <DetailItem label="E-mail" value={lead.email} />
            <DetailItem label="Interesse" value={lead.interest} />
            <DetailItem label="Responsável" value={lead.responsibleName} />
            <DetailItem label="Canal" value={lead.channelLabel} />
            <DetailItem label="Origem" value={lead.sourceLabel} />
          </dl>
          <div className={`${leadStyles.tags} mt-3`} aria-label="Etiquetas do lead">
            <Tag size={15} aria-hidden="true" />
            {lead.tags.length > 0 ? (
              lead.tags.map((tag) => (
                <span key={tag} className={leadStyles.tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className={leadStyles.helper}>Sem etiquetas</span>
            )}
          </div>
        </div>
      </section>

      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full justify-between`}>
          Editar cadastro
        </summary>
        <LeadEditorForm
          action={editAction}
          lead={lead}
          channels={channels}
          sources={sources}
          responsibles={responsibles}
          scopeId={scopeId}
        />
      </details>

      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full justify-between`}>
          <span className="inline-flex items-center gap-2">
            <MessageSquareText size={16} aria-hidden="true" />
            Adicionar mensagem
          </span>
        </summary>
        <SimpleMutationForm
          action={addMessageAction}
          leadId={lead.id}
          field="message"
          label="Mensagem"
          submitLabel="Registrar mensagem"
          multiline
        />
      </details>

      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full justify-between`}>
          Agendar atividade
        </summary>
        <form
          {...(addActivityAction ? { action: addActivityAction } : {})}
          className={managementStyles.actionPanel}
        >
          <input type="hidden" name="leadId" value={lead.id} />
          <label className={leadStyles.field}>
            Título
            <input
              className={leadStyles.input}
              name="title"
              required
              disabled={!addActivityAction}
            />
          </label>
          <label className={leadStyles.field}>
            Data e horário
            <input
              className={leadStyles.input}
              name="dueAt"
              type="datetime-local"
              required
              disabled={!addActivityAction}
            />
          </label>
          <label className={leadStyles.field}>
            Tipo
            <select
              className={leadStyles.select}
              name="type"
              defaultValue="task"
              disabled={!addActivityAction}
            >
              <option value="task">Tarefa</option>
              <option value="visit">Visita</option>
              <option value="call">Ligação</option>
            </select>
          </label>
          <button
            className={managementStyles.buttonPrimary}
            type="submit"
            disabled={!addActivityAction}
          >
            Salvar atividade
          </button>
        </form>
      </details>

      <section className={managementStyles.panel} aria-labelledby="lead-history-title">
        <header className={leadStyles.panelHeader}>
          <h2 id="lead-history-title" className={leadStyles.panelTitle}>
            Histórico
          </h2>
        </header>
        <div className={leadStyles.panelBody}>
          {lead.timeline.length > 0 ? (
            <ol className={leadStyles.timeline}>
              {lead.timeline.map((event) => (
                <li key={event.id} className={leadStyles.timelineItem}>
                  <div>
                    <strong className="block text-sm text-[var(--analytics-ink)]">
                      {event.title}
                    </strong>
                    {event.description ? (
                      <p className={leadStyles.panelDescription}>{event.description}</p>
                    ) : null}
                    <span className={leadStyles.meta}>
                      {event.occurredAtLabel}
                      {event.authorLabel ? ` · ${event.authorLabel}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={leadStyles.helper}>Nenhum evento registrado.</p>
          )}
        </div>
      </section>

      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
        aria-label="Ações do lead"
      >
        <div className={leadStyles.inlineActions}>
          {lead.isArchived ? (
            <MutationButton
              action={rescueAction}
              leadId={lead.id}
              label="Resgatar"
              icon={RotateCcw}
            />
          ) : (
            <MutationButton
              action={archiveAction}
              leadId={lead.id}
              label="Arquivar"
              icon={Archive}
            />
          )}
          <MutationButton
            action={closeAction}
            leadId={lead.id}
            label="Fechar lead"
            icon={XCircle}
            danger
          />
        </div>
      </section>
    </aside>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={leadStyles.detailItem}>
      <dt>{label}</dt>
      <dd>{value ?? "Não informado"}</dd>
    </div>
  );
}

function SimpleMutationForm({
  action,
  leadId,
  field,
  label,
  submitLabel,
  multiline = false,
}: {
  action?: LeadMutation | undefined;
  leadId: string;
  field: string;
  label: string;
  submitLabel: string;
  multiline?: boolean;
}) {
  return (
    <form {...(action ? { action } : {})} className={managementStyles.actionPanel}>
      <input type="hidden" name="leadId" value={leadId} />
      <label className={leadStyles.field}>
        {label}
        {multiline ? (
          <textarea className={leadStyles.textarea} name={field} required disabled={!action} />
        ) : (
          <input className={leadStyles.input} name={field} required disabled={!action} />
        )}
      </label>
      <button className={managementStyles.buttonPrimary} type="submit" disabled={!action}>
        <Send size={16} aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}

function MutationButton({
  action,
  leadId,
  label,
  icon: Icon,
  danger = false,
}: {
  action?: LeadMutation | undefined;
  leadId: string;
  label: string;
  icon: typeof Heart;
  danger?: boolean;
}) {
  return (
    <form {...(action ? { action } : {})}>
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        className={danger ? managementStyles.buttonDanger : managementStyles.button}
        disabled={!action}
        title={!action ? "Ação não configurada" : undefined}
      >
        <Icon size={16} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function PaginationLink({
  direction,
  page,
  disabled,
  view,
  query,
  scopeId,
}: {
  direction: "previous" | "next";
  page: number;
  disabled: boolean;
  view: LeadListView;
  query: string;
  scopeId?: string | undefined;
}) {
  const label = direction === "previous" ? "Página anterior" : "Próxima página";
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  if (disabled)
    return (
      <span className={managementStyles.button} aria-disabled="true">
        <Icon size={16} aria-hidden="true" />
        {label}
      </span>
    );
  const params = new URLSearchParams({ visao: view, pagina: String(page) });
  if (query) params.set("busca", query);
  if (scopeId) params.set("scope", scopeId);
  return (
    <Link
      className={managementStyles.button}
      href={`/app/leads/lista?${params.toString()}`}
      prefetch={false}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}
