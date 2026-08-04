import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

export default async function PartnershipGoalsPage() {
  await enforcePermission("crm.settings.manage");
  return (
    <RoutePlaceholder
      eyebrow="Configurações"
      title="Metas de parcerias"
      description="Definição das metas comerciais do canal de parceiros."
    />
  );
}
