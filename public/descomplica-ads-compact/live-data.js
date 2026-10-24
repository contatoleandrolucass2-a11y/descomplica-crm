"use strict";
let sourceData = null;
let sourceError = "";
let sourceLoading = false;
let sourceRequest = 0;
let campaigns = [];
const defaultSettings = {
  caps: {},
  budgets: {},
  yellow: 85,
  red: 100,
  sample: 30,
  clickSample: 300,
  history: 90,
  persistence: 1,
  notification: true,
  onlyChanges: true,
};
let settings = { ...defaultSettings, ...read("ads-live-compact-settings", {}) };
settings.caps = { ...settings.caps };
settings.budgets = { ...settings.budgets };
const initialView = document.documentElement.dataset.crmView;
let state = {
  page:
    {
      campaigns: "micro",
      accounts: "settings",
      reports: "reports",
      map: "map",
      settings: "settings",
    }[initialView] || "macro",
  selected: null,
  ids: [],
  days: 14,
  startDate: "",
  endDate: "",
  periodMode: "14",
  compare: false,
  destination: "whatsapp",
  account: "all",
  status: "active",
  organize: false,
  order: read("ads-live-compact-order", defaultOrder),
  funnelOrder: [],
  metric: "cpl",
  matrix: false,
  mapMetric: "leads",
  municipality: "São Paulo",
  zoom: 1,
  detail: "sets",
  setIndex: 0,
  mapLevel: "municipalities",
  mapDisplay: "points",
  neighborhood: "Butantã",
  bairroZoom: 1,
};
let restoredIds = null;
const filterFields = [
  "selected",
  "selectedSet",
  "ids",
  "days",
  "startDate",
  "endDate",
  "periodMode",
  "destination",
  "account",
  "status",
  "metric",
  "mapMetric",
  "mapLevel",
  "mapDisplay",
  "neighborhood",
];
try {
  const stored = JSON.parse(
    sessionStorage.getItem("ads-filters:v2:" + document.documentElement.dataset.storageScope) || "{}",
  );
  restoredIds = Array.isArray(stored.ids) ? stored.ids : null;
  for (const key of filterFields) if (stored[key] !== undefined) state[key] = stored[key];
} catch {}
function persistFilters() {
  try {
    sessionStorage.setItem(
      "ads-filters:v2:" + document.documentElement.dataset.storageScope,
      JSON.stringify(Object.fromEntries(filterFields.map((k) => [k, state[k]]))),
    );
  } catch {}
}
if (
  !Array.isArray(state.order) ||
  state.order.length !== 5 ||
  new Set(state.order).size !== 5 ||
  state.order.some((k) => !defaultOrder.includes(k))
)
  state.order = [...defaultOrder];
const destinationLabels = {
  form: "Formulário",
  site: "Site",
  whatsapp: "WhatsApp",
  unknown: "Não informado",
};
function destinationLabel() {
  return destinationLabels[state.destination] || "Não informado";
}
const deliveryStatusLabels = {
  active: "Ativa",
  paused: "Pausada",
  deleted: "Excluída",
  archived: "Excluída/arquivada (Meta)",
  unknown: "Status não informado",
};
function deliveryBadge(entity) {
  const deliveryStatus = entity.deliveryStatus || "unknown";
  return `<span class="badge delivery-status ${deliveryStatus}">${deliveryStatusLabels[deliveryStatus]}</span>`;
}
function filteredRows(old = false) {
  return AdsData.filter(sourceData?.rows || [], state, old ? previousRange() : selectedRange());
}
function capKey(level, id) {
  return [state.destination, level, id].join("|");
}
function capFor(entity) {
  const ids = [
    [entity.level || "campaign", entity.id],
    ["adset", entity.adsetId],
    ["campaign", entity.campaignId || entity.id],
    ["account", entity.rows?.[0]?.accountId || sourceData?.accountId],
  ];
  for (const [level, id] of ids) {
    const v = settings.caps[capKey(level, id)];
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}
function data(entity) {
  if (!entity) return null;
  const rows = AdsData.selectEntity(filteredRows(), entity);
  const before = AdsData.aggregate(AdsData.selectEntity(filteredRows(true), entity));
  return { ...entity, ...AdsData.aggregate(rows), cap: capFor(entity), previous: before.leads };
}
function previousData(entity) {
  return {
    ...entity,
    ...AdsData.aggregate(AdsData.selectEntity(filteredRows(true), entity)),
    cap: capFor(entity),
  };
}
function current() {
  return campaigns.filter((c) => state.ids.includes(c.id)).map(data);
}
function groupsForCampaign(c, level) {
  return AdsData.groups(
    filteredRows().filter(
      (r) => r.campaignId === c.id && (level !== "ad" || r.adsetId === state.selectedSet),
    ),
    level,
  ).map(data);
}
function budgetFor(c) {
  const scopes = [
    [c.level || "campaign", c.id],
    ["adset", c.adsetId],
    ["campaign", c.campaignId || c.id],
    ["account", c.rows?.[0]?.accountId || sourceData.accountId],
  ];
  for (const [level, id] of scopes) {
    const limit = settings.budgets[capKey(level, id)];
    if (Number.isFinite(limit) && limit > 0) {
      const spend = AdsData.aggregate(filteredRows().filter((r) => r[level + "Id"] === id)).spend;
      return { limit, spend, level };
    }
  }
  return null;
}
function status(c) {
  const budget = budgetFor(c);
  if (budget && budget.spend > (budget.limit * settings.red) / 100)
    return ["Investimento acima do limite", "red"];
  const budgetWarning = budget && budget.spend >= (budget.limit * settings.yellow) / 100;

  if (c.cap == null) return budgetWarning ? ["Atenção ao investimento", "warn"] : ["Sem teto", ""];
  if (c.leads < settings.sample || c.clicks < settings.clickSample) return ["Amostra baixa", ""];
  const costs = Array.from({ length: settings.persistence }, (_, i) => {
    const end = AdsData.shift(state.endDate, -i);
    return AdsData.aggregate(
      AdsData.selectEntity(
        AdsData.filter(sourceData.rows, state, { start: state.startDate, end }),
        c,
      ),
    ).cpl;
  });
  if (costs.some((v) => v == null)) return ["Base insuficiente", ""];
  if (costs.every((v) => v > (c.cap * settings.red) / 100)) return ["Acima do teto", "red"];
  if (costs.every((v) => v >= (c.cap * settings.yellow) / 100)) return ["Atenção", "warn"];
  return budgetWarning ? ["Atenção ao investimento", "warn"] : ["Dentro do teto", ""];
}
function rebuildCampaigns() {
  const old = campaigns.map((c) => c.id),
    all = AdsData.groups(
      sourceData.rows.filter(
        (r) =>
          (state.account === "all" || r.accountId === state.account) &&
          r.destination === state.destination &&
          (state.status === "all" || r.status === state.status),
      ),
    );
  campaigns = all;
  const requested = old.length ? state.ids : restoredIds;
  state.ids = requested
    ? requested.filter((id) => all.some((c) => c.id === id))
    : all.map((c) => c.id);
  restoredIds = null;
  const saved = read("ads-live-compact-funnels", []);
  state.funnelOrder = [...new Set([...saved, ...all.map((c) => c.id)])].filter((id) =>
    all.some((c) => c.id === id),
  );
  if (!all.some((c) => c.id === state.selected)) state.selected = all[0]?.id || null;
}
function renderSourceState() {
  hideChartTip();
  $("#main").innerHTML =
    `<div class="page-head"><h1>Descomplica Ads</h1></div><div class="empty" role="status">${sourceError ? 'Dados oficiais indisponíveis. Nenhum dado de demonstração foi exibido.<br><button id="reload-source">Tentar novamente</button>' : "Carregando dados oficiais da Meta…"}</div>`;
}
async function loadSource(range) {
  const request = ++sourceRequest;
  sourceLoading = true;
  sourceError = "";
  if (!sourceData) renderSourceState();
  else {
    $("#main").setAttribute("aria-busy", "true");
    $("#main").inert = true;
  }
  try {
    const query = range ? "?" + new URLSearchParams(range) : "";
    const response = await fetch("/api/meta-ads/data" + query, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw Error("Fonte indisponível");
    const payload = await response.json();
    if (
      payload.source !== "meta_marketing_api" ||
      !Array.isArray(payload.rows) ||
      !payload.range ||
      payload.rows.some(
        (r) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
          !["campaignId", "adsetId", "adId", "accountId"].every((k) => /^\d+$/.test(r[k])),
      )
    )
      throw Error("Resposta inválida");
    if (request !== sourceRequest) return;
    const first = !state.endDate;
    sourceData = payload;
    save(
      "ads-live-compact-colors",
      AdsData.registerCampaigns(
        payload.rows.map((r) => r.campaignId),
        read("ads-live-compact-colors", {}),
      ),
    );
    if (first) {
      state.endDate = payload.range.end;
      state.startDate = AdsData.shift(state.endDate, -13);
      const destinations = [...new Set(payload.rows.map((r) => r.destination))];
      if (!destinations.includes(state.destination)) state.destination = destinations[0] || "form";
    }
    if (state.startDate < payload.range.start || state.endDate > payload.range.end) {
      sourceLoading = false;
      return refreshRange();
    }
    rebuildCampaigns();
    sourceLoading = false;
    render();
  } catch {
    if (request !== sourceRequest) return;
    sourceLoading = false;
    sourceError = "unavailable";
    sourceData = null;
    renderSourceState();
    updateAlertCounter();
  } finally {
    if (request === sourceRequest) {
      $("#main").inert = false;
      $("#main").removeAttribute("aria-busy");
    }
  }
}
function refreshRange() {
  const start = state.compare ? previousRange().start : state.startDate;
  if (!sourceData || start < sourceData.range.start || state.endDate > sourceData.range.end)
    return loadSource({ start, end: state.endDate });
  render();
}
function filters() {
  const accounts = [...new Map(sourceData.rows.map((r) => [r.accountId, r.account])).entries()];
  return `<div class="filters"><div class="field"><label for="account">Conta de anúncios</label><select id="account">${[["all", "Todas as contas"], ...accounts].map(([id, name]) => `<option value="${id}" ${state.account === id ? "selected" : ""}>${AdsData.escape(name)}</option>`).join("")}</select></div><div class="field"><label for="period">Período</label><select id="period">${[
    ["7", "Últimos 7 dias"],
    ["14", "Últimos 14 dias"],
    ["30", "Últimos 30 dias"],
    ["month", "Este mês"],
    ["custom", "Personalizado"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.periodMode === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div><details class="field campaign-filter"><summary>Campanhas<br><b>${state.ids.length} selecionadas⌄</b></summary><div class="campaign-options">${campaigns.length ? campaigns.map((c) => `<label><input type="checkbox" data-campaign="${c.id}" ${state.ids.includes(c.id) ? "checked" : ""}>${dot(c)}${c.name}${deliveryBadge(c)}</label>`).join("") : "Sem campanhas neste recorte."}</div></details><div class="field"><label for="status">Status</label><select id="status">${[
    ["all", "Todos"],
    ["active", "Ativas"],
    ["paused", "Pausadas"],
    ["deleted", "Excluídas"],
    ["archived", "Excluídas/arquivadas (Meta)"],
    ["unknown", "Não informado"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.status === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="field"><label for="destination">Destino da conversão</label><select id="destination">${Object.entries(
    destinationLabels,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.destination === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div></div>${dateControls()}<div class="source-state"><span>Meta API · somente leitura · ${period()}</span><small>Atualizado em ${new Date(sourceData.fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · São Paulo</small></div>`;
}
function micro() {
  const c = data(campaigns.find((a) => a.id === state.selected));
  if (!c)
    return `<div class="page-head"><h1>Análise da campanha</h1></div>${filters()}<div class="empty">Nenhuma campanha disponível para os filtros.</div>`;
  const sets = groupsForCampaign(c, "adset");
  if (!sets.some((a) => a.id === state.selectedSet)) state.selectedSet = sets[0]?.id;
  const selectedSet = sets.find((a) => a.id === state.selectedSet),
    shown = state.detail === "sets" ? sets : groupsForCampaign(c, "ad");
  const before = previousData(c),
    message =
      c.cap != null && c.cpl > c.cap
        ? "Investigar custo acima do teto. Compare entrega, cliques e conversão."
        : "Compare cliques e resultados entre conjuntos e períodos equivalentes.";
  return `<button class="back" data-page="macro">← Voltar à visão macro</button><div class="page-head"><div><h1>${dot(c)}${c.name}${deliveryBadge(c)}</h1><p>${destinationLabel()} · ${period()}</p></div><select id="micro-campaign" aria-label="Campanha analisada">${campaigns.map((a) => `<option value="${a.id}" ${c.id === a.id ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>${filters()}${kpis([c])}<div class="banner"><span>${message} <small>Hipótese, não causa confirmada.</small></span><button id="evidence">Ver detalhes ›</button></div><div class="workspace">${panel("sets", state.detail === "sets" ? "Conjuntos de anúncios" : "Anúncios · " + (selectedSet?.name || "—"), barChart(shown, "cpl") + `<div class="table-wrap"><table><thead><tr><th>${state.detail === "sets" ? "Conjunto" : "Anúncio"}</th><th>Investimento</th><th>${resultName()}</th><th>Custo</th></tr></thead><tbody>${shown.map((a) => `<tr><td><button class="link-button" ${state.detail === "sets" ? `data-real-drill="${a.id}"` : ""}>${a.name}${state.detail === "sets" ? " ›" : ""}</button></td><td>${comparisonCell(a, "spend", money)}</td><td>${comparisonCell(a, "leads", num)}</td><td class="${a.cap != null && a.cpl > a.cap ? "bad" : ""}">${comparisonCell(a, "cpl", money)}</td></tr>`).join("")}</tbody></table></div>`, `<div class="segment"><button data-detail="sets" class="${state.detail === "sets" ? "on" : ""}">Conjuntos</button><button data-detail="ads" class="${state.detail === "ads" ? "on" : ""}">Anúncios</button></div>`)}${panel("funnel", "Funil da campanha", funnel(c) + "<small>Etapas não fornecidas pela fonte aparecem como —.</small>")}${panel("cost", "Evolução do custo", trend([c], true))}${
    state.compare
      ? panel(
          "previous",
          "Atual × anterior",
          `<table><thead><tr><th>Métrica</th><th>Atual</th><th>Anterior</th></tr></thead><tbody>${[
            ["leads", resultName(), num],
            ["spend", "Investimento", money],
            ["cpl", costName(), money],
          ]
            .map(
              ([key, label, format]) =>
                `<tr><td>${label}</td><td>${format(c[key])}</td><td>${format(before[key])}</td></tr>`,
            )
            .join("")}</tbody></table><small>${comparisonLabel()}</small>`,
        )
      : ""
  }</div>`;
}
function geographyRows() {
  return municipalities.map((name) => ({ name, value: null }));
}
function neighborhoodData() {
  return {
    rows: neighborhoods.map((n) => ({ ...n, value: null })),
    allocations: current().map((c) => ({ campaign: c, values: neighborhoods.map(() => null) })),
    total: null,
    unknown: null,
  };
}
function readAlertHistory() {
  const history = read("ads-live-compact-alert-history", {});
  return history && typeof history === "object" && !Array.isArray(history) ? history : {};
}
function updateAlertCounter(history = readAlertHistory()) {
  const unread = Object.values(history).filter((a) => !a.readAt),
    count = unread.length;
  const badge = $("#alert-count");
  if (badge) {
    badge.textContent = count;
    badge.hidden = !count;
  }
  window.parent.postMessage(
    {
      type: "descomplica:meta-ads-alert-state",
      count,
      severity: unread.some((a) => a.tone === "red") ? "danger" : count ? "warning" : "none",
    },
    new URL(document.baseURI).origin,
  );
}
function suggestedCap() {
  if (AdsData.shift(state.startDate, -settings.history) < sourceData.range.start) return null;
  const rows = AdsData.filter(sourceData.rows, state, {
      start: AdsData.shift(state.startDate, -settings.history),
      end: AdsData.shift(state.startDate, -1),
    }),
    a = AdsData.aggregate(rows);
  return a.leads >= settings.sample && a.clicks >= settings.clickSample ? a.cpl : null;
}
function settingsPage() {
  const level = state.settingLevel || "campaign",
    entities =
      level === "account"
        ? [{ id: sourceData.accountId, name: AdsData.escape(sourceData.accountName) }]
        : AdsData.groups(
            sourceData.rows.filter((r) => r.destination === state.destination),
            level,
          );
  return `<form id="settings-form"><div class="page-head"><div><h1>Ajustes</h1><p>Referências de análise salvas por usuário neste navegador.</p></div><div class="actions"><button type="button" id="discard">Descartar</button><button class="primary" type="submit">Salvar ajustes</button></div></div><div class="settings-scope"><label>Destino <select id="settings-destination">${Object.entries(
    destinationLabels,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.destination === id ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label><label>Nível <select id="setting-level">${[
    ["account", "Conta"],
    ["campaign", "Campanha"],
    ["adset", "Conjunto"],
    ["ad", "Anúncio"],
  ]
    .map(
      ([id, label]) => `<option value="${id}" ${level === id ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label></div><div class="settings-grid">${panel(
    "limits",
    "Metas e orçamento",
    `<p>Meta sugerida pelo histórico: <b>${money(suggestedCap())}</b> ${metricInfo("cap")}</p><small>Sugestão calculada com a amostra mínima. Sem base suficiente: —. Campo vazio herda o teto do nível superior.</small><div class="table-wrap"><table><thead><tr><th>${level === "account" ? "Conta" : "Item"}</th><th>Teto por resultado (R$)</th><th>Limite de investimento no período (R$)</th></tr></thead><tbody>${entities
      .map((e) => {
        const key = capKey(level, e.id);
        return `<tr><td>${e.name}</td><td><input aria-label="Teto ${e.name}" name="cap:${key}" type="number" min="0.01" max="10000000" step="0.01" value="${settings.caps[key] ?? ""}" placeholder="Herdar"></td><td><input aria-label="Investimento ${e.name}" name="budget:${key}" type="number" min="0.01" max="10000000" step="0.01" value="${settings.budgets[key] ?? ""}" placeholder="Sem limite"></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><small>Limites de acompanhamento. Nenhum orçamento ou anúncio é alterado na Meta.</small>`,
  )}${panel("rules", "Alertas e amostra", `<div class="form-row">${input("Amarelo (% do teto)", "yellow")}${input("Vermelho acima de (%)", "red")}</div><div class="form-row">${input("Histórico (dias)", "history")}${input("Amostra mínima de resultados", "sample")}</div><div class="form-row">${input("Mínimo de cliques", "clickSample")}${input("Persistência (dias)", "persistence")}</div><small>Persistência verifica o custo acumulado do recorte nos últimos dias. Alertas são observados enquanto o painel está aberto.</small><label><input type="checkbox" name="notification" ${settings.notification ? "checked" : ""}> Alertas no aplicativo</label><label><input type="checkbox" name="onlyChanges" ${settings.onlyChanges ? "checked" : ""}> Registrar somente mudanças de situação</label><small>E-mail e resumo agendado não estão conectados. Não há promessa de envio em segundo plano.</small><p>Comparação: período anterior equivalente. Visibilidade controlada nos filtros.</p>`)} </div></form>`;
}
function reportsPage() {
  return `<div class="page-head"><div><h1>Relatórios</h1><p>Escolha as seções e baixe o PDF com os filtros atuais.</p></div></div>${filters()}${kpis(current())}${panel("report-table", "Campanhas do relatório", campaignTable(current()))}`;
}
document.addEventListener("submit", (e) => {
  if (e.target.id === "custom-period-form") {
    e.preventDefault();
    const start = $("#date-start").value,
      end = $("#date-end").value,
      days = AdsData.days(start, end);
    if (!Number.isFinite(days) || days < 1 || days > 366) {
      $("#date-error").textContent = "Escolha de 1 a 366 dias, com início antes ou igual ao fim.";
      return;
    }
    state.startDate = start;
    state.endDate = end;
    state.days = days;
    state.periodMode = "custom";
    refreshRange();
  }
  if (e.target.id !== "settings-form") return;
  e.preventDefault();
  const form = new FormData(e.target),
    next = { ...settings, caps: { ...settings.caps }, budgets: { ...settings.budgets } };
  for (const [key, value] of form) {
    if (key.startsWith("cap:") || key.startsWith("budget:")) {
      const target = key.startsWith("cap:") ? next.caps : next.budgets;
      const id = key.slice(key.indexOf(":") + 1);
      if (value === "") delete target[id];
      else if (Number(value) > 0 && Number(value) <= 10000000) target[id] = Number(value);
    } else if (typeof defaultSettings[key] === "number") next[key] = Number(value);
  }
  next.notification = form.has("notification");
  next.onlyChanges = form.has("onlyChanges");
  if (
    next.yellow >= next.red ||
    !["yellow", "red", "sample", "clickSample", "history", "persistence"].every(
      (k) => Number.isFinite(next[k]) && next[k] >= 1,
    ) ||
    next.history > 366 ||
    next.persistence > 366
  ) {
    toast("Revise os limites: amarelo menor que vermelho e prazos de até 366 dias.");
    return;
  }
  settings = next;
  save("ads-live-compact-settings", settings);
  render();
  toast("Ajustes salvos neste navegador.");
});
document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (id === "compare-period") {
    state.compare = e.target.checked;
    refreshRange();
    return;
  }
  if (id === "period") {
    state.periodMode = e.target.value;
    if (state.periodMode !== "custom") {
      state.endDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      state.startDate =
        state.periodMode === "month"
          ? state.endDate.slice(0, 8) + "01"
          : AdsData.shift(state.endDate, 1 - Number(state.periodMode));
      state.days = AdsData.days(state.startDate, state.endDate);
      refreshRange();
    } else render();
    return;
  }
  if (["account", "status", "destination", "settings-destination"].includes(id)) {
    state[id === "settings-destination" ? "destination" : id] = e.target.value;
    campaigns = [];
    rebuildCampaigns();
    render();
    return;
  }
  if (e.target.dataset.campaign) {
    state.ids = e.target.checked
      ? [...new Set([...state.ids, e.target.dataset.campaign])]
      : state.ids.filter((id) => id !== e.target.dataset.campaign);
    render();
    $(".campaign-filter").open = true;
  }
  if (id === "metric") {
    state.metric = e.target.value;
    render();
  }
  if (id === "map-metric") {
    state.mapMetric = e.target.value;
    render();
  }
  if (id === "setting-level") {
    state.settingLevel = e.target.value;
    render();
  }
  if (id === "micro-campaign") {
    state.selected = e.target.value;
    state.selectedSet = null;
    render();
  }
  if (e.target.dataset.swap) {
    if (state.page === "micro") {
      state.selected = e.target.value;
      render();
      return;
    }
    const from = e.target.dataset.swap,
      to = e.target.value,
      i = state.funnelOrder.indexOf(from),
      j = state.funnelOrder.indexOf(to);
    [state.funnelOrder[i], state.funnelOrder[j]] = [state.funnelOrder[j], state.funnelOrder[i]];
    if (!state.ids.includes(to)) state.ids = state.ids.map((id) => (id === from ? to : id));
    save("ads-live-compact-funnels", state.funnelOrder);
    render();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("#reload-source")) loadSource();
  const drill = e.target.closest("[data-real-drill]");
  if (drill) {
    state.selectedSet = drill.dataset.realDrill;
    state.detail = "ads";
    render();
  }
});
window.addEventListener("message", (event) => {
  if (
    event.source === window.parent &&
    event.origin === new URL(document.baseURI).origin &&
    event.data?.type === "descomplica:meta-ads-open-alerts"
  )
    showAlertHistory();
});
Promise.allSettled([
  fetch("/descomplica-ads-compact/assets/bairros.json")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((d) => {
      neighborhoods = d.items;
    })
    .catch(() => {
      neighborhoodLoadError = true;
    }),
  fetch("/descomplica-ads-compact/assets/municipios.json")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((d) => {
      geography = d;
    }),
]).then(() => {
  if (sourceData && state.page === "map") render();
});
loadSource();
