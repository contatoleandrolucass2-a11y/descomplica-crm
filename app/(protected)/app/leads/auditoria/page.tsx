import { enforcePageAccess } from "@/lib/authorization/enforce";
import { listLeadOperationsAudit } from "@/lib/crm/leads/operations-data";

import {
  LeadAuditWorkspace,
  type LeadAuditEvent,
  type LeadAuditFilters,
} from "../_components/LeadAuditWorkspace";
import { firstSearchValue, resolveLeadPageScope } from "../_components/LeadPageScope";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Auditoria de leads" };
const PAGE_SIZE = 50;
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const SAFE_METADATA_FIELDS = new Set([
  "active",
  "priority",
  "revision",
  "queueId",
  "stageId",
  "status",
  "weight",
  "capacity",
  "available",
  "report",
  "batchId",
]);

export default async function LeadAuditPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await enforcePageAccess("/app/leads/auditoria");
  const params = (await props?.searchParams) ?? {};
  const requestedPage = Number.parseInt(firstSearchValue(params.pagina), 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const scope = await resolveLeadPageScope(params, Boolean(props));
  let state: LeadSourceState = scope.state;
  let events: LeadAuditEvent[] = [];
  let total: number | null = null;
  let pageCount = 1;
  const appliedFilters: LeadAuditFilters = {
    action: firstSearchValue(params.acao),
    actor: firstSearchValue(params.autor),
    record: firstSearchValue(params.registro),
    from: firstSearchValue(params.desde),
    to: firstSearchValue(params.ate),
  };
  if (scope.selectedScopeId) {
    try {
      const action = firstSearchValue(params.acao).slice(0, 120);
      const actor = firstSearchValue(params.autor);
      const entityId = firstSearchValue(params.registro);
      const from = firstSearchValue(params.desde);
      const to = firstSearchValue(params.ate);
      const filters: Record<string, unknown> = {};
      if (action) filters.action = action;
      if (/^[0-9a-f-]{36}$/i.test(actor)) filters.actorId = actor;
      if (/^[0-9a-f-]{36}$/i.test(entityId)) filters.entityId = entityId;
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) filters.from = from;
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) filters.to = to;
      const result = await listLeadOperationsAudit(
        scope.selectedScopeId,
        filters,
        PAGE_SIZE,
        (page - 1) * PAGE_SIZE,
      );
      events = result.items.map((item) => ({
        id: item.id,
        actionLabel: item.action,
        resourceLabel: item.entityId ? `${item.entityType} · ${item.entityId}` : item.entityType,
        actorLabel: "Usuário autenticado",
        scopeLabel: "Escopo selecionado",
        reason: item.reason ? "Motivo registrado" : null,
        occurredAtLabel: DATE_FORMAT.format(new Date(item.createdAt)),
        changedFields: Object.keys(item.metadata).filter((key) => SAFE_METADATA_FIELDS.has(key)),
      }));
      total = result.total;
      pageCount = Math.max(1, Math.ceil(result.total / result.limit));
      state = result.total > 0 ? "ready" : "empty";
    } catch {
      state = "error";
    }
  }
  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Auditoria"
      description="Rastreabilidade operacional sem exposição de dados pessoais ou conteúdo sensível."
      sourceState={state}
    >
      <LeadSourceNotice state={state} />
      <LeadScopeSelector
        scopes={scope.scopes}
        selectedScopeId={scope.selectedScopeId}
        invalid={scope.invalid}
      />
      <LeadAuditWorkspace
        state={state}
        events={events}
        scopeId={scope.selectedScopeId}
        page={page}
        pageCount={pageCount}
        total={total}
        filters={appliedFilters}
      />
    </LeadPageShell>
  );
}
