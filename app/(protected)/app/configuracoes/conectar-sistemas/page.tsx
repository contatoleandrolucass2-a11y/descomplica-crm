import { enforcePageAccess } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import { getSalesforceConsoleConfiguration } from "@/lib/crm/salesforce/console-config";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
  getSalesforceStatusConfiguration,
} from "@/lib/crm/salesforce/config";

import {
  getMetaAdsConsoleConfiguration,
  getMetaAdsStatusConfiguration,
} from "@/lib/crm/meta-ads/config";

import { ConnectedSystemsPanel } from "./ConnectedSystemsPanel";

export const metadata = { title: "Integrações" };

export default async function ConnectedSystemsPage() {
  const context = await enforcePageAccess("/app/configuracoes/conectar-sistemas");
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
      {...(hasPermission(context, "crm.dashboard.view") ? { canReadSyncStatus: true } : {})}
      metaAdsStatusConfigured={getMetaAdsStatusConfiguration().available}
      metaAdsConsoleAvailable={
        context.roleKey === "master" && getMetaAdsConsoleConfiguration().available
      }
      consoleAvailable={
        context.roleKey === "master" && getSalesforceConsoleConfiguration().available
      }
    />
  );
}
