import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getLeadDistribution } from "@/lib/crm/leads/operations-data";

import {
  assignLeadFormAction,
  saveLeadDistributionFormAction,
  setLeadPresenceFormAction,
} from "../operations-actions";
import {
  LeadDistributionWorkspace,
  type DistributionQueue,
  type DistributionView,
} from "../_components/LeadDistributionWorkspace";
import { firstSearchValue, resolveLeadPageScope } from "../_components/LeadPageScope";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Distribuição de leads" };
const VIEWS = new Set<DistributionView>(["queues", "rules", "members", "checkin", "explanation"]);
const text = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === "string" ? record[key] : null;
const number = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === "number" ? record[key] : null;
const bool = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === "boolean" ? record[key] : false;
const records = (record: Record<string, unknown>, key: string) =>
  Array.isArray(record[key])
    ? (record[key] as unknown[]).filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];

async function saveDistribution(formData: FormData) {
  "use server";
  await saveLeadDistributionFormAction(formData);
}
async function setPresence(formData: FormData) {
  "use server";
  await setLeadPresenceFormAction(formData);
}
async function assignLead(formData: FormData) {
  "use server";
  await assignLeadFormAction(formData);
}

export default async function LeadDistributionPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await enforcePageAccess("/app/leads/distribuicao");
  const params = (await props?.searchParams) ?? {};
  const requestedView = firstSearchValue(params.visao) as DistributionView;
  const view = VIEWS.has(requestedView) ? requestedView : "queues";
  const scope = await resolveLeadPageScope(params, Boolean(props));
  let state: LeadSourceState = scope.state;
  let queues: DistributionQueue[] = [];
  let explanations: Array<{
    id: string;
    leadLabel: string;
    queueLabel: string;
    responsibleLabel: string | null;
    reason: string;
    occurredAtLabel: string;
  }> = [];
  let documentJson: string | undefined;
  if (scope.selectedScopeId) {
    try {
      const snapshot = await getLeadDistribution(scope.selectedScopeId);
      documentJson = JSON.stringify({ queues: snapshot.queues, rules: snapshot.rules }, null, 2);
      queues = snapshot.queues.map((queue, index) => {
        const queueKey = text(queue, "key") ?? `queue-${index + 1}`;
        const queueRules = snapshot.rules.filter((rule) => text(rule, "queueKey") === queueKey);
        return {
          id: text(queue, "id") ?? queueKey,
          name: text(queue, "name") ?? "Fila sem nome",
          active: bool(queue, "active"),
          priority: null,
          revision: snapshot.revision,
          strategyLabel: "Não informada",
          fallbackLabel:
            queueRules.map((rule) => text(rule, "fallbackQueueKey")).find(Boolean) ?? null,
          rules: queueRules.map((rule, ruleIndex) => ({
            id: `${queueKey}-${ruleIndex}`,
            order: number(rule, "priority") ?? ruleIndex,
            fieldLabel: text(rule, "name") ?? "Critério",
            operatorLabel: "corresponde a",
            valueLabel: JSON.stringify(rule.criteria ?? {}),
          })),
          members: records(queue, "members").map((member, memberIndex) => ({
            id: text(member, "userId") ?? `${queueKey}-member-${memberIndex}`,
            name: `Membro autorizado ${memberIndex + 1}`,
            weight: number(member, "weight") ?? 1,
            position: memberIndex + 1,
            presenceLabel: "Não consultada",
            active: bool(member, "active"),
          })),
        };
      });
      const queueNames = new Map(queues.map((queue) => [queue.id, queue.name]));
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });
      explanations = snapshot.recentEvents.map((event) => ({
        id: event.id,
        leadLabel: `Lead ${event.leadId}`,
        queueLabel: event.queueId
          ? (queueNames.get(event.queueId) ?? "Fila registrada")
          : "Sem fila",
        responsibleLabel: event.assignedUserId ? "Responsável atribuído" : null,
        reason: `${event.outcome}; ${Object.keys(event.explanation).join(", ") || "sem detalhes adicionais"}`,
        occurredAtLabel: formatter.format(new Date(event.createdAt)),
      }));
      state = queues.length > 0 ? "ready" : "empty";
    } catch {
      state = "error";
    }
  }
  const canManage = access.permissions.includes("crm.leads.distribution.manage");
  const canAssign = access.permissions.includes("crm.leads.distribution.assign");
  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Distribuição"
      description="Filas, regras, membros, presença e explicação de cada atribuição."
      sourceState={state}
    >
      <LeadSourceNotice state={state} />
      <LeadScopeSelector
        scopes={scope.scopes}
        selectedScopeId={scope.selectedScopeId}
        invalid={scope.invalid}
      />
      <LeadDistributionWorkspace
        state={state}
        view={view}
        queues={queues}
        explanations={explanations}
        scopeId={scope.selectedScopeId}
        canManage={canManage}
        canAssign={canAssign}
        documentJson={documentJson}
        saveDistributionAction={canManage ? saveDistribution : undefined}
        checkInAction={canAssign ? setPresence : undefined}
        assignAction={canAssign ? assignLead : undefined}
      />
    </LeadPageShell>
  );
}
