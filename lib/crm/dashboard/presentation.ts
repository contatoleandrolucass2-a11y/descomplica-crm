export function calculateConversion(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return current / previous;
}

export function calculateProgress(current: number, goal: number): number | null {
  if (goal <= 0) return null;
  return current / goal;
}

export function clampPercentage(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value * 100));
}
