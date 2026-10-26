import { CaixaClient } from "./CaixaClient";
import "./caixa.css";

export function CaixaArchive() {
  const baseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <main className="goal-page-shell caixa-page-shell" data-canvas-layout="caixa">
      <div className="caixa-main">
        <CaixaClient baseDate={baseDate} />
      </div>
    </main>
  );
}
