"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isThemeMode, THEME_MODES, type ThemeMode } from "@/lib/interface/theme";

import styles from "./ProtectedShell.module.css";

const STORAGE_KEY = "descomplica-theme";
const THEME_PRESENTATION = {
  light: { label: THEME_MODES[0].label, icon: Sun },
  balanced: { label: "Médio", icon: Contrast },
  dark: { label: THEME_MODES[2].label, icon: Moon },
} satisfies Record<ThemeMode, { label: string; icon: typeof Sun }>;

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function ThemeSwitch({ canPersist }: { canPersist: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const selectedTheme = useRef<ThemeMode | null>(null);

  useEffect(() => {
    const initializing = selectedTheme.current === null;
    let initial = selectedTheme.current ?? "light";

    try {
      if (initializing && canPersist) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (isThemeMode(saved)) initial = saved;
      }
      if (!canPersist) window.localStorage.removeItem(STORAGE_KEY);
      else if (!initializing) window.localStorage.setItem(STORAGE_KEY, initial);
    } catch {
      // The selected theme still applies to this page when storage is unavailable.
    }

    selectedTheme.current = initial;
    applyTheme(initial);
    const timer = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(timer);
  }, [canPersist]);

  function selectTheme(nextTheme: ThemeMode) {
    selectedTheme.current = nextTheme;
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

  const currentIndex = THEME_MODES.findIndex(({ key }) => key === theme);
  const nextTheme = THEME_MODES[(currentIndex + 1) % THEME_MODES.length] ?? THEME_MODES[0];
  const CurrentThemeIcon = THEME_PRESENTATION[theme].icon;

  return (
    <div role="group" aria-label="Aparência da página" className={styles.themeSwitch}>
      <div className={styles.themeOptions} data-theme-options-desktop>
        {THEME_MODES.map((mode) => {
          const presentation = THEME_PRESENTATION[mode.key];
          const Icon = presentation.icon;

          return (
            <button
              key={mode.key}
              type="button"
              aria-pressed={theme === mode.key}
              title={`Tema ${presentation.label.toLocaleLowerCase("pt-BR")}`}
              onClick={() => selectTheme(mode.key)}
              className={styles.themeOption}
            >
              <Icon aria-hidden="true" size={16} />
              {presentation.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.mobileThemeCycle}
        aria-label={`Tema atual: ${THEME_PRESENTATION[theme].label}. Alternar para ${THEME_PRESENTATION[nextTheme.key].label}.`}
        title={`Tema ${THEME_PRESENTATION[theme].label.toLocaleLowerCase("pt-BR")}`}
        onClick={() => selectTheme(nextTheme.key)}
        data-theme-cycle-mobile
      >
        <CurrentThemeIcon aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
