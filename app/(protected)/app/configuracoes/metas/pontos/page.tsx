import { enforcePermission } from "@/lib/authorization/enforce";

import { PointSettingsPage } from "./_components/PointSettingsPage";

export const metadata = { title: "Metas de pontos" };

export default async function PointGoalsPage({
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
    <PointSettingsPage
      canManageDraft={canManageDraft}
      {...(canManageDraft && notification ? { notification } : {})}
    />
  );
}
