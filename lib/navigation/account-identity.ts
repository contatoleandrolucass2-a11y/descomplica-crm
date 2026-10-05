/** Presentation only: the caller supplies the registered name, never an email alias. */
export function getAccountFirstName(displayName: unknown): string | null {
  if (typeof displayName !== "string") return null;
  const name = displayName.trim();
  if (!name || name.includes("@")) return null;
  return name.split(/\s+/u)[0] ?? null;
}
