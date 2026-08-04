import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

export const metadata = { title: "Ranking" };

export default async function RankingPage() {
  await enforcePermission("crm.ranking.view");

  return (
    <RoutePlaceholder
      eyebrow="Desempenho comercial"
      title="Ranking"
      description="Classificação de corretores e gerentes por conversões, produtividade e pontos."
    />
  );
}
