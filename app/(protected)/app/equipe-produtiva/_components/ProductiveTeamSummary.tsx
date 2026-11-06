import type {
  ProductiveTeamCard,
  ProductiveTeamSummaryRow,
} from "@/lib/crm/stages/productive-team";
import { appointmentTeamShortName } from "@/lib/crm/stages/appointments-daily-team";
import styles from "./ProductiveTeamDashboard.module.css";

const stages = ["appointments", "visits", "folders", "sales"] as const;
const headers = [
  "Gerente Regional",
  "Gerente de Vendas",
  "Qnt de corretores",
  "Equipe produtiva “Agendamentos”",
  "Equipe produtiva “Visitas”",
  "Equipe produtiva “Pastas”",
  "Equipe produtiva “Vendas”",
];
const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percent = (value: number | null) => (value === null ? "—" : `${decimal.format(value)}%`);

export function ProductiveTeamSummary({
  rows,
  cards,
}: {
  rows: ProductiveTeamSummaryRow[] | null;
  cards: ProductiveTeamCard[];
}) {
  const total = (stage: (typeof stages)[number]) =>
    cards.find((card) => card.stage === stage)?.percent ?? null;
  const value = (quantity: number | null) => (quantity === null ? "—" : number.format(quantity));
  return (
    <section
      className={styles.summaryViewport}
      role="region"
      aria-label="Rolagem do resumo da equipe"
      tabIndex={0}
    >
      <table className={styles.summaryTable}>
        <caption>Resumo da Equipe Produtiva</caption>
        <colgroup>
          <col />
          <col />
          <col className={styles.countColumn} />
          {stages.map((stage) => (
            <col key={stage} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === null ? (
            <tr>
              <td colSpan={7}>
                Resumo indisponível: aguardando cadastro e relatórios confirmados.
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7}>Nenhum corretor nos filtros selecionados.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key}>
                <td>
                  {row.regionalManagers.map((regional, index) => (
                    <span key={regional} title={regional}>
                      {index > 0 ? " / " : ""}
                      {appointmentTeamShortName(regional)}
                    </span>
                  ))}
                  {row.regionalUnknownBrokerCount > 0 && (
                    <span>
                      {row.regionalManagers.length > 0
                        ? ` · ${number.format(row.regionalUnknownBrokerCount)} sem vínculo`
                        : "Vínculo pendente"}
                    </span>
                  )}
                </td>
                <td title={row.manager}>{appointmentTeamShortName(row.manager)}</td>
                <td>{value(row.brokerCount)}</td>
                {stages.map((stage) => (
                  <td
                    key={stage}
                    title={
                      row[stage] === null
                        ? "Relatório indisponível para esta etapa"
                        : `${number.format(row[stage]!)} de ${number.format(row.brokerCount)} corretores`
                    }
                  >
                    {percent(
                      row[stage] === null
                        ? null
                        : row.brokerCount === 0
                          ? 0
                          : (row[stage]! / row.brokerCount) * 100,
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {rows !== null && (
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total
              </th>
              <td>{value(rows.reduce((sum, row) => sum + row.brokerCount, 0))}</td>
              {stages.map((stage) => (
                <td key={stage}>{percent(total(stage))}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}
