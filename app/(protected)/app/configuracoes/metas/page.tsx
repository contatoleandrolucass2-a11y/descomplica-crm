import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

export default async function GoalsPage() {
  await enforcePermission("crm.settings.manage");
  return (
    <RoutePlaceholder
      eyebrow="Configurações"
      title="Metas do funil"
      description="Definição de metas mensais, semanais e diárias para o funil DV."
    />
  );
}
