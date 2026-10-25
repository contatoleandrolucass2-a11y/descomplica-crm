"use strict";
let streetMap = null;
let streetOverlays = null;
let streetLevel = null;
let streetView = null;
let streetLayer = null;
let streetUpdating = false;
let streetHeat = null;
const defaultMapLayers = {
  base: true,
  points: true,
  heat: false,
  names: true,
  borders: false,
  unknown: false,
  style: "quiet",
  opacity: 55,
};
let mapLayers = { ...defaultMapLayers };
try {
  mapLayers = {
    ...defaultMapLayers,
    ...JSON.parse(preferenceStore.getItem("ads-live-compact-map-layers") || "{}"),
  };
} catch {}
const safeMapText = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function resetMapCamera() {
  streetView = null;
  if (streetMap && streetMap.getContainer().isConnected && streetLevel === state.mapLevel) {
    if (state.mapLevel === "neighborhoods") {
      const points = neighborhoods.filter((n) => n.mapped).map((n) => [n.lat, n.lng]);
      if (points.length) streetMap.fitBounds(points, { padding: [35, 35], animate: false });
    } else streetMap.setView([-23.58, -46.6], 10, { animate: false });
  }
}
function applyMapCamera() {
  if (streetMap && streetMap.getContainer().isConnected) streetMap.invalidateSize();
}
function zoomMap(factor) {
  if (streetMap) streetMap.setZoom(streetMap.getZoom() + (factor < 1 ? 1 : -1));
}
function renderStreetMap() {
  const host = document.querySelector("#map-drawing");
  if (!host || !geography || !window.L) return;
  if (!streetMap || streetMap.getContainer() !== host) {
    if (streetMap) {
      streetMap.off();
      streetMap.remove();
    }
    streetLevel = state.mapLevel;
    host.classList.add("street-map");
    streetMap = L.map(host, {
      zoomControl: false,
      scrollWheelZoom: true,
      preferCanvas: true,
      minZoom: 8,
      maxZoom: 19,
    });
    const initial = streetView || {
      center: streetLevel === "neighborhoods" ? [-23.56, -46.64] : [-23.58, -46.6],
      zoom: streetLevel === "neighborhoods" ? 13 : 10,
    };
    streetMap.setView(initial.center, initial.zoom, { animate: false });
    streetLayer = L.tileLayer("/api/meta-ads/tiles/{z}/{x}/{y}", {
      maxZoom: 19,
      keepBuffer: 1,
      updateWhenIdle: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
    }).addTo(streetMap);
    let tileFailures = 0,
      tileSuccess = 0;
    streetLayer.on("tileload", () => {
      tileSuccess++;
      document.querySelector(".map-network-warning")?.remove();
    });
    streetLayer.on("tileerror", () => {
      tileFailures++;
      if (
        tileFailures >= 3 &&
        tileSuccess === 0 &&
        !document.querySelector(".map-network-warning")
      ) {
        const notice = document.createElement("div");
        notice.className = "map-network-warning";
        notice.textContent =
          "Base de ruas indisponível. Verifique a internet; a segmentação continua visível.";
        host.parentElement.appendChild(notice);
      }
    });
    streetOverlays = L.layerGroup().addTo(streetMap);
    streetMap.on("moveend", () => {
      const c = streetMap.getCenter();
      streetView = { center: [c.lat, c.lng], zoom: streetMap.getZoom() };
      if (state.page !== "map") return;
      if (state.mapLevel === "municipalities" && streetMap.getZoom() >= 13) {
        state.mapLevel = "neighborhoods";
        render();
        return;
      }
      if (!streetUpdating) updateStreetOverlays();
    });
    requestAnimationFrame(() => streetMap?.invalidateSize());
  }
  ensureMapDisplayControl();
  updateStreetOverlays();
}
function updateStreetOverlays() {
  if (!streetMap || !streetOverlays || state.page !== "map") return;
  streetUpdating = true;
  streetOverlays.clearLayers();
  streetHeat = null;
  syncMapDisplayControl();
  if (mapLayers.heat) drawLeadHeat();
  if (state.mapLevel === "municipalities") {
    const values = Object.fromEntries(geographyRows().map((r) => [r.name, r.value]));
    if (mapLayers.borders)
      L.geoJSON(geography, {
        style: (f) => ({
          color: "#526b80",
          weight: f.properties.name === state.municipality ? 2 : 1,
          fillColor: "#dc2048",
          fillOpacity: values[f.properties.name] ? 0.15 : 0.015,
        }),
        onEachFeature: (f, layer) => {
          const name = f.properties.name;
          layer.bindTooltip(`${safeMapText(name)} · ${num(values[name])}`, { sticky: true });
          layer.on("click", () => {
            state.municipality = name;
            paintMunicipality();
            updateStreetOverlays();
          });
        },
      }).addTo(streetOverlays);
    const coords = {
      "São Paulo": [-23.55, -46.63],
      Guarulhos: [-23.46, -46.53],
      "Santo André": [-23.66, -46.53],
      Osasco: [-23.53, -46.79],
      "São Bernardo do Campo": [-23.7, -46.56],
    };
    if (mapLayers.points)
      geographyRows()
        .filter((row) => row.value > 0)
        .forEach((r) =>
          addLeadMarker(coords[r.name], r.name, r.value, false, () => {
            state.municipality = r.name;
            paintMunicipality();
          }),
        );
  } else {
    const d = neighborhoodData(),
      located = d.total - d.unknown;
    const bounds = streetMap.getBounds().pad(0.15),
      zoom = streetMap.getZoom();
    const capital = geography.features.find((f) => f.properties.name === "São Paulo");
    if (capital && mapLayers.borders)
      L.geoJSON(capital, {
        style: { color: "#536c80", weight: 1.3, fillOpacity: 0, interactive: false },
      }).addTo(streetOverlays);
    d.rows
      .filter((n) => n.mapped && bounds.contains([n.lat, n.lng]))
      .forEach((n) => {
        if (n.value != null && mapLayers.points) {
          addLeadMarker(
            [n.lat, n.lng],
            n.name,
            state.mapMetric === "share" ? (located ? (n.value / located) * 100 : 0) : n.value,
            true,
            () => focusNeighborhood(n.name),
          );
        } else if (
          n.value == null &&
          mapLayers.unknown &&
          (n.name === state.neighborhood || zoom >= 16)
        ) {
          const marker = L.circleMarker([n.lat, n.lng], {
            radius: n.name === state.neighborhood ? 7 : 3,
            color: "#fff",
            weight: 1.5,
            fillColor: n.name === state.neighborhood ? "#dd9527" : "#6f8697",
            fillOpacity: 0.9,
          }).addTo(streetOverlays);
          marker.bindTooltip(`${safeMapText(n.name)} · sem dados`, {
            permanent: mapLayers.names && n.name === state.neighborhood,
            direction: "top",
            className: "place-tooltip",
          });
          marker.on("click", () => focusNeighborhood(n.name));
        }
      });
  }
  const heading = document.querySelector(".map-heading small");
  if (heading) heading.textContent = `(zoom ${streetMap.getZoom()})`;
  streetUpdating = false;
}
function addLeadMarker(coords, name, value, neighborhood, onClick) {
  if (!coords) return;
  const display = neighborhood && state.mapMetric === "share" ? pct(value) : num(value);
  const selected = neighborhood ? state.neighborhood === name : state.municipality === name;
  const label = document.createElement("div");
  label.className = "lead-pin-label";
  label.textContent = name;
  const badge = document.createElement("div");
  badge.className = "lead-pin-count";
  badge.textContent = display;
  const size = Math.min(50, 32 + Math.sqrt(Math.max(0, value || 0)) * 1.5);
  badge.style.minWidth = size + "px";
  badge.style.height = size + "px";
  const wrapper = document.createElement("div");
  wrapper.className = "lead-pin " + (selected ? "selected" : "");
  wrapper.append(badge);
  if (mapLayers.names) wrapper.append(label);
  const icon = L.divIcon({
    html: wrapper,
    className: "lead-icon",
    iconSize: [130, 60],
    iconAnchor: [65, 23],
  });
  const marker = L.marker(coords, {
    icon,
    zIndexOffset: selected ? 1100 : 1000,
    keyboard: true,
    title: `${name}: ${display} campanha${value === 1 ? "" : "s"} segmentada${value === 1 ? "" : "s"}`,
  }).addTo(streetOverlays);
  marker.on("click", onClick);
}
function ensureMapDisplayControl() {
  const surface = document.querySelector(".map-surface");
  if (!surface || surface.querySelector(".map-display-control")) return;
  const control = document.createElement("details");
  control.className = "map-display-control map-layers";
  control.open = false;
  control.innerHTML = `<summary>▱ Camadas <span>⌄</span></summary><div class="layers-body"><p>Escolha o que aparece no mapa</p>
 ${[
   ["points", "Pontos de segmentação"],
   ["heat", "Densidade de campanhas"],
   ["names", "Nomes dos marcadores"],
   ["borders", "Limites municipais"],
   ["unknown", "Localidades sem dados"],
   ["base", "Ruas e referências"],
 ]
   .map(
     ([key, label]) =>
       `<label class="layer-option"><input type="checkbox" data-map-layer="${key}" ${mapLayers[key] ? "checked" : ""}><span>${label}</span></label>`,
   )
   .join("")}
 <div class="layers-base"><label for="map-base-style">Estilo da base</label><select id="map-base-style"><option value="quiet">Discreta · cinza</option><option value="original">Original · colorida</option></select>
 <label for="map-base-opacity">Intensidade da base <output id="map-opacity-output">${mapLayers.opacity}%</output></label><input type="range" id="map-base-opacity" min="20" max="100" step="5" value="${mapLayers.opacity}">
 <small>Ruas e nomes cartográficos pertencem à mesma camada.</small></div><button type="button" id="reset-map-layers">Restaurar visual limpo</button></div>`;
  const expand = document.createElement("button");
  expand.id = "map-fullscreen";
  expand.className = "map-fullscreen-button";
  expand.type = "button";
  surface.appendChild(expand);
  ensureFullscreenSearch();
  syncMapFullscreen();
  surface.appendChild(control);
  control.querySelector("#map-base-style").value = mapLayers.style;
}
function syncMapDisplayControl() {
  const host = document.querySelector("#map-drawing");
  host?.classList.toggle("heat-view", mapLayers.heat);
  host?.classList.toggle("quiet-base", mapLayers.style === "quiet");
  if (streetMap && streetLayer) {
    if (mapLayers.base && !streetMap.hasLayer(streetLayer)) streetLayer.addTo(streetMap);
    if (!mapLayers.base && streetMap.hasLayer(streetLayer)) streetMap.removeLayer(streetLayer);
    streetLayer.setOpacity(mapLayers.opacity / 100);
  }
  document
    .querySelectorAll("[data-map-layer]")
    .forEach((input) => (input.checked = !!mapLayers[input.dataset.mapLayer]));
  const style = document.querySelector("#map-base-style");
  if (style) style.value = mapLayers.style;
  const range = document.querySelector("#map-base-opacity");
  if (range) range.value = mapLayers.opacity;
  const output = document.querySelector("#map-opacity-output");
  if (output) output.textContent = mapLayers.opacity + "%";
  const legend = document.querySelector(".map-legend");
  if (!legend) return;
  if (mapLayers.heat)
    legend.innerHTML =
      "<b>Concentração de " +
      resultName().toLowerCase() +
      '</b><span>Menor</span><span class="heat-scale" aria-label="Escala de concentração"></span><span>Maior</span><small>Volume agregado • sem localização excluído</small>';
  else
    legend.innerHTML = mapLayers.points
      ? "<b>● Leads por " +
        (state.mapLevel === "neighborhoods" ? "bairro" : "município") +
        "</b><span>Controle a visibilidade em Camadas</span>"
      : "<span>Leads ocultos · ative Pontos ou Mapa de calor em Camadas</span>";
}
function saveMapLayers() {
  save("ads-live-compact-map-layers", mapLayers);
  state.mapDisplay = mapLayers.heat ? "heat" : "points";
  updateStreetOverlays();
}
document.addEventListener("change", (e) => {
  if (e.target.dataset.mapLayer) {
    mapLayers[e.target.dataset.mapLayer] = e.target.checked;
    saveMapLayers();
  }
  if (e.target.id === "map-base-style") {
    mapLayers.style = e.target.value;
    saveMapLayers();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "map-base-opacity") {
    mapLayers.opacity = Number(e.target.value);
    save("ads-live-compact-map-layers", mapLayers);
    syncMapDisplayControl();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("#reset-map-layers")) {
    mapLayers = { ...defaultMapLayers };
    saveMapLayers();
  }
});
function heatRows() {
  if (state.mapLevel === "neighborhoods")
    return neighborhoodData()
      .rows.filter((n) => n.mapped && n.value > 0)
      .map((n) => [n.lat, n.lng, n.value]);
  const coords = {
    "São Paulo": [-23.55, -46.63],
    Guarulhos: [-23.46, -46.53],
    "Santo André": [-23.66, -46.53],
    Osasco: [-23.53, -46.79],
    "São Bernardo do Campo": [-23.7, -46.56],
  };
  return geographyRows()
    .filter((r) => r.value > 0 && coords[r.name])
    .map((r) => [...coords[r.name], r.value]);
}
function drawLeadHeat() {
  const data = heatRows();
  if (!data.length) {
    const legend = document.querySelector(".map-legend");
    if (legend) legend.innerHTML = "<b>Sem leads localizados para os filtros selecionados.</b>";
    return;
  }
  streetHeat = L.heatLayer(data, {
    radius: 44,
    blur: 30,
    minOpacity: 0.08,
    max: Math.max(...data.map((p) => p[2])),
    maxZoom: streetMap.getZoom(),
    gradient: { 0.15: "#2563eb", 0.4: "#16b7b0", 0.65: "#f4db39", 0.85: "#f39030", 1: "#d51c46" },
  }).addTo(streetOverlays);
  const heading = document.querySelector(".map-heading small");
  if (heading) heading.textContent = `(zoom ${streetMap.getZoom()})`;
}
document.addEventListener("click", (e) => {
  const control = e.target.closest("[data-map-display]");
  if (!control) return;
  mapLayers.points = control.dataset.mapDisplay === "points";
  mapLayers.heat = !mapLayers.points;
  saveMapLayers();
});
function syncMapFullscreen() {
  const expanded = document.querySelector("#main").classList.contains("map-expanded");
  const button = document.querySelector("#map-fullscreen");
  if (button) {
    button.textContent = expanded ? "⤢ Sair da tela cheia" : "⤢ Tela cheia";
    button.setAttribute(
      "aria-label",
      expanded ? "Sair da tela cheia" : "Expandir mapa em tela cheia",
    );
    button.setAttribute("aria-pressed", String(expanded));
  }
  requestAnimationFrame(() => {
    if (streetMap && streetMap.getContainer().isConnected) streetMap.invalidateSize({ pan: false });
  });
}
async function closeMapFullscreen() {
  const main = document.querySelector("#main");
  main.classList.remove("map-expanded");
  if (document.fullscreenElement === main) await document.exitFullscreen();
  syncMapFullscreen();
  document.querySelector("#map-fullscreen")?.focus();
}
document.addEventListener("click", async (e) => {
  if (!e.target.closest("#map-fullscreen")) return;
  const main = document.querySelector("#main");
  if (main.classList.contains("map-expanded")) {
    await closeMapFullscreen();
    return;
  }
  main.classList.add("map-expanded");
  try {
    if (main.requestFullscreen) await main.requestFullscreen();
  } catch {
    /* Keep the viewport expansion when native fullscreen is unavailable. */
  }
  syncMapFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) document.querySelector("#main").classList.remove("map-expanded");
  syncMapFullscreen();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.querySelector("#main").classList.contains("map-expanded"))
    closeMapFullscreen();
});
let fullscreenSearchQuery = "";
function ensureFullscreenSearch() {
  const main = document.querySelector("#main");
  if (main.querySelector(".fullscreen-search")) return;
  const search = document.createElement("div");
  search.className = "fullscreen-search";
  search.innerHTML =
    '<label for="fullscreen-neighborhood-search">Buscar bairro de São Paulo</label><input id="fullscreen-neighborhood-search" type="search" autocomplete="off" placeholder="Digite o bairro para aproximar…" aria-controls="fullscreen-search-results"><div id="fullscreen-search-results" hidden></div>';
  main.querySelector(".map-layout").before(search);
  search.querySelector("input").value = fullscreenSearchQuery;
}
function paintFullscreenSearch() {
  const box = document.querySelector("#fullscreen-search-results");
  if (!box) return;
  const query = fullscreenSearchQuery
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  box.replaceChildren();
  box.hidden = !query;
  if (!query) return;
  const rows = neighborhoodData()
    .rows.filter((n) =>
      n.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 30);
  if (!rows.length) {
    box.textContent = "Nenhum bairro encontrado no catálogo.";
    return;
  }
  for (const row of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bairro-result";
    button.textContent = row.name + (row.mapped ? "" : " — posição não validada");
    button.disabled = !row.mapped;
    button.addEventListener("click", () => {
      fullscreenSearchQuery = row.name;
      if (state.mapLevel !== "neighborhoods") {
        state.mapLevel = "neighborhoods";
        render();
      }
      focusNeighborhood(row.name);
      document.querySelector("#fullscreen-neighborhood-search").value = row.name;
      document.querySelector("#fullscreen-neighborhood-search").focus();
      document.querySelector("#fullscreen-search-results").hidden = true;
    });
    box.appendChild(button);
  }
}
document.addEventListener("input", (e) => {
  if (e.target.id === "fullscreen-neighborhood-search") {
    fullscreenSearchQuery = e.target.value;
    paintFullscreenSearch();
  }
});
document.addEventListener("focusin", (e) => {
  if (e.target.id === "fullscreen-neighborhood-search") paintFullscreenSearch();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".fullscreen-search")) {
    const box = document.querySelector("#fullscreen-search-results");
    if (box) box.hidden = true;
  }
});
