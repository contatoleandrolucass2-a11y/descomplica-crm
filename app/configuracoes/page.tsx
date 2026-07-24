import { SiteMenu } from "../SiteMenu";
import "../globals.css";

export const dynamic = "force-dynamic";
export default function Configuracoes() {
  return <main className="settings-shell"><SiteMenu /><section className="settings-card"><p className="eyebrow">Configurações</p><h1>Controle do painel</h1><p>Gerencie metas projetadas usadas nos seis funis do Dashboard.</p><a className="primary-link" href="/configuracoes/metas">Configurar metas do funil →</a></section></main>;
}
