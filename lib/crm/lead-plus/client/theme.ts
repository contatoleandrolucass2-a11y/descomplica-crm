import { useEffect, useState } from "react";
export const themes = [
  { id: "light", label: "Claro" },
  { id: "balanced", label: "Médio" },
  { id: "dark", label: "Escuro" },
] as const;
export type Theme = (typeof themes)[number]["id"];
function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "balanced" ? value : "light";
}
/** The CRM shell owns theme persistence. The embedded workspace only observes it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return { theme, setTheme };
}
