import type { DashboardCardLayoutPolicy } from "../layout/limits";
import type { DashboardCard, DashboardCardLayout } from "../types";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function content(card: DashboardCard): string {
  return canonical({ ...card, layout: undefined });
}

function mergeDimension(
  base: number | undefined,
  local: number | undefined,
  remote: number | undefined,
): { value: number | undefined } | null {
  if (local === base) return { value: remote };
  if (remote === base || local === remote) return { value: local };
  return null;
}

/** Merge independent layout edits only; content/add/remove conflicts require explicit review. */
export function mergeDashboardLayout(
  base: readonly DashboardCard[],
  local: readonly DashboardCard[],
  remote: readonly DashboardCard[],
  policy?: DashboardCardLayoutPolicy,
): DashboardCard[] | null {
  if (policy && !policy.freeResize) return null;
  const baseById = new Map(base.map((card) => [card.id, card]));
  const localById = new Map(local.map((card) => [card.id, card]));
  const remoteById = new Map(remote.map((card) => [card.id, card]));
  if (
    baseById.size !== base.length ||
    localById.size !== local.length ||
    remoteById.size !== remote.length ||
    base.length !== local.length ||
    base.length !== remote.length ||
    base.some(({ id }) => !localById.has(id) || !remoteById.has(id))
  ) {
    return null;
  }

  const baseOrder = canonical(base.map(({ id }) => id));
  const localOrder = canonical(local.map(({ id }) => id));
  const remoteOrder = canonical(remote.map(({ id }) => id));
  const ordered =
    localOrder === baseOrder
      ? remote
      : remoteOrder === baseOrder || localOrder === remoteOrder
        ? local
        : null;
  if (!ordered) return null;

  const merged: DashboardCard[] = [];
  for (const [order, card] of ordered.entries()) {
    const original = baseById.get(card.id)!;
    const edited = localById.get(card.id)!;
    const saved = remoteById.get(card.id)!;
    if (content(original) !== content(edited) || content(original) !== content(saved)) return null;
    const layout: DashboardCardLayout = { ...saved.layout, order };
    for (const key of ["columnSpan", "height", "width"] as const) {
      const result = mergeDimension(original.layout[key], edited.layout[key], saved.layout[key]);
      if (!result) return null;
      if (key === "width") {
        if (result.value === undefined) delete layout.width;
        else layout.width = result.value;
      } else {
        // Required dimensions remain present in every DashboardCard input.
        layout[key] = result.value!;
      }
    }
    merged.push({ ...saved, layout });
  }
  return merged;
}
