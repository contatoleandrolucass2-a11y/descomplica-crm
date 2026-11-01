import type { Lead } from "./api";

export default function LeadCountdown({ lead, now }: { lead: Lead; now: number }) {
  const start = Date.parse(lead.bucket_started_at || "");
  const deadline = Date.parse(lead.bucket_deadline_at || "");
  if (!Number.isFinite(start) || !Number.isFinite(deadline) || deadline <= start) return null;
  const remaining = Math.max(0, Math.min(1, (deadline - now) / (deadline - start)));
  const elapsed = 1 - remaining;
  const state =
    remaining === 0
      ? "expired"
      : elapsed >= 0.75
        ? "critical"
        : elapsed >= 0.5
          ? "urgent"
          : elapsed >= 0.25
            ? "warning"
            : "safe";
  const label = lead.bucket_available_at
    ? "Disponível no Bolsão"
    : state === "expired"
      ? "Prazo de atendimento esgotado"
      : state === "critical"
        ? "Prazo de atendimento crítico"
        : state === "urgent"
          ? "Prazo de atendimento próximo do fim"
          : state === "warning"
            ? "Atenção ao prazo de atendimento"
            : "Prazo de atendimento iniciado";
  const angle = remaining * Math.PI * 2;
  const x = 20 + 16 * Math.sin(angle);
  const y = 20 - 16 * Math.cos(angle);
  const sector = `M20 20 L20 4 A16 16 0 ${remaining > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
  return (
    <span className="lead-countdown" data-state={state} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <circle className="lead-countdown-track" cx="20" cy="20" r="16" />
        {remaining >= 0.9999 ? (
          <circle className="lead-countdown-fill" cx="20" cy="20" r="16" />
        ) : remaining > 0 ? (
          <path className="lead-countdown-fill" d={sector} />
        ) : null}
        <circle className="lead-countdown-outline" cx="20" cy="20" r="16" />
      </svg>
    </span>
  );
}
