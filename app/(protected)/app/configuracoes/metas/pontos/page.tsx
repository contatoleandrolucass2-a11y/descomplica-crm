import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

export default async function PointGoalsPage() {
  await enforcePermission("crm.settings.manage");
  return (
    <RoutePlaceholder
      eyebrow="Configurações"
      title="Metas de pontos"
      description="Definição de pesos, objetivos e regras de pontuação do ranking."
    />
  );
}
