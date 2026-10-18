import { enforcePageAccess } from "@/lib/authorization/enforce";

import { FunnelGoalsPage } from "../_components/FunnelGoalsPage";

export const metadata = { title: "Metas de parcerias" };

export default async function PartnershipGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const authorization = await enforcePageAccess("/app/configuracoes/metas/parcerias");
  // Match the database gate for commercial policy drafts, which remains Master-only.
  const canManageDraft =
    authorization.roleKey === "master" &&
    authorization.permissions.includes("crm.commercial_policy.manage");
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
      profile="partnerships"
      {...(canManageDraft && notification ? { notification } : {})}
    />
  );
}
