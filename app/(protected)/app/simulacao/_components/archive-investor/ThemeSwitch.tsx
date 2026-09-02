"use client";

import { useEffect, useRef, useState } from "react";

export type ThemeMode = "light" | "balanced" | "dark";

const themes: Array<{ key: ThemeMode; label: string }> = [
  { key: "light", label: "Claro" },
  { key: "balanced", label: "Médio" },
  { key: "dark", label: "Escuro" },
];

export function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const ready = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("descomplica-theme");
    const current = document.documentElement.dataset.theme;
    const initial =
      saved === "light" || saved === "balanced" || saved === "dark"
        ? saved
        : current === "balanced" || current === "dark"
          ? current
          : "light";

    const timer = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("descomplica-theme", theme);
  }, [theme]);

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
