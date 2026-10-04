export function resolveAssociativeConstructionProgress(
  reported: number | null | undefined,
  officialPercent: string,
): number | null {
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0 && reported <= 1) {
    return reported;
  }
  const value = officialPercent.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) return null;
  const percent = Number(value.replace(",", "."));
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent / 100 : null;
}
