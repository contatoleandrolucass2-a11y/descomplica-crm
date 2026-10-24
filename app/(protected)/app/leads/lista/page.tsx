import { enforcePageAccess } from "@/lib/authorization/enforce";
import type {
  LeadDetail as LeadDataDetail,
  LeadListItem as LeadDataListItem,
} from "@/lib/crm/leads/contracts";
import {
  getLead,
  getLeadCatalogs,
  LeadDataError,
  listLeads,
  resolveLeadScope,
} from "@/lib/crm/leads/data";

import {
  addLeadActivityFormAction,
  addLeadMessageFormAction,
  archiveLeadFormAction,
  closeLeadFormAction,
  rescueLeadFormAction,
  saveLeadFormAction,
  toggleLeadFavoriteFormAction,
} from "../actions";

import {
  LeadListWorkspace,
  type LeadDetail,
  type LeadListItem,
  type LeadListView,
  type LeadTimelineItem,
} from "../_components/LeadListWorkspace";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Lista de leads" };

const LIST_VIEWS = new Set<LeadListView>(["todo", "visits", "future", "favorites", "all"]);
const PAGE_SIZE = 25;
const STATUS_LABEL = { open: "Aberto", won: "Ganho", lost: "Perdido" } as const;
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function saveLeadFromForm(formData: FormData) {
  "use server";
  await saveLeadFormAction(formData);
}
async function addMessageFromForm(formData: FormData) {
  "use server";
  await addLeadMessageFormAction(formData);
}
async function addActivityFromForm(formData: FormData) {
  "use server";
  await addLeadActivityFormAction(formData);
}
async function toggleFavoriteFromForm(formData: FormData) {
  "use server";
  await toggleLeadFavoriteFormAction(formData);
}
async function archiveFromForm(formData: FormData) {
  "use server";
  await archiveLeadFormAction(formData);
}
async function rescueFromForm(formData: FormData) {
  "use server";
  await rescueLeadFormAction(formData);
}
async function closeFromForm(formData: FormData) {
  "use server";
  await closeLeadFormAction(formData);
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function dateLabel(value: string | null) {
  return value ? DATE_FORMAT.format(new Date(value)) : null;
}

function mapListItem(item: LeadDataListItem): LeadListItem {
  return {
    id: item.id,
    customerName: item.customer.name,
    interest: item.interest?.title ?? item.interest?.propertyKind ?? null,
    responsibleName: item.responsibleUserId ? "Atribuído" : null,
    statusLabel: STATUS_LABEL[item.status],
    stageLabel: "Etapa ativa",
    lastInteractionLabel: dateLabel(item.updatedAt),
    isFavorite: item.favorite,
  };
}

function buildTimeline(detail: LeadDataDetail): LeadTimelineItem[] {
  return [
    ...detail.activities.map((activity) => ({
      id: `activity-${activity.id}`,
      title: activity.title,
      description: activity.description,
      occurredAt: activity.createdAt,
      occurredAtLabel: dateLabel(activity.createdAt) ?? "Data indisponível",
      authorLabel: null,
    })),
    ...detail.messages.map((message) => ({
      id: `message-${message.id}`,
      title:
        message.direction === "inbound"
          ? "Mensagem recebida"
          : message.direction === "outbound"
            ? "Mensagem enviada"
            : "Anotação interna",
      description: message.body,
      occurredAt: message.occurredAt,
      occurredAtLabel: dateLabel(message.occurredAt) ?? "Data indisponível",
      authorLabel: null,
    })),
    ...detail.stageHistory.map((event) => ({
      id: `stage-${event.id}`,
      title: "Etapa atualizada",
      description: event.reason,
      occurredAt: event.createdAt,
      occurredAtLabel: dateLabel(event.createdAt) ?? "Data indisponível",
      authorLabel: null,
    })),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      occurredAtLabel: item.occurredAtLabel,
      authorLabel: item.authorLabel,
    }));
}

function mapDetail(detail: LeadDataDetail): LeadDetail {
  const stage = detail.catalogs.stages.find(({ id }) => id === detail.lead.stageId);
  const channel = detail.catalogs.channels.find(({ id }) => id === detail.lead.channelId);
  const source = detail.catalogs.sources.find(({ id }) => id === detail.lead.sourceId);
  return {
    id: detail.lead.id,
    customerName: detail.customer.name,
    phone: detail.customer.phone,
    email: detail.customer.email,
    interest: detail.interest?.title ?? detail.interest?.propertyKind ?? null,
    responsibleName: detail.lead.responsibleUserId ? "Atribuído" : null,
    statusLabel: STATUS_LABEL[detail.lead.status],
    stageLabel: stage?.name ?? "Etapa ativa",
    lastInteractionLabel: dateLabel(detail.lead.updatedAt),
    isFavorite: detail.lead.favorite,
    isArchived: detail.lead.archivedAt !== null,
    channelLabel: channel?.name ?? null,
    sourceLabel: source?.name ?? null,
    message: detail.lead.summary,
    tags: detail.tags.map(({ name }) => name),
    timeline: buildTimeline(detail),
  };
}

export default async function LeadsListPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await enforcePageAccess("/app/leads/lista");
  const params = (await props?.searchParams) ?? {};
  const requestedView = firstValue(params.visao) as LeadListView;
  const view = LIST_VIEWS.has(requestedView) ? requestedView : "todo";
  const query = firstValue(params.busca).slice(0, 120);
  const requestedPage = Number.parseInt(firstValue(params.pagina), 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedScopeId = firstValue(params.scope) || firstValue(params.escopo);
  let sourceState: LeadSourceState = "not_configured";
  let items: LeadListItem[] = [];
  let selectedLead: LeadDetail | null = null;
  let total: number | null = null;
  let pageCount = 1;
  let scopes: ReadonlyArray<{ id: string; name: string }> = [];
  let selectedScopeId: string | undefined;
  let invalidScope = false;
  let channels: Array<{ value: string; label: string }> = [];
  let sources: Array<{ value: string; label: string }> = [];
  let responsibles: Array<{ value: string; label: string }> = [];

  if (props) {
    try {
      const scopeResolution = await resolveLeadScope(requestedScopeId || undefined);
      scopes = scopeResolution.scopes;
      invalidScope = scopeResolution.status === "invalid";
      if (scopeResolution.status === "ready") {
        selectedScopeId = scopeResolution.scope.id;
        const [result, catalogs] = await Promise.all([
          listLeads({
            organizationId: scopeResolution.scope.id,
            ...(query ? { query } : {}),
            ...(view === "favorites" ? { favorite: true } : {}),
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          }),
          getLeadCatalogs(scopeResolution.scope.id),
        ]);
        channels = catalogs.channels.map(({ id, name }) => ({ value: id, label: name }));
        sources = catalogs.sources.map(({ id, name }) => ({ value: id, label: name }));
        responsibles = catalogs.responsibles.map(({ id, label }) => ({ value: id, label }));
        items = result.items.map(mapListItem);
        total = result.total;
        pageCount = Math.max(1, Math.ceil(result.total / result.limit));
        sourceState = result.total === 0 ? "empty" : "ready";

        const selectedId = firstValue(params.lead);
        if (selectedId) {
          const detail = await getLead(selectedId);
          if (detail.lead.organizationId === scopeResolution.scope.id)
            selectedLead = mapDetail(detail);
        }
      } else if (
        scopeResolution.status === "scope_required" ||
        scopeResolution.status === "invalid"
      ) {
        sourceState = "scope_required";
      }
    } catch (error) {
      if (error instanceof LeadDataError) sourceState = "error";
      else throw error;
    }
  }

  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Lista de leads"
      description="Pesquisa, filtros, cadastro e acompanhamento diário dos contatos comerciais."
      sourceState={sourceState}
    >
      <LeadSourceNotice state={sourceState} />
      <LeadScopeSelector scopes={scopes} selectedScopeId={selectedScopeId} invalid={invalidScope} />
      <LeadListWorkspace
        state={sourceState}
        items={items}
        selectedLead={selectedLead}
        query={query}
        view={view}
        page={page}
        pageCount={pageCount}
        total={total}
        scopeId={selectedScopeId}
        channels={channels}
        sources={sources}
        responsibles={responsibles}
        saveLeadAction={selectedScopeId ? saveLeadFromForm : undefined}
        addMessageAction={selectedScopeId ? addMessageFromForm : undefined}
        addActivityAction={selectedScopeId ? addActivityFromForm : undefined}
        toggleFavoriteAction={selectedScopeId ? toggleFavoriteFromForm : undefined}
        archiveAction={selectedScopeId ? archiveFromForm : undefined}
        rescueAction={selectedScopeId ? rescueFromForm : undefined}
        closeAction={selectedScopeId ? closeFromForm : undefined}
      />
    </LeadPageShell>
  );
}
