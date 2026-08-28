"use client";

import { useEffect, useState } from "react";

import { isThemeMode, THEME_MODES, type ThemeMode } from "@/lib/interface/theme";

import styles from "./ProtectedShell.module.css";

const STORAGE_KEY = "descomplica-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function ThemeSwitch({ canPersist }: { canPersist: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    let saved: string | null = null;
    if (canPersist) {
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // Storage can be unavailable in privacy modes. The switch still works
        // for the current page without persistence.
      }
    } else {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Revocation remains effective because storage is never read below.
      }
    }
    const initial = isThemeMode(saved) ? saved : "light";
    applyTheme(initial);
    const timer = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(timer);
  }, [canPersist]);

  function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    if (canPersist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // Keep the in-memory selection when persistence is unavailable.
      }
    }
  }

  return (
    <div role="group" aria-label="Aparência da página" className={styles.themeSwitch}>
      {THEME_MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          aria-pressed={theme === mode.key}
          title={`Tema ${mode.label.toLocaleLowerCase("pt-BR")}`}
          onClick={() => selectTheme(mode.key)}
          className={styles.themeOption}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
