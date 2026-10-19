import { enforcePageAccess } from "@/lib/authorization/enforce";

import { FunnelGoalsPage } from "./_components/FunnelGoalsPage";

export const metadata = { title: "Metas do funil" };

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const authorization = await enforcePageAccess("/app/configuracoes/metas");
  const canManageDraft = authorization.permissions.includes("crm.settings.manage");
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
