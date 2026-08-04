export const THEME_MODES = [
  { key: "light", label: "Claro" },
  { key: "balanced", label: "Equilibrado" },
  { key: "dark", label: "Escuro" },
] as const;

export type ThemeMode = (typeof THEME_MODES)[number]["key"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.some((theme) => theme.key === value);
}
