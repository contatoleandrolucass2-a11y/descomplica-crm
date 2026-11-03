import type { ProductiveTeamMember } from "@/lib/crm/stages/productive-team";
import styles from "./ProductiveTeamDashboard.module.css";

export function ProductiveTeamDetails({
  productiveMembers,
  unproductiveMembers,
  unavailableDetail,
}: {
  productiveMembers: ProductiveTeamMember[] | null;
  unproductiveMembers: ProductiveTeamMember[] | null;
  unavailableDetail: string;
}) {
  return (
    <div className={styles.details}>
      {(productiveMembers === null || unproductiveMembers === null) && (
        <p role="status" className={styles.detailsUnavailable}>
          {unavailableDetail}
        </p>
      )}
      <div className={styles.detailTables}>
        {[
          { title: "Equipe Produtiva", members: productiveMembers },
          { title: "Equipe não Produtiva", members: unproductiveMembers },
        ].map(({ title, members }) => (
          <table key={title} className={styles.detailTable}>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Gerente Regional</th>
                <th scope="col">Gerente de Vendas</th>
                <th scope="col">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {members === null ? (
                <tr>
                  <td colSpan={3}>Detalhamento nominal indisponível.</td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={3}>Nenhum corretor nesta equipe.</td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.key}>
                    <td>{member.regionalManager ?? "Não informado"}</td>
                    <td>{member.manager || "Não informado"}</td>
                    <td>{member.owner || "Não informado"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
