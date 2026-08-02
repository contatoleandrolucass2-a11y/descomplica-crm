import { SiteMenu } from "../SiteMenu";
import "../globals.css";

export const dynamic = "force-dynamic";
export default function Configuracoes() {
  return <main className="settings-shell"><SiteMenu /><section className="settings-card"><p className="eyebrow">Configurações</p><h1>Controle do painel</h1><p>Gerencie metas projetadas e a pontuação comercial.</p><div className="settings-link-grid"><a className="primary-link" href="/configuracoes/metas">Metas do funil →</a><a className="primary-link secondary" href="/configuracoes/metas/pontos">Metas por pontos →</a></div></section></main>;
}
