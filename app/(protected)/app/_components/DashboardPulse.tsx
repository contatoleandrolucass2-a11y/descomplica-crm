import { ArrowUpRight } from "lucide-react";

import { DASHBOARD_STAGES, type DashboardStageKey } from "@/lib/crm/dashboard/catalog";
import { calculateProgress, type FunnelReading } from "@/lib/crm/dashboard/presentation";

import analyticsStyles from "./analytics/analytics.module.css";
import styles from "./DashboardPulse.module.css";

export interface DashboardPulseProps {
  readings: FunnelReading[];
  goals: Record<DashboardStageKey, number | null>;
}

const accents: Record<DashboardStageKey, string | undefined> = {
  opportunities: analyticsStyles.chartAccentCyan,
  appointments: analyticsStyles.chartAccentBlue,
  visits: analyticsStyles.chartAccentViolet,
  folders: analyticsStyles.chartAccentTeal,
  sales: analyticsStyles.chartAccentEmerald,
};
const numbers = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentages = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const stageOrder = Object.keys(DASHBOARD_STAGES) as DashboardStageKey[];

function MissingValue({ reason }: { reason: string }) {
  return (
    <span className={styles.missing}>
      <span aria-hidden="true">N/D</span>
      <span className={styles.srOnly}>{reason}</span>
    </span>
  );
}

function assessment(value: number | null, goal: number | null) {
  if (goal === null) return "Meta indisponível";
  if (value === null) return "Realizado indisponível";
  if (value >= goal) return "Meta atingida";
  return `Faltam ${numbers.format(goal - value)} para a meta`;
}

export function DashboardPulse({ readings, goals }: DashboardPulseProps) {
  return (
    <ul className={styles.grid} role="list">
      {readings.map((reading) => {
        const isEntry = reading.key === "opportunities";
        const ratio = isEntry ? null : reading.conversion;
        const aboveRange = ratio !== null && ratio > 1;
        // Only the circular scale stops at 100%; the label retains the full ratio.
        const arc = ratio === null ? null : Math.min(100, Math.max(0, ratio * 100));
        const rawGoal = goals[reading.key];
        const goal = rawGoal !== null && rawGoal >= 0 ? rawGoal : null;
        const progress =
          reading.value !== null && goal !== null ? calculateProgress(reading.value, goal) : null;
        const previousKey = stageOrder[stageOrder.indexOf(reading.key) - 1];
        const previousLabel = previousKey
          ? (readings.find((item) => item.key === previousKey)?.label ??
            DASHBOARD_STAGES[previousKey].label)
          : null;
        const conversionLabel = isEntry
          ? "Entrada do funil"
          : previousLabel
            ? `${previousLabel} para ${reading.label.toLocaleLowerCase("pt-BR")}`
            : `Conversão de ${reading.label.toLocaleLowerCase("pt-BR")}`;
        const conversionValue = isEntry
          ? "Entrada"
          : ratio === null
            ? "N/D"
            : percentages.format(ratio);
        const accessibleConversion = isEntry
          ? "Entrada do funil; conversão não se aplica."
          : `${conversionLabel}: ${ratio === null ? "Sem base suficiente para calcular a relação." : percentages.format(ratio)}${aboveRange ? "; acima de 100%. A rosca representa até 100%." : ""}`;

        return (
          <li
            className={`${styles.card} ${accents[reading.key]}`}
            key={reading.key}
            data-stage={reading.key}
          >
            <h3 className={styles.title}>{reading.label}</h3>
            <figure
              className={styles.conversion}
              aria-label={accessibleConversion}
              data-state={isEntry ? "entry" : ratio === null ? "unavailable" : "value"}
              data-overflow={aboveRange}
            >
              <div className={styles.ring} aria-hidden="true">
                <svg viewBox="0 0 120 120" focusable="false">
                  <circle className={styles.track} cx="60" cy="60" r="48" />
                  {arc !== null && arc > 0 ? (
                    <circle
                      className={styles.arc}
                      cx="60"
                      cy="60"
                      r="48"
                      pathLength="100"
                      strokeDasharray={`${arc} ${100 - arc}`}
                      transform="rotate(-90 60 60)"
                    />
                  ) : null}
                  {aboveRange ? (
                    <circle className={styles.overflowRing} cx="60" cy="60" r="56" />
                  ) : null}
                </svg>
                <strong className={styles.ratio} data-long={conversionValue.length > 7}>
                  {conversionValue}
                </strong>
              </div>
              <figcaption className={styles.caption} aria-hidden="true">
                {aboveRange ? (
                  <span className={styles.overflowLabel}>
                    <ArrowUpRight size={14} aria-hidden="true" /> Acima de 100%
                  </span>
                ) : isEntry ? (
                  "Entrada do funil"
                ) : (
                  "Da etapa anterior"
                )}
              </figcaption>
            </figure>
            <dl className={styles.metrics}>
              <div>
                <dt>Quantidade</dt>
                <dd className={styles.quantity}>
                  {reading.value === null ? (
                    <MissingValue reason="Quantidade indisponível para este intervalo." />
                  ) : (
                    numbers.format(reading.value)
                  )}
                </dd>
              </div>
              <div>
                <dt>Meta</dt>
                <dd>
                  {goal === null ? (
                    <MissingValue reason="Meta indisponível para o período." />
                  ) : (
                    numbers.format(goal)
                  )}
                </dd>
              </div>
              <div>
                <dt>% realizado da meta</dt>
                <dd>
                  {progress === null ? (
                    <MissingValue reason="Sem base suficiente para calcular o realizado da meta." />
                  ) : (
                    percentages.format(progress)
                  )}
                </dd>
              </div>
            </dl>
            <p className={styles.assessment} data-met={progress !== null && progress >= 1}>
              {assessment(reading.value, goal)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
