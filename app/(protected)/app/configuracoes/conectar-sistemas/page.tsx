import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
  getSalesforceStatusConfiguration,
} from "@/lib/crm/salesforce/config";

import { ConnectedSystemsPanel } from "./ConnectedSystemsPanel";

export const metadata = { title: "Integrações" };

export default async function ConnectedSystemsPage() {
  const context = await enforcePermission("crm.settings.manage");
  const ingest = getSalesforceIngestConfiguration();
  const refresh = getSalesforceRefreshConfiguration();
  const status = getSalesforceStatusConfiguration();

  return (
    <ConnectedSystemsPanel
      ingestLabel={
        ingest.available ? "Configurada" : ingest.enabled ? "Configuração incompleta" : "Desativada"
      }
      refreshAvailable={refresh.available}
      canRefresh={hasPermission(context, "crm.salesforce.refresh")}
      statusConfigured={status.available}
    />
  );
}
