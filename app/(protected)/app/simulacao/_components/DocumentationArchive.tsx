import { DocumentationCalculator } from "./archive-investor/DocumentationCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import { SimulationToolNavigation } from "./SimulationToolNavigation";
import "./archive-investor/investor-archive.css";
import "./archive-investor/documentation-accessibility.css";

export function DocumentationArchive() {
  const baseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="goal-page-shell documentation-page-shell" data-canvas-layout="documentation">
      <SimulationCanvasHeader
        eyebrow="Simulação · WF16"
        title="Calcular documentação"
        description="Composição para registrar modalidade, condição de compra e valores da operação."
        statusLabel="Cálculo local · validar no fluxo oficial"
      />
      <SimulationToolNavigation current="documentation" />
      <DocumentationCalculator baseDate={baseDate} showHeroHeading={false} />
    </div>
  );
}
