import { type GoalProfileKey } from "@/lib/crm/goals/catalog";
import { loadFunnelGoals } from "@/lib/crm/goals/data";
import { getGoalsReferenceDate } from "@/lib/crm/goals/reference";
import { GoalPlanning } from "./GoalPlanning";

export async function FunnelGoalsPage({
  canManageDraft,
  profile,
  notification,
}: {
  canManageDraft: boolean;
  profile: GoalProfileKey;
  notification?: "saved" | "active-saved" | "validation" | "save" | "stale";
}) {
  const result = await loadFunnelGoals(profile);
  const values = result.status === "ready" ? result.goals : null;
  const referenceDate = getGoalsReferenceDate();
  const effectiveMonth =
    result.status === "ready" ? result.goals.effectiveMonth : result.effectiveMonth;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
  return (
    <main
      aria-label={profile === "partnerships" ? "Metas do funil de parcerias" : "Metas do funil"}
    >
      <p className="px-5 py-2 text-xs text-[var(--analytics-muted)]" role="status">
        {canManageDraft
          ? "Configuração atual: editável · Salve para aplicar as alterações"
          : "Configuração atual: somente leitura"}
      </p>
      <GoalPlanning
        profile={profile}
        initialValues={values}
        effectiveMonth={effectiveMonth}
        canManageDraft={canManageDraft}
        revision={0}
        today={today}
        notification={notification}
      />
    </main>
  );
}
