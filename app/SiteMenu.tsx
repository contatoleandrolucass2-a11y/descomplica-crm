/* eslint-disable @next/next/no-html-link-for-pages */
import { ThemeSwitch } from "./ThemeSwitch";

export function SiteMenu() {
  return (
    <nav className="site-menu" aria-label="Navegação principal">
      <a href="/">Dashboard</a>
      <div className="site-menu-dropdown">
        <button type="button" aria-haspopup="true">Configurações <span aria-hidden="true">⌄</span></button>
        <div className="site-menu-panel">
          <a href="/configuracoes">Visão geral</a>
          <a href="/configuracoes/metas">Configurar metas</a>
        </div>
      </div>
      <ThemeSwitch />
    </nav>
  );
}
