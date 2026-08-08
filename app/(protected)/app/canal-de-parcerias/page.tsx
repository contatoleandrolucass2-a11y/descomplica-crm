import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

export const metadata = { title: "Canal de Parcerias" };

export default async function PartnershipsChannelPage() {
  await enforcePermission("crm.ranking.view");

  return (
    <RoutePlaceholder
      eyebrow="Canal de Parcerias"
      title="Canal de Parcerias — página em desenvolvimento"
      description="A rota está protegida e disponível para os perfis autorizados. Os dados do ranking de imobiliárias serão conectados somente após revisão do contrato de leitura."
    />
  );
}
