"use client";

import { useEffect, useRef, useState } from "react";

export type ThemeMode = "light" | "balanced" | "dark";

const themes: Array<{ key: ThemeMode; label: string }> = [
  { key: "light", label: "Claro" },
  { key: "balanced", label: "Médio" },
  { key: "dark", label: "Escuro" },
];

export function ThemeSwitch({ canPersist = true }: { canPersist?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const ready = useRef(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      if (canPersist) saved = window.localStorage.getItem("descomplica-theme");
      else window.localStorage.removeItem("descomplica-theme");
    } catch {
      // O tema continua disponível apenas nesta página quando storage está bloqueado.
    }
    const current = document.documentElement.dataset.theme;
    const initial =
      saved === "light" || saved === "balanced" || saved === "dark"
        ? saved
        : current === "balanced" || current === "dark"
          ? current
          : "light";

    const timer = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(timer);
  }, [canPersist]);

  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    if (canPersist) {
      try {
        window.localStorage.setItem("descomplica-theme", theme);
      } catch {
        // Mantém a escolha apenas em memória quando storage está indisponível.
      }
    }
  }, [canPersist, theme]);

  return (
    <div className="theme-switch" role="group" aria-label="Aparência da página">
      {themes.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={theme === key ? "active" : ""}
          aria-pressed={theme === key}
          onClick={() => setTheme(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
