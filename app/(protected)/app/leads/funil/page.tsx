import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getLeadCatalogs, LeadDataError, listLeads, resolveLeadScope } from "@/lib/crm/leads/data";

import { LeadFunnelWorkspace, type LeadFunnelStage } from "../_components/LeadFunnelWorkspace";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Funil de leads" };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LeadFunnelPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await enforcePageAccess("/app/leads/funil");
  const params = (await props?.searchParams) ?? {};
  const requestedScopeId = firstValue(params.scope) || firstValue(params.escopo);
  let sourceState: LeadSourceState = "not_configured";
  let scopes: ReadonlyArray<{ id: string; name: string }> = [];
  let selectedScopeId: string | undefined;
  let invalidScope = false;
  let stages: LeadFunnelStage[] = [];
  let totalLeads: number | null = null;
  let visibleLeads: number | undefined;
  let overallConversionPercent: number | null = null;

  if (props) {
    try {
      const scopeResolution = await resolveLeadScope(requestedScopeId || undefined);
      scopes = scopeResolution.scopes;
      invalidScope = scopeResolution.status === "invalid";
      if (scopeResolution.status === "ready") {
        selectedScopeId = scopeResolution.scope.id;
        const [catalogs, result] = await Promise.all([
          getLeadCatalogs(scopeResolution.scope.id),
          listLeads({ organizationId: scopeResolution.scope.id, limit: 100, offset: 0 }),
        ]);
        const responsibleById = new Map(catalogs.responsibles.map(({ id, label }) => [id, label]));
        stages = catalogs.stages
          .filter(({ terminal }) => !terminal)
          .sort((left, right) => left.position - right.position)
          .map((stage) => {
            const leads = result.items
              .filter((lead) => lead.stageId === stage.id && lead.status === "open")
              .map((lead) => ({
                id: lead.id,
                customerName: lead.customer.name,
                interest: lead.interest?.title ?? lead.interest?.propertyKind ?? null,
                responsibleName: lead.responsibleUserId
                  ? (responsibleById.get(lead.responsibleUserId) ?? "Atribuído")
                  : null,
                nextActivityLabel: null,
              }));
            return {
              id: stage.id,
              label: stage.name,
              leads,
              total: leads.length,
              conversionPercent: null,
            };
          });
        totalLeads = result.total;
        visibleLeads = result.items.length;
        const won = result.items.filter(({ status }) => status === "won").length;
        overallConversionPercent =
          result.total > 0 && result.total === result.items.length
            ? Math.round((won / result.total) * 100)
            : null;
        sourceState = result.total === 0 ? "empty" : "ready";
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
      title="Funil"
      description="Acompanhamento das oportunidades por etapa comercial e análise de conversão."
      sourceState={sourceState}
    >
      <LeadSourceNotice state={sourceState} />
      <LeadScopeSelector scopes={scopes} selectedScopeId={selectedScopeId} invalid={invalidScope} />
      <LeadFunnelWorkspace
        state={sourceState}
        stages={stages}
        totalLeads={totalLeads}
        visibleLeads={visibleLeads}
        averageCycleLabel={null}
        overallConversionPercent={overallConversionPercent}
        scopeId={selectedScopeId}
      />
    </LeadPageShell>
  );
}
