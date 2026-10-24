import { enforcePageAccess } from "@/lib/authorization/enforce";
import { LeadDataError, resolveLeadScope } from "@/lib/crm/leads/data";

import {
  LeadActivitiesWorkspace,
  type LeadActivityBucket,
} from "../_components/LeadActivitiesWorkspace";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Atividades de leads" };

const ACTIVITY_BUCKETS = new Set<LeadActivityBucket>(["overdue", "today", "visits", "future"]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LeadActivitiesPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await enforcePageAccess("/app/leads/atividades");
  const params = (await props?.searchParams) ?? {};
  const requested = firstValue(params.grupo) as LeadActivityBucket;
  const activeBucket = ACTIVITY_BUCKETS.has(requested) ? requested : "overdue";
  const requestedScopeId = firstValue(params.scope) || firstValue(params.escopo);
  let sourceState: LeadSourceState = "not_configured";
  let scopes: ReadonlyArray<{ id: string; name: string }> = [];
  let selectedScopeId: string | undefined;
  let invalidScope = false;

  if (props) {
    try {
      const scopeResolution = await resolveLeadScope(requestedScopeId || undefined);
      scopes = scopeResolution.scopes;
      invalidScope = scopeResolution.status === "invalid";
      if (scopeResolution.status === "ready") selectedScopeId = scopeResolution.scope.id;
      else if (scopeResolution.status === "scope_required" || scopeResolution.status === "invalid")
        sourceState = "scope_required";
    } catch (error) {
      if (error instanceof LeadDataError) sourceState = "error";
      else throw error;
    }
  }

  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Atividades"
      description="Tarefas, visitas e próximos compromissos vinculados aos leads."
      sourceState={sourceState}
    >
      <LeadSourceNotice state={sourceState} />
      <LeadScopeSelector scopes={scopes} selectedScopeId={selectedScopeId} invalid={invalidScope} />
      <LeadActivitiesWorkspace
        state={sourceState}
        activeBucket={activeBucket}
        activities={[]}
        counts={{}}
        scopeId={selectedScopeId}
      />
    </LeadPageShell>
  );
}
