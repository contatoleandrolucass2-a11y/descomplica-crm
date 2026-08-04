"use client";

import { useEffect, useState } from "react";

import { isThemeMode, THEME_MODES, type ThemeMode } from "@/lib/interface/theme";

const STORAGE_KEY = "descomplica-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy modes. The switch still works
      // for the current page without persistence.
    }
    const initial = isThemeMode(saved) ? saved : "light";
    applyTheme(initial);
    const timer = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the in-memory selection when persistence is unavailable.
    }
  }

  return (
    <div
      role="group"
      aria-label="Aparência da página"
      className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200"
    >
      {THEME_MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          aria-pressed={theme === mode.key}
          title={`Tema ${mode.label.toLocaleLowerCase("pt-BR")}`}
          onClick={() => selectTheme(mode.key)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
            theme === mode.key
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-600 hover:text-slate-950"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
