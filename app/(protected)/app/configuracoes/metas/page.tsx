import { enforcePermission } from "@/lib/authorization/enforce";

import { FunnelGoalsPage } from "./_components/FunnelGoalsPage";

export const metadata = { title: "Metas do funil" };

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const authorization = await enforcePermission("crm.settings.manage");
  const canManageDraft = authorization.permissions.includes("crm.commercial_policy.manage");
  const query = await searchParams;
  const notification =
    query.saved === "1"
      ? "saved"
      : query.error === "validation"
        ? "validation"
        : query.error === "save"
          ? "save"
          : undefined;

  return (
    <FunnelGoalsPage
      canManageDraft={canManageDraft}
      profile="dv"
      {...(canManageDraft && notification ? { notification } : {})}
    />
  );
}
