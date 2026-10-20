import { enforcePageAccess } from "@/lib/authorization/enforce";

import { FunnelGoalsPage } from "../_components/FunnelGoalsPage";

export const metadata = { title: "Metas de parcerias" };

export default async function PartnershipGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const authorization = await enforcePageAccess("/app/configuracoes/metas/parcerias");
  const canManageDraft = authorization.permissions.includes("crm.settings.manage");
  const query = await searchParams;
  const notification =
    query.saved === "active"
      ? "active-saved"
      : query.error === "validation"
        ? "validation"
        : query.error === "save"
          ? "save"
          : query.error === "stale"
            ? "stale"
            : undefined;

  return (
    <FunnelGoalsPage
      canManageDraft={canManageDraft}
      profile="partnerships"
      {...(canManageDraft && notification ? { notification } : {})}
    />
  );
}
