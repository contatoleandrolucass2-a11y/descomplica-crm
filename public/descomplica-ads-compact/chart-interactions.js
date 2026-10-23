"use strict";
function chartHint(lines) {
  const label = lines.join("\n");
  const escaped = label
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `tabindex="0" data-chart-tip="${escaped}" aria-label="${escaped}"`;
}
function scatterHint(c, old) {
  return chartHint([
    (c.label || c.name) + " · " + (old ? "Anterior" : "Atual"),
    rangeLabel(old ? previousRange() : selectedRange()),
    "Investimento: " + money(c.spend),
    resultName() + ": " + num(c.leads),
    costName() + ": " + money(c.cpl),
  ]);
}
let activeChartTarget = null;
function hideChartTip() {
  document.querySelector("#chart-tooltip")?.remove();
  activeChartTarget = null;
}
function showChartTip(target, x, y) {
  let tip = document.querySelector("#chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "chart-tooltip";
    tip.setAttribute("role", "tooltip");
    (document.fullscreenElement || document.body).appendChild(tip);
  }
  tip.textContent = target.dataset.chartTip;
  activeChartTarget = target;
  const box = target.getBoundingClientRect();
  const left = x ?? box.left + box.width / 2,
    top = y ?? box.top;
  tip.style.left = Math.max(8, Math.min(left + 14, innerWidth - tip.offsetWidth - 8)) + "px";
  tip.style.top = Math.max(8, Math.min(top + 14, innerHeight - tip.offsetHeight - 8)) + "px";
}
document.addEventListener("pointermove", (e) => {
  const target = e.target.closest("[data-chart-tip]");
  if (target) showChartTip(target, e.clientX, e.clientY);
  else hideChartTip();
});
document.addEventListener("pointerleave", hideChartTip);
document.addEventListener("focusin", (e) => {
  const target = e.target.closest("[data-chart-tip]");
  if (target) showChartTip(target);
  else hideChartTip();
});
document.addEventListener("focusout", hideChartTip);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideChartTip();
});
window.addEventListener("scroll", hideChartTip, true);
window.addEventListener("resize", hideChartTip);
