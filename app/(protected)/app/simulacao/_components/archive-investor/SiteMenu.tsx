"use client";

import { Calculator, ChartNoAxesColumnIncreasing, ChevronDown, LayoutDashboard, Menu, Settings2, UsersRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeSwitch } from "./ThemeSwitch";
import { useDismissiblePopover } from "./useDismissiblePopover";
import styles from "./ArchiveHeader.module.css";

const simulations = [
  { href: "/app/simulacao", label: "Visão geral" },
  { href: "/app/simulacao/associativo-fluxo-linear", label: "Tabela Associativo" },
  { href: "/app/simulacao/tabela-direta", label: "Tabela Direta" },
  { href: "/app/simulacao/tabela-investidor", label: "Tabela Investidor" },
  { href: "/app/simulacao/tabelao", label: "Tabelão" },
  { href: "/app/simulacao/caixa", label: "CAIXA" },
];
const settings = [
  { href: "/app/configuracoes", label: "Visão geral" },
  { href: "/app/configuracoes/metas", label: "Configurar metas" },
  { href: "/app/configuracoes/metas/pontos", label: "Metas por pontos" },
];

export function SiteMenu({ canPersistTheme = false }: { canPersistTheme?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  // Keep an accordion stable between pointerdown and click on a sibling trigger.
  const [rootRef, triggerRef, isOpen, setOpen, toggle] = useDismissiblePopover(menuRef);
  const [simulationRootRef, simulationTriggerRef, simulationOpen, setSimulationOpen, toggleSimulation] = useDismissiblePopover(menuRef);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOutside = (event: Event) => {
      if (!navigationRef.current?.contains(event.target as Node)) setMobileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      // Submenus handle the first Escape and restore their own trigger.
      if (event.key !== "Escape" || isOpen || simulationOpen) return;
      event.preventDefault();
      setMobileOpen(false);
      mobileTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("focusin", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("focusin", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen, isOpen, simulationOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1180px)");
    const resetMenu = () => {
      const active = document.activeElement;
      if (media.matches) {
        if (navigationRef.current?.querySelector("nav")?.contains(active)) mobileTriggerRef.current?.focus();
      } else if (active === mobileTriggerRef.current || simulationRootRef.current?.contains(active)) {
        simulationTriggerRef.current?.focus();
      } else if (rootRef.current?.contains(active)) {
        triggerRef.current?.focus();
      }
      setMobileOpen(false);
      setOpen(false);
      setSimulationOpen(false);
    };
    media.addEventListener("change", resetMenu);
    return () => media.removeEventListener("change", resetMenu);
  }, [setOpen, setSimulationOpen, rootRef, triggerRef, simulationRootRef, simulationTriggerRef]);

  function closeNavigation() {
    setMobileOpen(false);
    setOpen(false);
    setSimulationOpen(false);
  }

  return (
    <div ref={navigationRef} className={styles.navigation}>
      <button ref={mobileTriggerRef} className={styles.mobileTrigger} type="button"
        aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"} aria-expanded={mobileOpen} aria-controls="archive-navigation"
        onClick={() => { setMobileOpen(!mobileOpen); setOpen(false); setSimulationOpen(false); }}>
        {mobileOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>
      <nav ref={menuRef} id="archive-navigation" className={styles.menu} data-open={mobileOpen} aria-label="Navegação principal">
        <a className={styles.navItem} aria-current={pathname === "/app" ? "page" : undefined} href="/app" onClick={closeNavigation}>
          <LayoutDashboard aria-hidden="true" size={18} /> Dashboard
        </a>
        <div ref={simulationRootRef as React.RefObject<HTMLDivElement | null>} className={styles.dropdown}>
          <button ref={simulationTriggerRef as React.RefObject<HTMLButtonElement | null>} type="button"
            className={styles.navItem} data-active={pathname.startsWith("/app/simulacao")}
            aria-controls="site-menu-simulation" aria-expanded={simulationOpen} onClick={toggleSimulation}>
            <Calculator aria-hidden="true" size={18} /> Simulação <ChevronDown aria-hidden="true" size={14} className={styles.chevron} />
          </button>
          <div id="site-menu-simulation" className={styles.panel} hidden={!simulationOpen}>
            {simulations.map(({ href, label }) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={closeNavigation}>{label}</a>)}
            <span className={styles.unavailable} aria-disabled="true">Calcular documentação <small>Em breve</small></span>
          </div>
        </div>
        <a className={styles.navItem} aria-current={pathname.startsWith("/app/ranking") ? "page" : undefined} href="/app/ranking" onClick={closeNavigation}>
          <ChartNoAxesColumnIncreasing aria-hidden="true" size={18} /> Ranking
        </a>
        <a className={styles.navItem} aria-current={pathname.startsWith("/app/canal-de-parcerias") ? "page" : undefined} href="/app/canal-de-parcerias" onClick={closeNavigation}>
          <UsersRound aria-hidden="true" size={18} /> Canal de Parcerias
        </a>
        <div ref={rootRef as React.RefObject<HTMLDivElement | null>} className={styles.dropdown}>
          <button ref={triggerRef as React.RefObject<HTMLButtonElement | null>} type="button"
            className={styles.navItem} data-active={pathname.startsWith("/app/configuracoes")}
            aria-controls="site-menu-settings" aria-expanded={isOpen} onClick={toggle}>
            <Settings2 aria-hidden="true" size={18} /> Configurações <ChevronDown aria-hidden="true" size={14} className={styles.chevron} />
          </button>
          <div id="site-menu-settings" className={`${styles.panel} ${styles.settingsPanel}`} hidden={!isOpen}>
            {settings.map(({ href, label }) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={closeNavigation}>{label}</a>)}
            <div className={styles.future}>
              <span className={styles.unavailable} aria-disabled="true">Previsão final de semana <small>Em breve</small></span>
              <span className={styles.unavailable} aria-disabled="true">Discador <small>Em breve</small></span>
            </div>
          </div>
        </div>
      </nav>
      <ThemeSwitch canPersist={canPersistTheme} />
    </div>
  );
}
