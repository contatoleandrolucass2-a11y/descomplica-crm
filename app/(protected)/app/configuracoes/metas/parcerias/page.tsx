import { enforcePermission } from "@/lib/authorization/enforce";

import { FunnelGoalsPage } from "../_components/FunnelGoalsPage";

export const metadata = { title: "Metas de parcerias" };

export default async function PartnershipGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await enforcePermission("crm.settings.manage");
  const query = await searchParams;
  const notification =
    query.saved === "1"
      ? "saved"
      : query.error === "validation"
        ? "validation"
        : query.error === "save"
          ? "save"
          : undefined;

  return <FunnelGoalsPage profile="partnerships" {...(notification ? { notification } : {})} />;
}
