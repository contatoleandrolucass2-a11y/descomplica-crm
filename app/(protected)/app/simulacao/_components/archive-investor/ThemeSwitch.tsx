"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./ArchiveHeader.module.css";

export type ThemeMode = "light" | "balanced" | "dark";

const themes = [
  { key: "light", label: "Claro", icon: Sun },
  { key: "balanced", label: "Médio", icon: Contrast },
  { key: "dark", label: "Escuro", icon: Moon },
] as const;

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function ThemeSwitch({ canPersist = false }: { canPersist?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const selectedTheme = useRef<ThemeMode | null>(null);

  useEffect(() => {
    const initializing = selectedTheme.current === null;
    let initial = selectedTheme.current ?? "light";
    try {
      if (initializing && canPersist) {
        const saved = window.localStorage.getItem("descomplica-theme");
        if (saved === "light" || saved === "balanced" || saved === "dark") initial = saved;
      }
      if (!canPersist) window.localStorage.removeItem("descomplica-theme");
      else if (!initializing) window.localStorage.setItem("descomplica-theme", initial);
    } catch {
      // O tema continua disponível apenas nesta página quando storage está bloqueado.
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
        window.localStorage.setItem("descomplica-theme", nextTheme);
      } catch {
        // Mantém a escolha apenas em memória quando storage está indisponível.
      }
    }
  }

  return (
    <div
      className={`theme-switch ${styles.themeSwitch}`}
      role="group"
      aria-label="Aparência da página"
    >
      {themes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={theme === key ? "active" : ""}
          aria-pressed={theme === key}
          title={`Tema ${label.toLocaleLowerCase("pt-BR")}`}
          onClick={() => selectTheme(key)}
        >
          <Icon aria-hidden="true" size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
