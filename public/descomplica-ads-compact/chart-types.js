"use strict";
let chartPreferences = {};
try {
  chartPreferences =
    JSON.parse(preferenceStore.getItem("ads-live-compact-chart-types") || "{}") || {};
} catch {}
const graphTypes = {
  bars: [
    ["vertical", "Colunas em pé"],
    ["horizontal", "Barras deitadas"],
    ["pie", "Circular"],
    ["donut", "Rosca"],
  ],
  sets: [
    ["vertical", "Colunas em pé"],
    ["horizontal", "Barras deitadas"],
  ],
  trend: [
    ["line", "Linhas"],
    ["columns", "Colunas"],
    ["area", "Área"],
  ],
  cost: [
    ["line", "Linhas"],
    ["columns", "Colunas"],
    ["area", "Área"],
  ],
  scatter: [
    ["points", "Pontos"],
    ["bubbles", "Bolhas"],
  ],
};
function graphType(key) {
  if (
    key === "bars" &&
    ["pie", "donut"].includes(chartPreferences[key]) &&
    !["spend", "leads"].includes(state.metric)
  )
    return "vertical";
  return graphTypes[key]?.some(([id]) => id === chartPreferences[key])
    ? chartPreferences[key]
    : graphTypes[key]?.[0][0];
}
function graphMenu(key) {
  if (!graphTypes[key]) return "";
  const additive = ["spend", "leads"].includes(state.metric);
  return `<details class="graph-type-menu"><summary aria-label="Tipo de gráfico: ${key}" title="Tipo de gráfico">▥ <span>Tipo</span></summary><div class="graph-type-options"><strong>Tipo de gráfico</strong>${graphTypes[
    key
  ]
    .map(([id, label]) => {
      const disabled = ["pie", "donut"].includes(id) && !additive;
      return `<button type="button" data-graph-key="${key}" data-graph-type="${id}" ${disabled ? "disabled" : ""} aria-pressed="${graphType(key) === id}">${label}${graphType(key) === id ? " ✓" : ""}</button>`;
    })
    .join(
      "",
    )}${key === "bars" && !additive ? "<small>Circular e rosca: selecione Investimento ou Resultados.</small>" : ""}</div></details>`;
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-graph-type]");
  if (button) {
    chartPreferences[button.dataset.graphKey] = button.dataset.graphType;
    preferenceStore.setItem("ads-live-compact-chart-types", JSON.stringify(chartPreferences));
    render();
    return;
  }
  const menu = e.target.closest(".graph-type-menu");
  document.querySelectorAll(".graph-type-menu[open]").forEach((item) => {
    if (item !== menu) item.open = false;
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    document.querySelectorAll(".graph-type-menu[open]").forEach((item) => {
      item.open = false;
      item.querySelector("summary").focus();
    });
});
function barChart(list, metric = state.metric) {
  const key = state.page === "micro" ? "sets" : "bars",
    type = graphType(key);
  if (
    !list.length ||
    type === "vertical" ||
    (["pie", "donut"].includes(type) && !["spend", "leads"].includes(metric))
  )
    return defaultBarChart(list, metric);
  const format = (v) => (metric === "ctr" ? pct(v) : metric === "leads" ? num(v) : money(v));
  let svg =
    '<svg class="chart alternate-chart" viewBox="0 0 560 260" role="img" aria-label="' +
    (type === "horizontal" ? "Barras deitadas" : "Distribuição por campanha") +
    '">';
  if (type === "horizontal") {
    const prior = list.map(previousData),
      max =
        Math.max(
          1,
          ...list.map((c) => c[metric] || 0),
          ...(state.compare ? prior.map((c) => c[metric] || 0) : []),
          ...(metric === "cpl" ? list.map((c) => c.cap) : []),
        ) * 1.1;
    svg += `<text x="125" y="14">${metricLabels[metric]} · ${metric === "ctr" ? "%" : metric === "leads" ? resultName() : "R$"}</text>`;
    const step = state.compare ? 52 : 38;
    svg = svg.replace("560 260", "560 " + Math.max(260, 70 + step * list.length));
    list.forEach((c, i) => {
      const y = 28 + i * step;
      svg += `<text x="5" y="${y + 15}">${AdsData.escape((c.label || c.name).slice(0, 17))}${(c.label || c.name).length > 17 ? "…" : ""}</text>`;
      (state.compare ? [prior[i], c] : [c]).forEach((v, j) => {
        const old = state.compare && j === 0,
          yy = y + (old ? 0 : state.compare ? 17 : 5);
        svg += `<rect ${chartHint([(c.label || c.name) + " · " + (old ? "Anterior" : "Atual"), rangeLabel(old ? previousRange() : selectedRange()), metricLabels[metric] + ": " + format(v[metric])])} x="125" y="${yy}" width="${((v[metric] || 0) / max) * 310}" height="13" fill="${c.color}" opacity="${old ? 0.3 : 1}"/><text x="${130 + ((v[metric] || 0) / max) * 310}" y="${yy + 10}">${format(v[metric])}</text>`;
      });
      if (metric === "cpl" && c.cap != null) {
        const x = 125 + (c.cap / max) * 310;
        svg += `<line x1="${x}" x2="${x}" y1="${y - 2}" y2="${y + 34}" stroke="#c92049" stroke-dasharray="3 2"/><text x="${x}" y="${y - 4}" text-anchor="middle">Teto ${money(c.cap)}</text>`;
      }
    });
    svg += `<text x="125" y="${Math.max(245, 55 + step * list.length)}">${state.compare ? "Claro: anterior · Sólido: atual · " : ""}${metric === "cpl" ? "Tracejado: teto" : ""}</text>`;
  } else {
    svg = svg.replace("560 260", "560 " + Math.max(260, 225 + Math.ceil(list.length / 2) * 20));
    const groups = state.compare
      ? [
          { items: list, label: "Atual", old: false, x: 145 },
          { items: list.map(previousData), label: "Anterior", old: true, x: 405 },
        ]
      : [{ items: list, label: "Atual", old: false, x: 280 }];
    for (const group of groups) {
      const total = group.items.reduce((n, c) => n + (c[metric] || 0), 0),
        cy = 105,
        r = 65;
      let angle = -Math.PI / 2;
      svg += `<text x="${group.x}" y="20" text-anchor="middle">${group.label} · ${format(total)}</text>`;
      if (!total) svg += `<text x="${group.x}" y="110" text-anchor="middle">Sem resultados</text>`;
      group.items.forEach((c) => {
        const value = c[metric] || 0;
        if (value <= 0 || !total) return;
        const end = angle + (value / total) * Math.PI * 2,
          x1 = group.x + r * Math.cos(angle),
          y1 = cy + r * Math.sin(angle),
          x2 = group.x + r * Math.cos(end),
          y2 = cy + r * Math.sin(end);
        const hint = chartHint([
          (c.label || c.name) + " · " + group.label,
          rangeLabel(group.old ? previousRange() : selectedRange()),
          metricLabels[metric] + ": " + format(value),
          "Participação: " + pct((value / total) * 100),
        ]);
        svg +=
          value === total
            ? `<circle ${hint} cx="${group.x}" cy="${cy}" r="${r}" fill="${c.color}"/>`
            : `<path ${hint} d="M${group.x},${cy} L${x1},${y1} A${r},${r} 0 ${end - angle > Math.PI ? 1 : 0} 1 ${x2},${y2} Z" fill="${c.color}" stroke="white" stroke-width="1"/>`;
        angle = end;
      });
      if (type === "donut")
        svg += `<circle cx="${group.x}" cy="${cy}" r="34" fill="white" pointer-events="none"/>`;
    }
    list.forEach((c, i) => {
      const x = 25 + (i % 2) * 270,
        y = 202 + Math.floor(i / 2) * 20;
      svg += `<circle cx="${x}" cy="${y - 3}" r="4" fill="${c.color}"/><text x="${x + 10}" y="${y}">${AdsData.escape((c.label || c.name).slice(0, 27))} · ${format(c[metric])}</text>`;
    });
  }
  return svg + "</svg>";
}
function trend(list, cost = false) {
  const type = graphType(cost ? "cost" : "trend"),
    base = defaultTrend(list, cost);
  if (type === "line" || !list.length) return base;
  const holder = document.createElement("div");
  holder.innerHTML = base;
  const svg = holder.querySelector("svg");
  const paths = [...svg.querySelectorAll("path")];
  paths.forEach((path) => {
    const coords = [...path.getAttribute("d").matchAll(/[ML]([\d.e+-]+),([\d.e+-]+)/g)].map((m) => [
      +m[1],
      +m[2],
    ]);
    if (!coords.length) return;
    if (type === "area") {
      const area = path.cloneNode();
      area.setAttribute(
        "d",
        path.getAttribute("d") + `L${coords.at(-1)[0]},170 L${coords[0][0]},170 Z`,
      );
      area.setAttribute("fill", path.getAttribute("stroke"));
      area.setAttribute("fill-opacity", ".12");
      area.setAttribute("stroke", "none");
      path.before(area);
    } else {
      const index = paths.indexOf(path),
        width = Math.min(16, (480 / Math.max(1, state.days) / paths.length) * 0.8);
      coords.forEach(([x, y]) => {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x + (index - (paths.length - 1) / 2) * width - width / 2);
        rect.setAttribute("y", y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", 170 - y);
        rect.setAttribute("fill", path.getAttribute("stroke"));
        rect.setAttribute("opacity", path.getAttribute("opacity") || "1");
        path.before(rect);
      });
      path.remove();
    }
  });
  if (type === "columns") {
    const label = [...svg.querySelectorAll("text")].find((t) =>
      t.textContent.startsWith("Contínuo:"),
    );
    if (label) label.textContent = "Colunas sólidas: atual · Claras: anterior, alinhadas por dia";
  }
  return holder.innerHTML;
}
function scatter(list) {
  const base = defaultScatter(list);
  if (graphType("scatter") !== "bubbles" || !list.length) return base;
  const holder = document.createElement("div");
  holder.innerHTML = base;
  const values = list.flatMap((c) => (state.compare ? [previousData(c), c] : [c])),
    max = Math.max(1, ...values.map((c) => c.leads));
  holder.querySelectorAll("circle[data-chart-tip]").forEach((circle, i) => {
    circle.setAttribute("r", 4 + Math.sqrt(values[i].leads / max) * 10);
    circle.setAttribute("fill-opacity", ".65");
  });
  const svg = holder.querySelector("svg"),
    label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", "45");
  label.setAttribute("y", "242");
  label.textContent = "Tamanho da bolha: volume de resultados";
  svg.setAttribute("viewBox", "0 0 560 250");
  svg.appendChild(label);
  return holder.innerHTML;
}
