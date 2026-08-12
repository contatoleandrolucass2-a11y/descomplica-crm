import styles from "./analytics.module.css";
import { UnavailableValue } from "./DataState";

export type ChartAccent = "cyan" | "lime" | "blue" | "violet" | "teal" | "emerald";

const ACCENT_CLASSES: Record<ChartAccent, string> = {
  cyan: styles.chartAccentCyan!,
  lime: styles.chartAccentLime!,
  blue: styles.chartAccentBlue!,
  violet: styles.chartAccentViolet!,
  teal: styles.chartAccentTeal!,
  emerald: styles.chartAccentEmerald!,
};

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

function percentage(ratio: number | null) {
  if (ratio === null || !Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, ratio * 100));
}

export function DonutChart({
  label,
  value,
  ratio,
  accent = "cyan",
}: {
  label: string;
  value: string;
  ratio: number | null;
  accent?: ChartAccent;
}) {
  const progress = percentage(ratio);
  const accessibleValue = ratio === null ? "indisponível" : percentFormatter.format(ratio);

  return (
    <figure
      className={`${styles.donut} ${ACCENT_CLASSES[accent]}`}
      aria-label={`${label}: ${accessibleValue}`}
    >
      <svg className={styles.donutSvg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={styles.chartTrack} cx="50" cy="50" r="39" />
        {ratio === null ? null : (
          <circle
            className={styles.chartValue}
            cx="50"
            cy="50"
            r="39"
            pathLength="100"
            strokeDasharray={`${progress} ${100 - progress}`}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      <figcaption className={styles.donutText}>{value}</figcaption>
    </figure>
  );
}

export function Gauge({
  label,
  value,
  ratio,
  accent = "lime",
}: {
  label: string;
  value: string;
  ratio: number | null;
  accent?: ChartAccent;
}) {
  const progress = percentage(ratio);
  const accessibleValue = ratio === null ? "indisponível" : percentFormatter.format(ratio);

  return (
    <figure
      className={`${styles.gauge} ${ACCENT_CLASSES[accent]}`}
      aria-label={`${label}: ${accessibleValue}`}
    >
      <svg className={styles.gaugeSvg} viewBox="0 0 220 125" aria-hidden="true" focusable="false">
        <path className={styles.chartTrack} d="M 25 105 A 85 85 0 0 1 195 105" pathLength="100" />
        {ratio === null ? null : (
          <path
            className={styles.chartValue}
            d="M 25 105 A 85 85 0 0 1 195 105"
            pathLength="100"
            strokeDasharray={`${progress} ${100 - progress}`}
          />
        )}
      </svg>
      <div className={styles.gaugeValue}>{value}</div>
      <figcaption className={styles.gaugeLabel}>{label}</figcaption>
    </figure>
  );
}

export interface FunnelStage {
  key: string;
  label: string;
  value: number | null;
  conversion: number | null;
}

export function FunnelChart({
  label,
  stages,
  accent = "cyan",
}: {
  label: string;
  stages: FunnelStage[];
  accent?: ChartAccent;
}) {
  return (
    <figure className={`${styles.funnel} ${ACCENT_CLASSES[accent]}`}>
      <figcaption className={styles.funnelCaption}>{label}</figcaption>
      <ol className={styles.funnelList} role="list">
        {stages.map((stage, index) => (
          <li className={styles.funnelStep} key={stage.key}>
            <span className={styles.funnelStageLabel}>
              {stage.label}
              <span className={styles.funnelStageMeta}>
                {index === 0
                  ? "Entrada do funil"
                  : stage.conversion === null
                    ? "Conversão indisponível"
                    : `${percentFormatter.format(stage.conversion)} em relação ao volume anterior`}
              </span>
            </span>
            <span className={styles.funnelStageValue}>
              {stage.value === null ? <UnavailableValue /> : numberFormatter.format(stage.value)}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
