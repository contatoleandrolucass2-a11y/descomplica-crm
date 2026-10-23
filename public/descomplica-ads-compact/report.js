"use strict";
async function downloadAdsReport() {
  const selected = { ...pdfSections };
  if (!sourceData || sourceLoading || !Object.values(selected).some(Boolean)) return;
  const button = document.querySelector("#download-report");
  button.disabled = true;
  button.textContent = "Gerando PDF…";
  try {
    const list = (
      state.page === "micro" ? [data(campaigns.find((c) => c.id === state.selected))] : current()
    ).filter(Boolean);
    const reportDestination = state.destination;
    const range = { ...selectedRange() },
      comparison = state.compare,
      previousLabel = rangeLabel(previousRange());
    const pageName = state.page === "micro" ? "Análise da campanha" : "Análise de campanhas";
    const filtersText = [
      sourceData.accountName,
      destinationLabel(),
      {
        all: "Todos os status",
        active: "Ativas",
        paused: "Pausadas",
        unknown: "Status não informado",
      }[state.status],
      list.length + " campanhas",
    ].join(" | ");
    const updated = new Date(sourceData.fetchedAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const summaries = AdsData.aggregate(
      list.flatMap((c) => AdsData.selectEntity(filteredRows(), c)),
    );
    const prior = AdsData.aggregate(
      list.flatMap((c) => AdsData.selectEntity(filteredRows(true), c)),
    );
    const tableRows = list.map((c) => [
      c.label || c.name,
      money(c.spend),
      num(c.leads),
      money(c.cpl),
      money(c.cap),
      status(c)[0],
    ]);
    const comparedRows = comparison
      ? list.map((c) => [
          c.label || c.name,
          ...["spend", "leads", "cpl"].map((k) => changeLabel(c[k], previousData(c)[k])),
        ])
      : [];
    const charts = [
      ["Comparação por campanha · " + metricLabels[state.metric], barChart(list, state.metric)],
      ["Investimento × resultados", scatter(list)],
      ["Evolução diária · até quatro campanhas", trend(list)],
    ];
    const map = buildReportMap(list, state.mapLevel === "neighborhoods");
    const guides = selected.guide
      ? ["spend", "leads", "cpl", "ctr", "cpc", "cpm", "cap"].map(metricGuide)
      : [];
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
    const clean = (v) =>
      String(v ?? "—")
        .replace(/[–—]/g, "-")
        .replace(/ /g, " ");
    const text = (v, x, y, size = 10, color = "#182437") => {
      pdf.setFontSize(size);
      pdf.setTextColor(color);
      pdf.text(clean(v), x, y);
    };
    let started = false,
      title = "",
      cursor = 0;
    function page(name) {
      if (started) pdf.addPage();
      started = true;
      title = name;
      pdf.setFillColor("#142b3d");
      pdf.rect(0, 0, 210, 29, "F");
      pdf.setFont("helvetica", "bold");
      text("Descomplica Ads", 14, 13, 19, "#ffffff");
      text(name, 14, 23, 11, "#ffffff");
      pdf.setFont("helvetica", "normal");
      text("Período: " + rangeLabel(range), 14, 39);
      cursor = 46;
      for (const line of pdf.splitTextToSize(clean(filtersText), 182)) {
        text(line, 14, cursor, 8);
        cursor += 4;
      }
      if (comparison) {
        text("Anterior: " + previousLabel, 14, cursor, 8);
        cursor += 5;
      }
      cursor += 8;
    }
    function room(height) {
      if (cursor + height > 267) page(title + " · continuação");
    }
    function paragraph(content, size = 9) {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(clean(content), 180);
      for (const line of lines) {
        room(6);
        text(line, 14, cursor, size);
        cursor += 5;
      }
      cursor += 3;
    }
    function table(headers, rows, widths) {
      function heading() {
        let x = 14;
        pdf.setFillColor("#eaf0f5");
        pdf.rect(14, cursor - 5, 182, 8, "F");
        headers.forEach((h, i) => {
          text(h, x + 1, cursor, 8);
          x += widths[i];
        });
        cursor += 8;
      }
      heading();
      for (const row of rows) {
        pdf.setFontSize(8);
        const lines = row.map((v, i) => pdf.splitTextToSize(clean(v), widths[i] - 3)),
          height = Math.max(...lines.map((l) => l.length)) * 4 + 5;
        if (cursor + height > 267) {
          page(title + " · continuação");
          heading();
        }
        let x = 14;
        lines.forEach((ls, i) => {
          ls.forEach((line, j) => text(line, x + 1, cursor + j * 4, 8));
          x += widths[i];
        });
        cursor += height;
        pdf.setDrawColor("#dce3eb");
        pdf.line(14, cursor - 3, 196, cursor - 3);
      }
    }
    if (selected.summary) {
      page(pageName);
      for (const [key, label, format] of [
        ["spend", "Investimento", money],
        ["leads", resultName(), num],
        ["cpl", costName(), money],
        ["ctr", "CTR", pct],
        ["cpc", "CPC", money],
        ["cpm", "CPM", money],
      ]) {
        text(label, 14, cursor, 10);
        text(format(summaries[key]), 110, cursor, 13);
        cursor += 7;
        if (comparison) {
          text(
            "Anterior: " +
              format(prior[key]) +
              " | Variação: " +
              changeLabel(summaries[key], prior[key]),
            14,
            cursor,
            9,
          );
          cursor += 7;
        }
        cursor += 8;
      }
      paragraph(
        "Cadastros e conversas iniciadas são analisados separadamente. Custo elevado é um ponto de investigação, não uma causa confirmada.",
      );
    }
    if (selected.table) {
      page("Campanhas do período");
      table(
        ["Campanha", "Investimento", "Resultados", "Custo", "Teto", "Situação"],
        tableRows,
        [56, 27, 21, 25, 23, 30],
      );
      if (comparison) {
        page("Variação frente ao período anterior");
        table(["Campanha", "Investimento", "Resultados", "Custo"], comparedRows, [83, 33, 33, 33]);
      }
    }
    if (selected.charts || selected.evolution) {
      for (let i = 0; i < charts.length; i++) {
        if (i === 2 ? !selected.evolution : !selected.charts) continue;
        const [name, html] = charts[i];
        page(name);
        const svg = html.match(/<svg[\s\S]*?<\/svg>/)?.[0];
        if (svg) {
          pdf.addImage(await reportSvgImage(svg), "PNG", 14, cursor, 182, 90);
          cursor += 97;
        } else paragraph("Sem campanhas selecionadas.");
        paragraph(
          comparison
            ? "Cor sólida: atual. Cor clara ou tracejado: anterior. Datas do período anterior são alinhadas por posição."
            : "Apenas o período selecionado.",
        );
        if (i === 0)
          paragraph(
            "Referência de teto por campanha, quando configurada. Uma linha por campanha quando os tetos diferem.",
          );
        for (const c of i === 2 ? list.slice(0, 4) : list) {
          room(6);
          text(c.label || c.name, 14, cursor, 8, c.color);
          cursor += 5;
        }
      }
    }
    if (selected.funnels) {
      page("Funis por campanha");
      for (const c of list) {
        room(57);
        paragraph(c.label || c.name, 11);
        const stages =
          reportDestination === "whatsapp"
            ? [
                ["Cliques", c.clicks],
                ["Conversas iniciadas", c.leads],
                ["Qualificados", c.qualified],
              ]
            : [
                ["Cliques", c.clicks],
                [reportDestination === "site" ? "Visitas" : "Aberturas", c.opens],
                ["Cadastros", c.leads],
                ["Qualificados", c.qualified],
              ];
        for (const [label, value] of stages) {
          text(label, 14, cursor, 9);
          text(num(value), 150, cursor, 9);
          cursor += 7;
        }
        paragraph("Clique → resultado: " + pct(AdsData.ratio(c.leads, c.clicks, 100)));
      }
    }
    if (selected.origin) {
      page("Origem dos leads");
      paragraph(
        "A fonte oficial atual não fornece município, bairro ou coordenadas dos leads. A origem não pode ser deduzida do nome da campanha nem da segmentação do anúncio.",
      );
      table(
        ["Localização", "Resultados"],
        [["Sem localização informada", num(summaries.leads)]],
        [130, 52],
      );
      paragraph("Ausência de dados é representada por —, não por zero.");
    }
    if (selected.map) {
      page("Mapa de São Paulo");
      paragraph(
        "Malha de referência. Não há pontos de leads porque a fonte atual não fornece localização.",
      );
      if (map.svg) {
        pdf.addImage(await reportSvgImage(map.svg), "PNG", 14, cursor, 182, 130);
        cursor += 138;
      }
      paragraph(
        "Base geográfica: geodata-br. O PDF utiliza a malha municipal, sem ruas ou localizações inferidas.",
      );
    }
    for (const guide of guides) {
      page("Guia · " + guide.title);
      for (const [label, content] of [
        ["O que é", guide.definition],
        ["Fórmula", guide.formula],
        ["Exemplo ilustrativo", guide.example],
        ["O que afeta", guide.impact],
        ["Como investigar", guide.actions.join(" • ")],
        ["Cuidados", guide.caution],
      ]) {
        room(20);
        paragraph(label, 11);
        paragraph(content);
      }
    }
    for (let n = 1; n <= pdf.getNumberOfPages(); n++) {
      pdf.setPage(n);
      pdf.setDrawColor("#d9204a");
      pdf.line(14, 278, 196, 278);
      text("Fonte: Meta Marketing API · Atualizada em " + updated + " (São Paulo)", 14, 283, 7);
      text(n + " / " + pdf.getNumberOfPages(), 181, 289, 8);
    }
    pdf.save("descomplica-ads-" + range.start + "-a-" + range.end + ".pdf");
  } catch (error) {
    console.error(error);
    toast("Não foi possível gerar o PDF. Tente novamente.");
  } finally {
    button.disabled = !Object.values(pdfSections).some(Boolean);
    button.textContent = "Baixar PDF";
  }
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#download-report")) downloadAdsReport();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "pdf-include-guide") save("ads-live-compact-pdf-guide", e.target.checked);
});
function reportSvgImage(source) {
  return new Promise((resolve, reject) => {
    const doc = new DOMParser().parseFromString(
      source.replaceAll("&nbsp;", "&#160;"),
      "image/svg+xml",
    );
    const svg = doc.documentElement;
    if (doc.querySelector("parsererror")) {
      reject(Error("Gráfico inválido para exportação."));
      return;
    }
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const view = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    svg.setAttribute("width", view[2]);
    svg.setAttribute("height", view[3]);
    const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      "text{font:11px Arial,sans-serif;fill:#182437}.grid{stroke:#dce3eb;stroke-width:1}";
    svg.prepend(style);
    const xml = new XMLSerializer()
      .serializeToString(svg)
      .replaceAll("var(--text)", "#182437")
      .replaceAll("var(--muted)", "#718096");
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = view[2] * 3;
      canvas.height = view[3] * 3;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / view[2], canvas.height / view[3]);
      ctx.drawImage(
        image,
        (canvas.width - view[2] * scale) / 2,
        (canvas.height - view[3] * scale) / 2,
        view[2] * scale,
        view[3] * scale,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("Não foi possível renderizar o gráfico."));
    };
    image.src = url;
  });
}
function buildReportMap(list, bairros) {
  const points = [];
  const level = bairros ? "bairros de São Paulo" : "municípios";
  if (!geography) return { points, level, svg: null };
  const features = geography.features.filter((f) => !bairros || f.properties.name === "São Paulo");
  const rings = features.flatMap((f) =>
    f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat(),
  );
  const all = rings.flat();
  const xs = all.map((p) => p[0] * Math.cos((23.55 * Math.PI) / 180)),
    ys = all.map((p) => -p[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    dx = Math.max(...xs) - minX,
    dy = Math.max(...ys) - minY,
    scale = Math.min(640 / dx, 450 / dy);
  const project = (lng, lat) => [
    30 + (640 - dx * scale) / 2 + (lng * Math.cos((23.55 * Math.PI) / 180) - minX) * scale,
    25 + (450 - dy * scale) / 2 + (-lat - minY) * scale,
  ];
  let svg =
    '<svg viewBox="0 0 700 500" xmlns="http://www.w3.org/2000/svg"><rect width="700" height="500" fill="#f4f6f8"/>';
  for (const ring of rings)
    svg +=
      '<path d="' +
      ring.map((p, i) => (i ? "L" : "M") + project(...p).join(",")).join(" ") +
      ' Z" fill="#e1e8ee" stroke="#91a4b4" stroke-width="1"/>';
  const max = Math.max(1, ...points.map((p) => p.value));
  points.forEach((p, i) => {
    const [x, y] = project(p.lng, p.lat),
      r = 6 + Math.sqrt(p.value / max) * 5;
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="#d9204a" fill-opacity=".85" stroke="white" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="fill:white;font-weight:bold">${i + 1}</text>`;
  });
  return { points, level, svg: svg + "</svg>" };
}
