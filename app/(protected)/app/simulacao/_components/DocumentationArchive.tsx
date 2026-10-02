import { ArchiveHeader } from "./archive-investor/ArchiveHeader";
import { DocumentationCalculator } from "./archive-investor/DocumentationCalculator";
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
    <div className="goal-page-shell documentation-page-shell">
      <ArchiveHeader />
      <DocumentationCalculator baseDate={baseDate} />
    </div>
  );
}
