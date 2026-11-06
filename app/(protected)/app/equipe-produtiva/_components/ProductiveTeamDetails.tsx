import type { ProductiveTeamMember } from "@/lib/crm/stages/productive-team";
import { appointmentTeamShortName } from "@/lib/crm/stages/appointments-daily-team";
import styles from "./ProductiveTeamDashboard.module.css";

export function ProductiveTeamDetails({
  productiveMembers,
  unproductiveMembers,
  unavailableDetail,
  appointmentLabels = false,
  shortNames = false,
  compact = false,
}: {
  productiveMembers: ProductiveTeamMember[] | null;
  unproductiveMembers: ProductiveTeamMember[] | null;
  unavailableDetail: string;
  appointmentLabels?: boolean;
  shortNames?: boolean;
  compact?: boolean;
}) {
  const name = (value: string | null) =>
    shortNames ? appointmentTeamShortName(value) : value || "Não informado";
  return (
    <div className={[styles.details, compact && styles.compactDetails].filter(Boolean).join(" ")}>
      {(productiveMembers === null || unproductiveMembers === null) && (
        <p role="status" className={styles.detailsUnavailable}>
          {unavailableDetail}
        </p>
      )}
      <div className={styles.detailTables}>
        {[
          {
            title: appointmentLabels ? "Equipe com agendamento" : "Equipe Produtiva",
            members: productiveMembers,
          },
          {
            title: appointmentLabels ? "Equipe sem agendamento" : "Equipe não Produtiva",
            members: unproductiveMembers,
          },
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
                    <td
                      title={
                        compact && shortNames
                          ? (member.regionalManager ?? "Não informado")
                          : undefined
                      }
                    >
                      {name(member.regionalManager)}
                    </td>
                    <td title={compact && shortNames ? member.manager : undefined}>
                      {name(member.manager)}
                    </td>
                    <td title={compact && shortNames ? member.owner : undefined}>
                      {name(member.owner)}
                    </td>
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
