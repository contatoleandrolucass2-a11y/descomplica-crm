"use strict";
const pdfSectionLabels = {
  canvas: "Gráficos do canvas (com filtros próprios)",
  summary: "Resumo de indicadores",
  table: "Tabela de campanhas",
  origin: "Origem dos leads",
  charts: "Gráficos comparativos",
  funnels: "Funis",
  evolution: "Evolução",
  map: "Mapa de leads",
  guide: "Explicações das métricas",
};
let pdfSections = {
  canvas: true,
  summary: true,
  table: true,
  origin: true,
  charts: true,
  funnels: true,
  evolution: true,
  map: true,
  guide: false,
};
try {
  pdfSections.guide =
    JSON.parse(preferenceStore.getItem("ads-live-compact-pdf-guide") || "false") === true;
} catch {}
function pdfSectionControls() {
  return `<div class="pdf-sections" hidden role="dialog" aria-label="Selecionar conteúdo do PDF"><div class="pdf-section-options"><strong>O que incluir no PDF?</strong>${Object.entries(
    pdfSectionLabels,
  )
    .map(
      ([key, label]) =>
        `<label><input type="checkbox" ${key === "guide" ? 'id="pdf-include-guide"' : ""} data-pdf-section="${key}" ${pdfSections[key] ? "checked" : ""}> ${label}</label>`,
    )
    .join("")}<small>O período e os filtros atuais serão mantidos.</small><div class="pdf-section-actions"><button type="button" data-pdf-cancel>Cancelar</button><button type="button" class="primary" data-pdf-confirm>Gerar PDF</button></div></div></div>`;
}
document.addEventListener("change", (e) => {
  const key = e.target.dataset.pdfSection;
  if (key) {
    pdfSections[key] = e.target.checked;
    const confirm = document.querySelector("[data-pdf-confirm]");
    if (confirm) confirm.disabled = !Object.values(pdfSections).some(Boolean);
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".pdf-sections"))
    document.querySelectorAll(".pdf-sections:not([hidden])").forEach((item) => (item.hidden = true));
});
let expandedChart = null;
function expandChartButton(id) {
  return ["bars", "trend", "scatter", "sets", "cost", "funnels", "funnel"].includes(id)
    ? `<button type="button" class="expand-chart" data-expand-chart="${id}" aria-label="${expandedChart === id ? "Recolher" : "Expandir"} gráfico">${expandedChart === id ? "⤢ Recolher" : "⤢"}</button>`
    : "";
}
function closeExpandedChart() {
  const id = expandedChart;
  expandedChart = null;
  document.body.classList.remove("chart-is-expanded");
  render();
  document.querySelector(`[data-expand-chart="${id}"]`)?.focus();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-expand-chart]");
  if (!b) return;
  if (expandedChart) {
    closeExpandedChart();
    return;
  }
  expandedChart = b.dataset.expandChart;
  document.body.classList.add("chart-is-expanded");
  render();
  document.querySelector(`[data-expand-chart="${expandedChart}"]`)?.focus();
});
document.addEventListener("keydown", (e) => {
  if (!expandedChart) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeExpandedChart();
    return;
  }
  if (e.key === "Tab") {
    const items = [
      ...document.querySelectorAll(
        '.chart-expanded button,.chart-expanded select,.chart-expanded input,.chart-expanded summary,.chart-expanded [tabindex="0"]',
      ),
    ].filter((el) => el.getClientRects().length && !el.disabled);
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
function mountExpandedFilters() {
  const panel = document.querySelector(".chart-expanded");
  if (!panel) return;
  const main = document.querySelector("#main"),
    filters = main.querySelector(":scope > .filters"),
    comparison = main.querySelector(":scope > .comparison-strip");
  const toolbar = document.createElement("div");
  toolbar.className = "expanded-chart-filters";
  panel.querySelector(".panel-head").after(toolbar);
  if (filters) {
    toolbar.appendChild(filters);
    if (state.page === "micro") {
      const selector = main.querySelector("#micro-campaign");
      if (selector) {
        const field = document.createElement("div");
        field.className = "field expanded-campaign-field";
        const label = document.createElement("label");
        label.textContent = "Campanha analisada";
        label.htmlFor = "micro-campaign";
        field.append(label, selector);
        filters.querySelector(".campaign-filter").replaceWith(field);
      }
    }
  }
  if (comparison) toolbar.appendChild(comparison);
}
