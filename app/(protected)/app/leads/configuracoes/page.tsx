import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getLeadOperationsSettings } from "@/lib/crm/leads/operations-data";

import { saveLeadSettingsFormAction } from "../operations-actions";
import { resolveLeadPageScope } from "../_components/LeadPageScope";
import { LeadSettingsWorkspace, type LeadSettingsData } from "../_components/LeadSettingsWorkspace";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Configurações de leads" };
async function saveSettings(formData: FormData) {
  "use server";
  await saveLeadSettingsFormAction(formData);
}

export default async function LeadSettingsPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await enforcePageAccess("/app/leads/configuracoes");
  const params = (await props?.searchParams) ?? {};
  const scope = await resolveLeadPageScope(params, Boolean(props));
  let state: LeadSourceState = scope.state;
  let settings: LeadSettingsData | null = null;
  let documentJson: string | undefined;
  if (scope.selectedScopeId) {
    try {
      const result = await getLeadOperationsSettings(scope.selectedScopeId);
      settings = {
        revision: result.revision,
        duplicateWindowDays: result.document.adjustments.duplicateWindowDays ?? null,
        unattendedTimeoutMinutes: result.document.adjustments.unattendedTimeoutMinutes ?? null,
        assignmentPolicy: result.document.adjustments.assignmentPolicy ?? null,
        publicLinkEnabled: result.document.adjustments.publicLinkEnabled ?? null,
        alerts: result.document.alerts.unassignedMinutes
          ? [
              {
                id: "unassigned",
                minutes: result.document.alerts.unassignedMinutes,
                recipientLabel: "Leads sem atribuição",
                active: result.document.alerts.enabled ?? true,
              },
            ]
          : [],
      };
      documentJson = JSON.stringify(result.document, null, 2);
      state = "ready";
    } catch {
      state = "error";
    }
  }
  const canManage = access.permissions.includes("crm.leads.settings.manage");
  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Configurações"
      description="Políticas, alertas e catálogos operacionais por organização."
      sourceState={state}
    >
      <LeadSourceNotice state={state} />
      <LeadScopeSelector
        scopes={scope.scopes}
        selectedScopeId={scope.selectedScopeId}
        invalid={scope.invalid}
      />
      <LeadSettingsWorkspace
        state={state}
        scopeId={scope.selectedScopeId}
        settings={settings}
        canManage={canManage}
        documentJson={documentJson}
        saveDocumentAction={canManage ? saveSettings : undefined}
      />
    </LeadPageShell>
  );
}
