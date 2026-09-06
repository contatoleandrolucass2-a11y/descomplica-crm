"use client";

/* eslint-disable @next/next/no-html-link-for-pages */
import { ThemeSwitch } from "./ThemeSwitch";
import { usePathname } from "next/navigation";
import { useDismissiblePopover } from "./useDismissiblePopover";

export function SiteMenu() {
  const pathname = usePathname();
  const protectedPathname = pathname.startsWith("/app/") ? pathname.slice(4) : pathname;
  const proposalFile =
    pathname === "/app/simulacao/associativo-fluxo-linear"
      ? "1"
      : pathname === "/app/simulacao/tabela-direta"
        ? "2"
        : pathname === "/app/simulacao/tabela-investidor"
          ? "3"
          : null;
  const activePathname = proposalFile ? "/simulacao/tabela-investidor" : protectedPathname;
  const isRouteActive = (route: string) =>
    route === "/"
      ? activePathname === route
      : activePathname === route || activePathname.startsWith(`${route}/`);
  const menuId = "site-menu-settings";
  const simulationMenuId = "site-menu-simulation";
  const simulationActive = isRouteActive("/simulacao");
  const settingsActive = isRouteActive("/configuracoes");
  const [rootRef, triggerRef, isOpen, setOpen, toggle] = useDismissiblePopover();
  const [
    simulationRootRef,
    simulationTriggerRef,
    simulationOpen,
    setSimulationOpen,
    toggleSimulation,
  ] = useDismissiblePopover();
  return (
    <nav className="site-menu" aria-label="Navegação principal">
      <a
        className={isRouteActive("/") ? "is-active" : undefined}
        aria-current={isRouteActive("/") ? "page" : undefined}
        href="/app"
      >
        Dashboard
      </a>
      <div
        ref={simulationRootRef as React.RefObject<HTMLDivElement | null>}
        className={`site-menu-dropdown${simulationOpen ? " open" : ""}${simulationActive ? " is-active" : ""}`}
      >
        <button
          ref={simulationTriggerRef as React.RefObject<HTMLButtonElement | null>}
          type="button"
          aria-haspopup="menu"
          aria-controls={simulationMenuId}
          aria-expanded={simulationOpen}
          onClick={toggleSimulation}
        >
          Simulação <span aria-hidden="true">⌄</span>
        </button>
        <div className="site-menu-panel site-menu-panel-left" id={simulationMenuId} role="menu">
          <a
            role="menuitem"
            aria-current={activePathname === "/simulacao" ? "page" : undefined}
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao"
          >
            Visão geral
          </a>
          <a
            role="menuitem"
            aria-current={
              activePathname === "/simulacao/associativo-fluxo-linear" ? "page" : undefined
            }
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/associativo-fluxo-linear"
          >
            Simulador Associativo
          </a>
          <a
            role="menuitem"
            aria-current={
              activePathname === "/simulacao/calcular-documentacao" ? "page" : undefined
            }
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/calcular-documentacao"
          >
            Calcular documentação
          </a>
          <a
            role="menuitem"
            aria-current={activePathname === "/simulacao/caixa" ? "page" : undefined}
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/caixa"
          >
            CAIXA
          </a>
          <a
            role="menuitem"
            aria-current={pathname === "/simulacao/tabela" ? "page" : undefined}
            onClick={() => setSimulationOpen(false)}
            href="/simulacao/tabela"
          >
            Tabelão
          </a>
          <a
            role="menuitem"
            aria-current={
              activePathname === "/simulacao/tabela-investidor" && proposalFile === "1"
                ? "page"
                : undefined
            }
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/associativo-fluxo-linear"
          >
            Tabela Associativo
          </a>
          <a
            role="menuitem"
            aria-current={
              activePathname === "/simulacao/tabela-investidor" && proposalFile === "2"
                ? "page"
                : undefined
            }
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/tabela-direta"
          >
            Tabela Direta
          </a>
          <a
            role="menuitem"
            aria-current={
              activePathname === "/simulacao/tabela-investidor" && proposalFile === "3"
                ? "page"
                : undefined
            }
            onClick={() => setSimulationOpen(false)}
            href="/app/simulacao/tabela-investidor"
          >
            Tabela Investidor
          </a>
        </div>
      </div>
      <a
        className={isRouteActive("/ranking") ? "is-active" : undefined}
        aria-current={isRouteActive("/ranking") ? "page" : undefined}
        href="/app/ranking"
      >
        Ranking
      </a>
      <a
        className={isRouteActive("/canal-de-parcerias") ? "is-active" : undefined}
        aria-current={isRouteActive("/canal-de-parcerias") ? "page" : undefined}
        href="/app/canal-de-parcerias"
      >
        Canal de Parcerias
      </a>
      <a
        href="/previsao-final-de-semana"
        aria-current={pathname === "/previsao-final-de-semana" ? "page" : undefined}
        className={isRouteActive("/previsao-final-de-semana") ? "is-active" : undefined}
      >
        Previsão final de semana
      </a>
      <a
        aria-current={isRouteActive("/discador") ? "page" : undefined}
        className={isRouteActive("/discador") ? "is-active" : undefined}
        href="/discador"
      >
        Discador
      </a>
      <div
        ref={rootRef as React.RefObject<HTMLDivElement | null>}
        className={`site-menu-dropdown${isOpen ? " open" : ""}${settingsActive ? " is-active" : ""}`}
      >
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement | null>}
          type="button"
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-expanded={isOpen}
          onClick={toggle}
        >
          Configurações <span aria-hidden="true">⌄</span>
        </button>
        <div className="site-menu-panel" id={menuId} role="menu">
          <a
            role="menuitem"
            aria-current={activePathname === "/configuracoes" ? "page" : undefined}
            onClick={() => setOpen(false)}
            href="/app/configuracoes"
          >
            Visão geral
          </a>
          <a
            role="menuitem"
            aria-current={activePathname === "/configuracoes/metas" ? "page" : undefined}
            onClick={() => setOpen(false)}
            href="/app/configuracoes/metas"
          >
            Configurar metas
          </a>
          <a
            role="menuitem"
            aria-current={activePathname === "/configuracoes/metas/pontos" ? "page" : undefined}
            onClick={() => setOpen(false)}
            href="/app/configuracoes/metas/pontos"
          >
            Metas por pontos
          </a>
        </div>
      </div>
      <ThemeSwitch />
    </nav>
  );
}
