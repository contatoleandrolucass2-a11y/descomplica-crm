"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const money = (n) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const pct = (n) => (n == null ? "—" : num(n) + "%");
const read = (key, fallback) => {
  try {
    return JSON.parse(preferenceStore.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    preferenceStore.setItem(key, JSON.stringify(value));
  } catch {
    toast("O navegador não permitiu salvar esta preferência.");
  }
};
const defaultKpiOrder = ["spend", "leads", "cpl", "ctr", "cpc", "cpm"];
let kpiOrder = read("ads-live-compact-kpis", defaultKpiOrder);
if (
  !Array.isArray(kpiOrder) ||
  kpiOrder.length !== 6 ||
  new Set(kpiOrder).size !== 6 ||
  kpiOrder.some((id) => !defaultKpiOrder.includes(id))
)
  kpiOrder = [...defaultKpiOrder];
const defaultOrder = ["funnels", "bars", "trend", "scatter", "table"];
let geography = null;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function modal(html) {
  $("#dialog-body").innerHTML = html;
  window.parent.postMessage(
    { type: "descomplica:meta-ads-modal-open" },
    new URL(document.baseURI).origin,
  );
  $("#dialog").showModal();
}
const info = (text) =>
  `<button class="info" title="${text}" aria-label="${text}" data-info="${text}">ⓘ</button>`;
const dot = (c) => `<span class="dot" style="--c:${c.color}"></span>`;
const resultName = () =>
  destinationFilterKey() === "whatsapp"
    ? "Conversas iniciadas"
    : ["unknown", "mixed"].includes(destinationFilterKey())
      ? "Resultados"
      : "Cadastros";
const costName = () =>
  destinationFilterKey() === "whatsapp"
    ? "Custo por conversa"
    : ["unknown", "mixed"].includes(destinationFilterKey())
      ? "Custo por resultado"
      : "Custo por cadastro";
const isoDate = (d) => d.toISOString().slice(0, 10);
const parseDate = (s) => new Date(s + "T00:00:00Z");
function selectedRange() {
  return {
    start: state.startDate || sourceData.range.start,
    end: state.endDate || sourceData.range.end,
  };
}
function previousRange() {
  const { start } = selectedRange(),
    end = parseDate(start);
  end.setUTCDate(end.getUTCDate() - 1);
  const begin = new Date(end);
  begin.setUTCDate(begin.getUTCDate() - state.days + 1);
  return { start: isoDate(begin), end: isoDate(end) };
}
const formatDate = (s) => parseDate(s).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const rangeLabel = (r) => formatDate(r.start) + " – " + formatDate(r.end);
const period = () => rangeLabel(selectedRange());
const comparisonLabel = () =>
  `Anterior: ${rangeLabel(previousRange())} · ${state.days} dia${state.days === 1 ? "" : "s"}`;
function changeLabel(now, before) {
  if (now == null || before == null) return "—";
  if (!before) return now ? "Sem base" : "0%";
  const value = (now / before - 1) * 100;
  return (value > 0 ? "+" : "") + pct(value);
}
function comparisonCell(c, key, format) {
  if (!state.compare) return format(c[key]);
  const before = previousData(c)[key];
  return `${format(c[key])}<small class="period-comparison">Ant. ${format(before)} · ${changeLabel(c[key], before)}</small>`;
}
function dateControls() {
  return `<div class="comparison-strip"><label class="compare-toggle"><input type="checkbox" id="compare-period" ${state.compare ? "checked" : ""}> Comparar com período anterior</label>${state.compare ? `<span>${comparisonLabel()}</span>` : ""}${state.periodMode === "custom" ? `<form id="custom-period-form"><label>De <input type="date" id="date-start" aria-label="Data inicial" value="${selectedRange().start}" required></label><label>Até <input type="date" id="date-end" aria-label="Data final" value="${selectedRange().end}" required></label><button type="submit">Aplicar período</button><span id="date-error" role="alert"></span></form>` : ""}<small>Meta API · somente leitura</small></div>`;
}
function alertKey(c) {
  return [c.id, destinationFilterKey(), selectedRange().start, selectedRange().end, status(c)[1]].join(
    "|",
  );
}
function syncAlertHistory() {
  if (!settings.notification) return;
  const history = readAlertHistory(),
    observed = read("ads-live-compact-alert-observed", {});
  for (const c of current()) {
    const [label, tone] = status(c),
      id = c.id + "|" + destinationFilterKey(),
      signature = label + "|" + c.cap + "|" + budgetFor(c)?.limit;
    const changed = observed[id] !== signature;
    observed[id] = signature;
    if (!["warn", "red"].includes(tone) || (settings.onlyChanges && !changed)) continue;
    const key = alertKey(c) + (settings.onlyChanges ? "|" + Date.now() : "");
    if (!history[key])
      history[key] = {
        key,
        campaignId: c.id,
        name: c.label || c.name,
        color: c.color,
        destination: destinationFilterKey(),
        destinations: [...selectedDestinations()],
        ...selectedRange(),
        tone,
        label,
        receivedAt: new Date().toISOString(),
        readAt: null,
        cost: c.cpl,
        cap: c.cap,
        budget: budgetFor(c),
      };
  }
  save("ads-live-compact-alert-observed", observed);
  save("ads-live-compact-alert-history", history);
  updateAlertCounter(history);
}
const alertEscape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function showAlertHistory() {
  const history = Object.values(readAlertHistory()).sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  );
  const unread = history.filter((a) => !a.readAt).length;
  modal(
    `<h2>Histórico de alertas</h2><p class="muted">${unread} não lidos · ${history.length} no histórico</p><small class="muted">Recebimento observado neste navegador · histórico independente dos filtros atuais.</small><div class="alert-history-actions"><button type="button" id="read-all-alerts" ${unread ? "" : "disabled"}>Marcar todas como lidas</button></div>${history.length ? history.map((a) => `<article class="alert-item ${a.readAt ? "alert-is-read" : "alert-is-unread"}"><div class="alert-title"><b>${dot(a)}${alertEscape(a.name)} · ${alertEscape(a.label)}</b><span class="badge">${a.readAt ? "Lida" : "Não lida"}</span></div><time class="alert-received" datetime="${alertEscape(a.receivedAt)}">Recebido em ${new Date(a.receivedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} · São Paulo</time><small class="alert-context">${formatDate(a.start)} – ${formatDate(a.end)} · ${alertEscape(a.destination)}</small><p>${a.cost == null ? "Valores históricos indisponíveis." : `${a.destination === "whatsapp" ? "Custo por conversa" : "Custo por cadastro"}: ${money(a.cost)} · teto: ${money(a.cap)}`}</p>${a.budget ? `<p>Investimento: ${money(a.budget.spend)} · limite: ${money(a.budget.limit)}</p>` : ""}<div class="alert-buttons">${a.readAt ? "" : `<button type="button" data-read-alert="${alertEscape(a.key)}">Marcar como lida</button>`}<button type="button" data-alert-open="${alertEscape(a.campaignId)}" data-alert-record="${alertEscape(a.key)}">Investigar campanha</button></div></article>`).join("") : "<p>Nenhum alerta registrado.</p>"}`,
  );
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-read-alert]"),
    all = e.target.closest("#read-all-alerts");
  if (!button && !all) return;
  const history = readAlertHistory(),
    now = new Date().toISOString();
  if (all)
    Object.values(history).forEach((a) => {
      if (!a.readAt) a.readAt = now;
    });
  else if (history[button.dataset.readAlert]) history[button.dataset.readAlert].readAt = now;
  save("ads-live-compact-alert-history", history);
  updateAlertCounter(history);
  showAlertHistory();
  document
    .querySelector("#read-all-alerts:not(:disabled),[data-read-alert],#close-dialog")
    ?.focus();
});
function kpis(list) {
  const aggregate = (old) =>
    AdsData.aggregate(list.flatMap((c) => AdsData.selectEntity(filteredRows(old), c)));
  const now = aggregate(false),
    before = aggregate(true),
    labels = ["Investimento", resultName(), costName(), "CTR", "CPC", "CPM"];
  return (
    '<div class="kpis ' +
    (state.organize ? "organizing" : "") +
    '" data-kpi-zone>' +
    kpiOrder
      .map((id) => {
        const i = defaultKpiOrder.indexOf(id),
          format = id === "ctr" ? pct : id === "leads" ? num : money;
        const bad =
          id === "cpl" && list.length === 1 && list[0].cap != null && now.cpl > list[0].cap;
        return (
          '<div class="kpi draggable" data-kpi="' +
          id +
          '"><div class="kpi-label">' +
          grip("kpi", id) +
          "<span>" +
          labels[i] +
          "</span>" +
          metricInfo(id) +
          '</div><strong class="' +
          (bad ? "bad" : "") +
          '">' +
          format(now[id]) +
          "</strong><small>" +
          (state.compare ? changeLabel(now[id], before[id]) + " vs. anterior" : period()) +
          "</small></div>"
        );
      })
      .join("") +
    "</div>"
  );
}
const grip = (kind, id) =>
  `<button class="grip" draggable="true" data-drag-kind="${kind}" data-drag-id="${id}" aria-label="Arrastar ${id}" title="Arraste para reorganizar. Alt + seta move pelo teclado.">⠿</button>`;
function panel(id, title, body, controls = "", full = false) {
  return `<section class="panel draggable ${expandedChart === id ? "chart-expanded" : ""} ${full ? "full" : ""}" data-panel="${id}" ${expandedChart === id ? 'role="dialog" aria-modal="true" aria-label="Gráfico expandido"' : ""}><div class="panel-head"><div class="panel-title">${grip("panel", id)}<h2>${title}</h2></div><div class="graph-controls">${controls}${graphMenu(id)}${expandChartButton(id)}</div></div><div class="panel-body">${expandedChart === id ? `<p class="expanded-period">${period()} · ${destinationLabel()}${state.compare ? " · " + comparisonLabel() : ""}</p>` : ""}${body}</div></section>`;
}
function funnel(c) {
  const prev = previousData(c),
    destination = destinationFilterKey();
  const priorStages =
    destination === "whatsapp"
      ? [prev.clicks, prev.leads, null]
      : ["form", "site"].includes(destination)
        ? [prev.clicks, prev.opens, prev.leads, prev.qualified]
        : [prev.clicks, prev.leads, prev.qualified];
  const stages =
    destination === "whatsapp"
      ? [
          ["Cliques", c.clicks],
          ["Conversas", c.leads],
          ["Qualificados", null],
        ]
      : ["form", "site"].includes(destination)
        ? [
            ["Cliques", c.clicks],
            [destination === "site" ? "Visitas" : "Aberturas", c.opens],
            ["Cadastros", c.leads],
            ["Qualificados", c.qualified],
          ]
        : [
            ["Cliques", c.clicks],
            ["Resultados", c.leads],
            ["Qualificados", c.qualified],
          ];
  return `<article class="funnel draggable" data-funnel="${c.id}" style="--c:${c.color}"><div class="funnel-head">${grip("funnel", c.id)}${dot(c)}<select data-swap="${c.id}" aria-label="Campanha do funil ${c.name}">${campaigns.map((a) => `<option value="${a.id}" ${a.id === c.id ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>${stages.map(([n, v], i) => `<div class="funnel-row"><span>${n}</span><div><div class="funnel-bar" style="min-width:0;width:${v == null ? 0 : Math.min(100, Math.max(4, c.clicks ? (v / c.clicks) * 100 : 0))}%"></div></div><b>${num(v)}${state.compare ? `<small class="funnel-previous">ant. ${num(priorStages[i])}</small>` : ""}</b></div>`).join("")}<div class="funnel-foot">Clique → ${destination === "whatsapp" ? "conversa" : "resultado"} <b>${pct(AdsData.ratio(c.leads, c.clicks, 100))}</b></div></article>`;
}
function funnels(list) {
  if (!list.length) return '<div class="empty">Selecione pelo menos uma campanha.</div>';
  const ordered = state.funnelOrder
    .filter((id) => list.some((c) => c.id === id))
    .map((id) => list.find((c) => c.id === id));
  if (state.matrix)
    return `<div class="table-wrap"><table><thead><tr><th>Etapa</th>${ordered.map((c) => `<th>${dot(c)}${c.name}</th>`).join("")}</tr></thead><tbody>${[
      ["Cliques", "clicks"],
      [resultName(), "leads"],
      ["Qualificados", "qualified"],
    ]
      .map(
        ([n, k]) => `<tr><td>${n}</td>${ordered.map((c) => `<td>${num(c[k])}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
  return `<div class="funnels" style="grid-template-columns:repeat(${Math.min(ordered.length, 4)},minmax(0,1fr))">${ordered.map(funnel).join("")}</div>`;
}
const metricLabels = {
  spend: "Investimento",
  leads: "Resultados",
  cpl: "Custo por resultado",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
};
function chartLabelLines(value, limit = 14) {
  const full = String(value || "—").trim();
  const compact = full.replace(/^campanha\s+/i, "");
  const words = compact.split(/\s+/).filter(Boolean);
  const lines = [""];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length <= limit) lines[lines.length - 1] = current ? `${current} ${word}` : word;
    else if (lines.length < 2) lines.push(word);
    else {
      lines[1] += "…";
      break;
    }
  }
  return lines.map((line) => (line.length > limit ? `${line.slice(0, limit - 1)}…` : line));
}
function defaultBarChart(list, metric = state.metric) {
  if (!list.length) return '<div class="empty">Sem campanhas selecionadas.</div>';
  const before = list.map(previousData),
    max =
      Math.max(
        1,
        ...list.map((c) => c[metric] || 0),
        ...(state.compare ? before.map((c) => c[metric] || 0) : []),
        ...(metric === "cpl" ? list.map((c) => c.cap) : []),
      ) * 1.3,
    chartWidth = Math.max(560, 80 + list.length * 82),
    chartRight = chartWidth - 10,
    step = (chartRight - 45) / list.length;
  const format = (v) => (metric === "ctr" ? pct(v) : metric === "leads" ? num(v) : money(v));
  let svg =
    `<div class="chart-scroll"><svg class="chart" style="min-width:${chartWidth}px" viewBox="0 0 ${chartWidth} 250" role="img" aria-label="Comparação por campanha"><text x="4" y="12">` +
    (metric === "ctr" ? "%" : metric === "leads" ? resultName() : "R$") +
    "</text>";
  for (let i = 0; i < 5; i++) {
    const y = 170 - i * 35;
    svg += `<line class="grid" x1="45" x2="${chartRight}" y1="${y}" y2="${y}"/><text x="40" y="${y + 4}" text-anchor="end">${num((max * i) / 4)}</text>`;
  }
  list.forEach((c, i) => {
    const x = 45 + i * step + step / 2;
    (state.compare ? [before[i], c] : [c]).forEach((v, j) => {
      const y = 170 - ((v[metric] || 0) / max) * 140,
        bx = state.compare ? x + (j ? 2 : -step * 0.3) : x - step * 0.27;
      svg += `<rect ${chartHint([(c.label || c.name) + " · " + (!state.compare || j ? "Atual" : "Anterior"), rangeLabel(!state.compare || j ? selectedRange() : previousRange()), metricLabels[metric] + ": " + format(v[metric]), ...(metric === "cpl" ? ["Teto: " + money(c.cap)] : [])])} x="${bx}" y="${y}" width="${step * (state.compare ? 0.27 : 0.54)}" height="${170 - y}" fill="${c.color}" opacity="${!state.compare || j ? 1 : 0.3}"></rect>`;
    });
    if (metric === "cpl" && c.cap != null) {
      const cy = 170 - (c.cap / max) * 140;
      svg += `<line x1="${x - step * 0.35}" x2="${x + step * 0.35}" y1="${cy}" y2="${cy}" stroke="#c92049" stroke-dasharray="4 3"/><text x="${x}" y="${cy - 5}" text-anchor="middle">Teto ${money(c.cap)}</text>`;
    }
    const label = c.label || c.name,
      lines = chartLabelLines(label);
    svg += `<text ${chartHint([label])} x="${x}" y="187" text-anchor="middle">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? 13 : 0}">${AdsData.escape(line)}</tspan>`).join("")}</text><text style="fill:${metric === "cpl" && c.cap != null && c.cpl > c.cap ? "#e51c3c" : "var(--text)"}" x="${x}" y="218" text-anchor="middle">${format(c[metric])}${state.compare ? " · " + changeLabel(c[metric], before[i][metric]) : ""}</text>`;
  });
  return (
    svg +
    `<text x="45" y="242">${state.compare ? "Claro: anterior · Cor sólida: atual · " : ""}Tracejado vermelho: teto</text></svg></div>`
  );
}
function defaultTrend(list, cost = false) {
  if (!list.length) return '<div class="empty">Selecione campanhas para comparar.</div>';
  const days = state.days,
    series = list.slice(0, 4).flatMap((c) =>
      (state.compare ? [true, false] : [false]).map((old) => {
        const values = AdsData.daily(
          filteredRows(old),
          c,
          old ? previousRange() : selectedRange(),
          cost,
        );
        return { c, old, values };
      }),
    );
  const max =
    Math.max(
      1,
      ...series.flatMap((s) => s.values.map((v) => v || 0)),
      ...(cost ? list.map((c) => c.cap) : []),
    ) * 1.15;
  let svg = `<svg class="chart" viewBox="0 0 560 230" role="img" aria-label="Evolução por campanha"><text x="4" y="12">${cost ? "R$ / resultado" : resultName() + "/dia"}</text>`;
  for (let i = 0; i < 5; i++) {
    const y = 170 - i * 35;
    svg += `<line class="grid" x1="45" x2="540" y1="${y}" y2="${y}"/><text x="40" y="${y + 3}" text-anchor="end">${num((max * i) / 4)}</text>`;
  }
  series.forEach(({ c, old, values }) => {
    const points = values.map((v, i) =>
      v == null ? null : [days === 1 ? 290 : 45 + (i * 495) / (days - 1), 170 - (v / max) * 140],
    );
    let path = "";
    points.forEach((p, i) => {
      if (p) path += (i && points[i - 1] ? "L" : "M") + p.join(",");
    });
    svg += `<path d="${path}" fill="none" stroke="${c.color}" stroke-width="${old ? 1.7 : 2.5}" ${old ? 'stroke-dasharray="5 4" opacity=".55"' : ""}/>`;
    if (days === 1 && points[0])
      svg += `<circle cx="${points[0][0]}" cy="${points[0][1]}" r="${old ? 5 : 3}" fill="${old ? "white" : c.color}" stroke="${c.color}"/>`;
    if (cost && !old && c.cap != null) {
      const y = 170 - (c.cap / max) * 140;
      svg += `<line x1="45" x2="540" y1="${y}" y2="${y}" stroke="#c92049" stroke-dasharray="2 3"/><text x="540" y="${y - 4}" text-anchor="end">Teto ${money(c.cap)}</text>`;
    }
  });
  [...new Set([0, Math.floor((days - 1) / 2), days - 1])].forEach((i) => {
    const date = parseDate(selectedRange().start);
    date.setUTCDate(date.getUTCDate() + i);
    svg += `<text x="${days === 1 ? 290 : 45 + (i * 495) / (days - 1)}" y="190" text-anchor="middle">${formatDate(isoDate(date)).slice(0, 5)}</text>`;
  });
  for (let i = 0; i < days; i++) {
    const date = parseDate(selectedRange().start);
    date.setUTCDate(date.getUTCDate() + i);
    const lines = ["Data: " + formatDate(isoDate(date))];
    for (const item of series.filter((s) => !s.old))
      lines.push(
        item.c.name +
          ": " +
          (cost ? money(item.values[i]) : num(item.values[i])) +
          (cost ? " / resultado" : " " + resultName().toLowerCase()),
      );
    if (state.compare) {
      const prevDate = parseDate(previousRange().start);
      prevDate.setUTCDate(prevDate.getUTCDate() + i);
      lines.push("Anterior: " + formatDate(isoDate(prevDate)));
      for (const item of series.filter((s) => s.old))
        lines.push(
          (item.c.label || item.c.name) +
            ": " +
            (cost ? money(item.values[i]) : num(item.values[i])),
        );
    }
    const step = days === 1 ? 495 : 495 / (days - 1),
      x = days === 1 ? 45 : Math.max(45, 45 + i * step - step / 2),
      width = days === 1 ? 495 : i === 0 || i === days - 1 ? step / 2 : step;
    svg += `<rect class="chart-day-hit" ${chartHint(lines)} data-day="${i}" x="${x}" y="25" width="${width}" height="148" fill="transparent"/>`;
  }
  return (
    svg +
    `<text x="45" y="209">${state.compare ? "Contínuo: atual · Tracejado: anterior, alinhado por dia do período" : "Período selecionado"}</text></svg>` +
    `<div class="legend">${list
      .slice(0, 4)
      .map((c) => `<span><i style="--c:${c.color}"></i>${c.name}</span>`)
      .join("")}</div>`
  );
}
function defaultScatter(list) {
  if (!list.length) return '<div class="empty">Sem campanhas.</div>';
  const prev = list.map(previousData),
    maxX = Math.max(1, ...[...list, ...(state.compare ? prev : [])].map((c) => c.spend)) * 1.3,
    maxY = Math.max(1, ...[...list, ...(state.compare ? prev : [])].map((c) => c.leads)) * 1.3;
  const point = (c) => [45 + (c.spend / maxX) * 480, 170 - (c.leads / maxY) * 140];
  let svg = `<svg class="chart" viewBox="0 0 560 230" role="img" aria-label="Investimento versus resultados"><text x="3" y="12">${resultName()}</text>`;
  for (let i = 0; i < 5; i++)
    svg += `<line class="grid" x1="45" x2="540" y1="${170 - i * 35}" y2="${170 - i * 35}"/><text x="37" y="${174 - i * 35}" text-anchor="end">${num((maxY * i) / 4)}</text><text x="${45 + i * 120}" y="190" text-anchor="middle">${num((maxX * i) / 4)}</text>`;
  list.forEach((c, i) => {
    const [x, y] = point(c),
      [px, py] = point(prev[i]);
    svg += `${state.compare ? `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="${c.color}" opacity=".6"/><circle ${scatterHint(prev[i], true)} cx="${px}" cy="${py}" r="6" fill="white" stroke="${c.color}" stroke-width="2"/>` : ""}<line x1="45" y1="${y}" x2="${x}" y2="${y}" stroke="${c.color}" opacity=".3" stroke-dasharray="3 3"/><line x1="${x}" y1="${y}" x2="${x}" y2="170" stroke="${c.color}" opacity=".3" stroke-dasharray="3 3"/><circle ${scatterHint(c, false)} cx="${x}" cy="${y}" r="6" fill="${c.color}"/>`;
  });
  return (
    svg +
    `<text x="290" y="207" text-anchor="middle">Investimento (R$)</text><text x="45" y="225">${state.compare ? "Vazio: anterior · Preenchido: atual · Linha liga a mesma campanha" : "Resultados do período selecionado"}</text></svg><div class="legend chart-campaign-legend">${list.map((c) => `<span title="${AdsData.escape(c.name)}"><i style="--c:${c.color}"></i>${AdsData.escape(c.label || c.name)}</span>`).join("")}</div>`
  );
}
function campaignTable(list) {
  return `<div class="table-wrap"><table><thead><tr><th>Campanha</th><th>Investimento</th><th>${resultName()}</th><th>${costName()}</th><th>Teto ${metricInfo("cap")}</th><th>Situação</th><th></th></tr></thead><tbody>${list
    .map((c) => {
      const [label, tone] = status(c);
      return `<tr class="clickable" data-open="${c.id}"><td class="campaign-table-cell"><div class="campaign-table-identity">${dot(c)}<button class="link-button" title="${c.name}" data-open="${c.id}">${c.name}</button>${deliveryBadge(c)}</div></td><td>${comparisonCell(c, "spend", money)}</td><td>${comparisonCell(c, "leads", num)}</td><td class="${c.cap != null && c.cpl > c.cap ? "bad" : ""}">${comparisonCell(c, "cpl", money)}</td><td>${money(c.cap)}</td><td><span class="badge ${tone}">${label}</span></td><td>›</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function macro() {
  const list = current();
  const blocks = {
    funnels: panel(
      "funnels",
      "Funis comparativos",
      funnels(list),
      `<div class="actions"><div class="segment"><button data-view="funis" class="${!state.matrix ? "on" : ""}">Funis</button><button data-view="matriz" class="${state.matrix ? "on" : ""}">Matriz</button></div><button id="choose-campaigns">＋ Campanhas</button></div>`,
      true,
    ),
    bars: panel(
      "bars",
      "Comparação por campanha",
      barChart(list),
      `<select id="metric" aria-label="Métrica das colunas">${Object.entries(metricLabels)
        .map(
          ([v, n]) => `<option value="${v}" ${state.metric === v ? "selected" : ""}>${n}</option>`,
        )
        .join("")}</select>`,
    ),
    trend: panel("trend", "Evolução comparativa", trend(list), `<small>${period()}</small>`),
    scatter: panel("scatter", "Investimento × resultados", scatter(list)),
    table: panel(
      "table",
      "Campanhas",
      campaignTable(list),
      `<small>Clique para aprofundar ›</small>`,
      true,
    ),
  };
  return `<div class="page-head"><div><h1>Comparar campanhas</h1><p>Uma visão. Todas as campanhas. Seu jeito de comparar.</p></div><div class="actions"><button id="organize" aria-pressed="${state.organize}" class="${state.organize ? "primary" : ""}">⠿ ${state.organize ? "Concluir organização" : "Organizar layout"}</button><button id="reset-layout" class="reset">↺ Redefinir layout</button></div></div>${state.organize ? '<div class="layout-help">Arraste pelas alças ⠿ para mover blocos e funis. Métricas ficam restritas à faixa superior. Pelo teclado: Alt + setas. Alterações salvas neste navegador.</div>' : ""}${filters()}${kpis(list)}<div class="workspace ${state.organize ? "organizing" : ""}">${state.order.map((id) => blocks[id]).join("")}</div><div class="foot"><span>Dados oficiais • ${destinationLabel()} • ${period()}</span><span>Metas e limites somente para leitura. Configure em Limites.</span></div>`;
}
const municipalities = ["São Paulo", "Guarulhos", "Santo André", "Osasco", "São Bernardo do Campo"];
function mapPage() {
  if (state.mapLevel === "neighborhoods") return neighborhoodPage();
  const rows = geographyRows(),
    locations = campaignTargetLocations(),
    regionalResults = metaRegionalResults(),
    regionalTotal = regionalResults.reduce((total, row) => total + row.value, 0),
    cities = locations.filter((location) => location.type === "city"),
    targeted = rows.reduce((total, row) => total + row.value, 0);
  return `<div class="page-head"><div><h1>Mapa de São Paulo</h1><p>Segmentação geográfica configurada nas campanhas • origem dos leads indisponível</p></div><div class="actions"><div class="segment"><button data-map-level="municipalities" class="on">Municípios</button><button data-map-level="neighborhoods">Bairros de São Paulo</button></div></div></div>${filters()}<div class="kpis map-stats">${[
    ["Resultados com região Meta", num(regionalTotal)],
    ["Regiões de resultado", num(regionalResults.length)],
    ["Municípios segmentados", num(cities.length)],
    ["Origem municipal/bairro", "—"],
  ]
    .map(
      ([k, v]) =>
        `<div class="kpi"><div class="kpi-label">${k}</div><strong style="font-size:21px">${v}</strong></div>`,
    )
    .join(
      "",
    )}</div><div class="map-layout"><div class="map-surface"><div id="map-drawing"></div><div class="map-heading">Campanhas segmentadas por município</div><div class="map-tools"><button data-zoom="in" aria-label="Aproximar mapa">+</button><button data-zoom="out" aria-label="Afastar mapa">−</button><button data-zoom="reset" aria-label="Redefinir mapa">⌖</button></div><div class="map-legend"><b>Campanhas</b>${[
    ["#fbd6dd", "1"],
    ["#f6a0af", "2"],
    ["#eb617d", "3"],
    ["#c92049", "4 ou mais"],
    ["#bccbd7", "Sem dados"],
  ]
    .map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`)
    .join("")}</div></div><div class="map-side">${panel(
    "ranking",
    "Resultados por região · Meta",
    regionalResults.length
      ? regionalResults
          .map(
            (row) =>
              `<div class="rank-row"><div class="row"><span>${AdsData.escape(row.name)}</span><b>${num(row.value)} <small>· ${regionalTotal ? pct((row.value / regionalTotal) * 100) : "—"}</small></b></div><div class="rank-track"><i style="width:${regionalTotal ? (row.value / regionalTotal) * 100 : 0}%"></i></div></div>`,
          )
          .join("")
      : '<p class="muted">— Sem breakdown regional para os filtros atuais.</p>',
  )}${panel(
    "targeting",
    "Segmentação na Grande São Paulo",
    rows
      .sort((a, b) => b.value - a.value)
      .map(
        (r) =>
          `<div class="rank-row" data-municipality="${r.name}" tabindex="0" role="button"><div class="row"><span>${r.name}</span><b>${num(r.value)} <small>campanha${r.value === 1 ? "" : "s"}</small></b></div><div class="rank-track"><i style="width:${targeted ? (r.value / Math.max(...rows.map((row) => row.value), 1)) * 100 : 0}%"></i></div></div>`,
      )
      .join(""),
  )}<div id="municipality-detail"></div><div class="map-note">ⓘ “Resultados por região” usa o breakdown <code>region</code> da Meta. O mapa mostra cidades incluídas na segmentação dos conjuntos selecionados. Nenhum dado vem do CRM.<br>A Meta não fornece município, bairro ou coordenada de origem de cada lead neste endpoint.<br>${locations.length ? `${locations.length} localizações de segmentação retornadas pela Meta para o filtro atual.` : "A Meta não retornou segmentação geográfica detalhada para o filtro atual."}<br><a href="https://github.com/tbrugz/geodata-br" target="_blank" rel="noreferrer">Malha municipal: geodata-br</a>.</div></div></div>`;
}
function paintMap() {
  if (state.mapLevel === "neighborhoods") {
    paintNeighborhoodMap();
    return;
  }
  renderStreetMap();
  if ($("#municipality-detail")) paintMunicipality();
}
function paintMunicipality() {
  const idx = municipalities.indexOf(state.municipality),
    list = current();
  $("#municipality-detail").innerHTML = panel(
    "municipality",
    state.municipality,
    idx < 0
      ? '<p class="muted">— Sem dados para este município.</p>'
      : `<table><thead><tr><th>Campanha</th><th>Segmentação</th></tr></thead><tbody>${list.map((c) => `<tr><td>${dot(c)}${c.name}</td><td>${(c.rows || []).some((row) => (row.targetLocations || []).some((location) => location.type === "city" && location.name.localeCompare(state.municipality, "pt-BR", { sensitivity: "base" }) === 0)) ? "Incluída" : "—"}</td></tr>`).join("")}</tbody></table>${state.municipality === "São Paulo" ? '<button class="primary" data-map-level="neighborhoods" style="margin-top:12px">Explorar bairros de São Paulo ›</button>' : ""}`,
  );
}
let neighborhoods = [];
let neighborhoodLoadError = false;
function neighborhoodPage() {
  if (!neighborhoods.length)
    return (
      '<h1>Bairros de São Paulo</h1><div class="empty">' +
      (neighborhoodLoadError
        ? "Não foi possível carregar a base. Recarregue a página."
        : "Carregando catálogo de bairros…") +
      "</div>"
    );
  const { rows, total, unknown } = neighborhoodData(),
    located = total == null ? null : total - unknown;
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  return `<button class="back" data-map-level="municipalities">← Grande São Paulo · municípios</button><div class="page-head"><div><h1>Bairros de São Paulo</h1><p>Ruas e bairros • ${neighborhoods.length} localidades no catálogo • sem localização de leads na fonte atual</p></div><div class="actions"><div class="segment"><button data-map-level="municipalities">Municípios</button><button class="on" data-map-level="neighborhoods">Bairros de São Paulo</button></div><select id="map-metric" aria-label="Métrica do mapa"><option value="leads" ${state.mapMetric === "leads" ? "selected" : ""}>${resultName()}</option><option value="share" ${state.mapMetric === "share" ? "selected" : ""}>Participação (%)</option></select></div></div>${filters()}<div class="kpis map-stats">${[
    ["São Paulo · total", num(total)],
    ["Com bairro informado", num(located)],
    ["Bairro não informado", num(unknown)],
    ["Maior volume", top.value ? `${top.name} · ${num(top.value)}` : "—"],
  ]
    .map(
      ([k, v]) =>
        `<div class="kpi"><div class="kpi-label">${k}</div><strong style="font-size:20px">${v}</strong></div>`,
    )
    .join(
      "",
    )}</div><div class="map-layout"><div class="map-surface"><div id="map-drawing"></div><div class="map-heading">São Paulo · bairros <small>(${num(state.bairroZoom)}×)</small></div><div class="map-tools"><button data-zoom="in" aria-label="Aproximar mapa">+</button><button data-zoom="out" aria-label="Afastar mapa">−</button><button data-zoom="reset" aria-label="Redefinir mapa">⌖</button></div><div class="map-legend"><b>● Volume por bairro</b><span>Círculo maior = mais ${resultName().toLowerCase()}</span><span>Ruas e nomes: OpenStreetMap • zoom para detalhar</span></div></div><div class="map-side">${panel("neighborhood-ranking", "Buscar bairro", `<input id="neighborhood-search" type="search" placeholder="Digite o nome do bairro…" aria-label="Buscar bairro"><small>${neighborhoods.length} localidades • ${neighborhoods.filter((n) => n.mapped).length} posições na malha</small><div id="neighborhood-results" class="neighborhood-results"></div>`)}<div id="neighborhood-detail"></div><div class="map-note">ⓘ A API atual não fornece a localização individual dos leads. Nenhum volume é distribuído por suposição. Pontos cinza são referências do catálogo, não leads.<br>Catálogo histórico não oficial: cobertura e coordenadas não garantidas. Nomes sem posição validada continuam na busca. Sem dados de leads aparece como —. Não são endereços de pessoas.<br>Catálogo: <a href="https://github.com/alanwillms/geoinfo" target="_blank" rel="noreferrer">geoinfo</a>. Malha municipal: <a href="https://github.com/tbrugz/geodata-br" target="_blank" rel="noreferrer">geodata-br</a>.</div></div></div>`;
}
function paintNeighborhoodMap() {
  if (!neighborhoods.length || !$("#map-drawing")) return;
  renderStreetMap();
  const { rows, allocations } = neighborhoodData();
  const selected = rows.find((n) => n.name === state.neighborhood) || rows[0];
  const idx = neighborhoods.findIndex((n) => n.name === selected.name);
  $("#neighborhood-detail").innerHTML = panel(
    "neighborhood",
    selected.name,
    `<p class="muted">${selected.value == null ? "— Sem dados de leads" : num(selected.value) + " " + resultName().toLowerCase()} · ${selected.mapped ? "Posição de referência" : "Posição não validada: não exibida no mapa"}</p><table><thead><tr><th>Campanha</th><th>Resultados</th></tr></thead><tbody>${allocations.map((a) => `<tr><td>${dot(a.campaign)}${a.campaign.name}</td><td>${selected.value == null ? "—" : num(a.values[idx])}</td></tr>`).join("")}</tbody></table>`,
  );
  paintNeighborhoodResults();
}
function paintNeighborhoodResults() {
  const box = $("#neighborhood-results");
  if (!box) return;
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const query = normalize($("#neighborhood-search")?.value || "");
  const rows = neighborhoodData()
    .rows.filter((n) => normalize(n.name).includes(query))
    .sort((a, b) => (b.value || 0) - (a.value || 0) || a.name.localeCompare(b.name, "pt-BR"));
  box.innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<button class="bairro-result" data-neighborhood="${r.name}"><span>${r.name}<small>${r.mapped ? "" : "Posição não validada"}</small></span><b>${num(r.value)}</b></button>`,
        )
        .join("")
    : '<p class="muted">Nenhum nome encontrado no catálogo.</p>';
}
function focusNeighborhood(name) {
  state.neighborhood = name;
  const n = neighborhoods.find((n) => n.name === name);
  paintNeighborhoodMap();
  if (n?.mapped && streetMap)
    streetMap.setView([n.lat, n.lng], Math.max(streetMap.getZoom(), 15), { animate: false });
}
document.addEventListener("input", (e) => {
  if (e.target.id === "neighborhood-search") paintNeighborhoodResults();
});
function input(label, key, type = "number", step = "1") {
  return `<div class="field"><label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" ${type === "number" ? `min="1" max="10000000" step="${step}"` : ""} value="${settings[key]}"></div>`;
}
function render() {
  persistFilters();
  if (!sourceData) {
    renderSourceState();
    return;
  }
  syncAlertHistory();
  hideChartTip();
  document.title =
    "Descomplica Ads · " +
    { macro: "Comparação", micro: "Campanha", map: "Mapa de São Paulo", settings: "Limites" }[
      state.page
    ];
  $$("aside [data-page]").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === state.page),
  );
  $("#main").innerHTML = {
    macro,
    micro,
    map: mapPage,
    settings: settingsPage,
    reports: reportsPage,
  }[state.page]();
  updateAlertCounter();
  if (state.page !== "settings") {
    const button = document.createElement("button");
    button.id = "download-report";
    button.className = "primary";
    button.textContent = "Baixar PDF";
    const head = document.querySelector(".page-head");
    let actions = head?.querySelector(".actions");
    if (!actions && head) {
      actions = document.createElement("div");
      actions.className = "actions";
      head.appendChild(actions);
    }
    if (actions) {
      const exportGroup = document.createElement("div");
      exportGroup.className = "pdf-export-group";
      exportGroup.appendChild(button);
      exportGroup.insertAdjacentHTML("beforeend", pdfSectionControls());
      actions.appendChild(exportGroup);
    }
  }
  if (expandedChart) mountExpandedFilters();
  syncFilterMasters();
  window.parent.postMessage(
    { type: "descomplica:meta-ads-modal-open" },
    new URL(document.baseURI).origin,
  );
  if (state.page === "map") paintMap();
}
function move(kind, id, target) {
  const arr = dragItems(kind);
  if (!arr) return;
  const from = arr.indexOf(id),
    to = arr.indexOf(target);
  if (from < 0 || to < 0 || from === to) return;
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  save(
    kind === "panel"
      ? "ads-live-compact-order"
      : kind === "kpi"
        ? "ads-live-compact-kpis"
        : "ads-live-compact-funnels",
    arr,
  );
  render();
  toast("Layout salvo neste navegador.");
}
function dragItems(kind) {
  return kind === "panel"
    ? state.order
    : kind === "funnel"
      ? state.funnelOrder
      : kind === "kpi"
        ? kpiOrder
        : null;
}
function dragTarget(event, kind) {
  return event.target.closest(
    kind === "panel" ? "[data-panel]" : kind === "kpi" ? "[data-kpi]" : "[data-funnel]",
  );
}
let dragging = null;
document.addEventListener("dragstart", (e) => {
  const handle = e.target.closest("[data-drag-id]");
  if (!state.organize || !handle) {
    e.preventDefault();
    return;
  }
  dragging = { kind: handle.dataset.dragKind, id: handle.dataset.dragId };
  e.dataTransfer.setData("text/plain", JSON.stringify(dragging));
  e.dataTransfer.effectAllowed = "move";
  handle.closest(".draggable").classList.add("dragging");
});
document.addEventListener("dragover", (e) => {
  if (!dragging) return;
  const target = dragTarget(e, dragging.kind);
  if (target) {
    e.preventDefault();
    $$(".drop-target").forEach((a) => a.classList.remove("drop-target"));
    target.classList.add("drop-target");
  }
});
document.addEventListener("drop", (e) => {
  if (!dragging) return;
  e.preventDefault();
  const target = dragTarget(e, dragging.kind);
  if (target) move(dragging.kind, dragging.id, target.dataset[dragging.kind]);
  dragging = null;
});
document.addEventListener("dragend", () => {
  dragging = null;
  $$(".dragging,.drop-target").forEach((a) => a.classList.remove("dragging", "drop-target"));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const openFilter = e.target.closest("details.filter-multiselect[open]");
    if (openFilter) {
      e.preventDefault();
      openFilter.open = false;
      openFilter.querySelector("summary")?.focus();
      return;
    }
  }
  if (["Enter", " "].includes(e.key) && e.target.matches("[data-neighborhood]")) {
    e.preventDefault();
    focusNeighborhood(e.target.dataset.neighborhood);
  }
  const h = e.target.closest("[data-drag-id]");
  if (
    state.organize &&
    h &&
    e.altKey &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    e.preventDefault();
    const kind = h.dataset.dragKind,
      id = h.dataset.dragId,
      arr = dragItems(kind),
      i = arr.indexOf(id),
      target = arr[i + (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1)];
    if (target) {
      move(kind, id, target);
      $(`[data-drag-id="${id}"]`).focus();
    }
  }
  if (["Enter", " "].includes(e.key) && e.target.matches("[data-municipality]")) {
    e.preventDefault();
    state.municipality = e.target.dataset.municipality;
    paintMap();
  }
});
document.addEventListener("click", (e) => {
  const page = e.target.closest("[data-page]");
  if (page) {
    state.page = page.dataset.page;
    state.organize = false;
    expandedChart = null;
    document.body.classList.remove("chart-is-expanded");
    render();
    window.scrollTo(0, 0);
    return;
  }
  const global = e.target.closest("[data-global]");
  if (global) {
    modal(
      `<h2>${AdsData.escape(global.dataset.global)}</h2><p>Esta navegação reproduz a navbar do Descomplica. Nesta prévia, as telas disponíveis ficam em Meta Ads.</p><button class="primary" onclick="document.querySelector('#dialog').close()">Continuar em Meta Ads</button>`,
    );
    return;
  }
  const theme = e.target.closest("button[data-theme]");
  if (theme) {
    setTheme(theme.dataset.theme);
    return;
  }
  if (e.target.closest("#close-dialog")) $("#dialog").close();
  const information = e.target.closest("[data-info]");
  if (information) {
    $("#dialog-body").textContent = information.dataset.info;
    $("#dialog").showModal();
  }
  if (e.target.closest("#organize")) {
    state.organize = !state.organize;
    render();
  }
  if (e.target.closest("#reset-layout")) {
    state.order = [...defaultOrder];
    kpiOrder = [...defaultKpiOrder];
    save("ads-live-compact-kpis", kpiOrder);
    state.funnelOrder = campaigns.map((c) => c.id);
    save("ads-live-compact-order", state.order);
    save("ads-live-compact-funnels", state.funnelOrder);
    render();
    toast("Posições originais restauradas. Filtros e ajustes preservados.");
  }
  if (e.target.closest("#choose-campaigns")) $(".campaign-filter").open = true;
  const view = e.target.closest("[data-view]");
  if (view) {
    state.matrix = view.dataset.view === "matriz";
    render();
  }
  const open = e.target.closest("[data-open]");
  if (open) {
    state.selected = open.dataset.open;
    state.page = "micro";
    state.detail = "sets";
    state.organize = false;
    render();
    window.scrollTo(0, 0);
  }
  const detail = e.target.closest("[data-detail]");
  if (detail) {
    state.detail = detail.dataset.detail;
    render();
  }
  const drill = e.target.closest("[data-drill]");
  if (drill) {
    state.setIndex = Number(drill.dataset.drill);
    state.detail = "ads";
    render();
  }
  if (e.target.closest("#evidence"))
    modal(
      `<h2>Ponto de investigação</h2><p>Compare a conversão de aberturas em resultados, o criativo, a oferta e a qualidade do público entre períodos equivalentes.</p><p>Um custo elevado isolado não comprova a causa. Compare dados suficientes e períodos equivalentes. Nenhuma hipótese é uma causa confirmada.</p>`,
    );
  const municipality = e.target.closest("[data-municipality]");
  if (municipality) {
    state.municipality = municipality.dataset.municipality;
    paintMap();
  }
  const zoom = e.target.closest("[data-zoom]");
  if (zoom) {
    if (zoom.dataset.zoom === "reset") {
      resetMapCamera();
      applyMapCamera();
    } else zoomMap(zoom.dataset.zoom === "in" ? 0.8 : 1.25);
  }
  const level = e.target.closest("[data-map-level]");
  if (level) {
    state.mapLevel = level.dataset.mapLevel;
    state.zoom = 1;
    state.bairroZoom = 1;
    resetMapCamera();
    render();
  }
  const bairro = e.target.closest("[data-neighborhood]");
  if (bairro) {
    focusNeighborhood(bairro.dataset.neighborhood);
  }
  if (e.target.closest("#discard")) {
    render();
    toast("Alterações não salvas descartadas.");
  }
  if (e.target.closest("#alerts")) showAlertHistory();
  const alertOpen = e.target.closest("[data-alert-open]");
  if (alertOpen) {
    const record = readAlertHistory()[alertOpen.dataset.alertRecord];
    if (record) {
      state.destinations = Array.isArray(record.destinations)
        ? [...record.destinations]
        : [record.destination].filter((destination) => destination && destination !== "mixed");
      state.destination =
        state.destinations.length === 1
          ? state.destinations[0]
          : state.destinations.length
            ? "mixed"
            : "unknown";
      state.startDate = record.start;
      state.endDate = record.end;
      state.days = Math.round((parseDate(record.end) - parseDate(record.start)) / 86400000) + 1;
      state.periodMode = "custom";
    }
    $("#dialog").close();
    state.selected = alertOpen.dataset.alertOpen;
    state.page = "micro";
    campaigns = [];
    rebuildCampaigns();
    refreshRange();
  }
});
function setTheme(theme) {
  document.body.dataset.theme = theme;
  $$("[data-theme]").forEach((b) => b.classList.toggle("selected", b.dataset.theme === theme));
  save("ads-live-compact-theme", theme);
}
