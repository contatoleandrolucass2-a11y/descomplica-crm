"use client";

import { BookOpen, Cloud, FileText, Printer, ShoppingBag } from "lucide-react";

export function TabelaoResources() {
  return (
    <nav className="tabelao-resources" aria-label="Recursos do Tabelão">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls="investor-guided-tour"
        onClick={(event) =>
          window.dispatchEvent(
            new CustomEvent("investor:start-guide", { detail: { trigger: event.currentTarget } }),
          )
        }
      >
        <BookOpen size={22} aria-hidden="true" />
        <span>Aprenda +</span>
      </button>
      <button type="button" disabled title="Documento da política comercial não informado">
        <FileText size={22} aria-hidden="true" />
        <span>Política comercial</span>
      </button>
      <button type="button" onClick={() => window.print()}>
        <Printer size={22} aria-hidden="true" />
        <span>Imprimir</span>
      </button>
      <a href="https://boravender.app.br/login" target="_blank" rel="noopener noreferrer">
        <ShoppingBag size={22} aria-hidden="true" />
        <span>Bora Vender</span>
      </a>
      <a href="https://direcional.my.site.com/vendas/s/" target="_blank" rel="noopener noreferrer">
        <Cloud size={24} aria-hidden="true" />
        <span>Salesforce</span>
      </a>
    </nav>
  );
}
