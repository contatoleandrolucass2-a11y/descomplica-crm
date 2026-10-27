import type { DashboardCard } from "../../types";
import { cardSummary } from "./model";
import type { ConfigurableDashboardCatalog, DashboardExportContext } from "./types";

export const JSPDF_ASSET_PATH = "/descomplica-ads-compact/assets/jspdf/jspdf.umd.min.js";

export interface JsPdfDocument {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addImage(
    imageData: string,
    format: "PNG",
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  addPage(): void;
  output(type: "arraybuffer"): ArrayBuffer;
  rect(x: number, y: number, width: number, height: number): void;
  save(filename: string): void;
  setDrawColor(red: number, green: number, blue: number): void;
  setFontSize(size: number): void;
  setTextColor(red: number, green: number, blue: number): void;
  splitTextToSize(text: string, width: number): string[];
  text(text: string | string[], x: number, y: number): void;
}

export type JsPdfConstructor = new (options?: {
  orientation?: "portrait" | "landscape";
  unit?: "mm";
  format?: "a4";
}) => JsPdfDocument;

export interface DashboardPdfInput {
  cards: readonly DashboardCard[];
  catalog: ConfigurableDashboardCatalog;
  exportContext: DashboardExportContext;
  cardElements?: readonly HTMLElement[] | undefined;
}

function addWrappedText(
  document: JsPdfDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 5,
) {
  const lines = document.splitTextToSize(text, width);
  document.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function buildDashboardPdfDocument(
  JsPdf: JsPdfConstructor,
  { cards, catalog, exportContext }: DashboardPdfInput,
) {
  const document = new JsPdf({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  document.setTextColor(24, 42, 64);
  document.setFontSize(18);
  y = addWrappedText(document, exportContext.title, margin, y, contentWidth, 7) + 2;
  document.setFontSize(9);
  const contextLines = [
    exportContext.context && `Contexto: ${exportContext.context}`,
    exportContext.filters && `Filtros: ${exportContext.filters}`,
    exportContext.source && `Fonte: ${exportContext.source}`,
    exportContext.generatedAt && `Horário: ${exportContext.generatedAt}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of contextLines) y = addWrappedText(document, line, margin, y, contentWidth) + 1;

  for (const [index, card] of cards.entries()) {
    const title =
      card.title?.trim() ||
      catalog.metrics.find(({ key }) => key === card.metric)?.label ||
      card.metric;
    const summaryLines = cardSummary(card, catalog).flatMap((line) =>
      document.splitTextToSize(line, contentWidth - 8),
    );
    let remaining = summaryLines;
    let continuation = false;
    while (remaining.length > 0) {
      if (y + 19 > pageHeight - margin) {
        document.addPage();
        y = margin;
      }
      const availableLines = Math.max(1, Math.floor((pageHeight - margin - y - 14) / 5));
      const segment = remaining.slice(0, availableLines);
      remaining = remaining.slice(segment.length);
      const segmentHeight = 14 + segment.length * 5;
      document.setDrawColor(127, 149, 173);
      document.rect(margin, y, contentWidth, segmentHeight);
      document.setFontSize(12);
      document.text(
        `${index + 1}. ${title}${continuation ? " (continuação)" : ""}`,
        margin + 4,
        y + 7,
      );
      document.setFontSize(9);
      document.text(segment, margin + 4, y + 13);
      y += segmentHeight + 5;
      continuation = true;
      if (remaining.length > 0) {
        document.addPage();
        y = margin;
      }
    }
  }

  return document;
}

let loader: Promise<JsPdfConstructor> | null = null;

export function loadJsPdf(): Promise<JsPdfConstructor> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("PDF disponível apenas no navegador."));
  const browserWindow = window as Window & { jspdf?: { jsPDF?: JsPdfConstructor } };
  if (browserWindow.jspdf?.jsPDF) return Promise.resolve(browserWindow.jspdf.jsPDF);
  if (loader) return loader;
  loader = new Promise<JsPdfConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${JSPDF_ASSET_PATH}"]`);
    const script = existing ?? document.createElement("script");
    const finish = () => {
      if (browserWindow.jspdf?.jsPDF) resolve(browserWindow.jspdf.jsPDF);
      else reject(new Error("jsPDF carregou sem expor o construtor esperado."));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Falha ao carregar o jsPDF vendorizado.")),
      {
        once: true,
      },
    );
    if (!existing) {
      script.src = JSPDF_ASSET_PATH;
      script.async = true;
      script.dataset.dashboardJspdf = "true";
      document.head.append(script);
    }
  }).catch((error) => {
    loader = null;
    throw error;
  });
  return loader;
}

function copyComputedStyles(source: Element, target: Element) {
  if ("style" in target) {
    const computed = window.getComputedStyle(source);
    const style = (target as HTMLElement).style;
    for (const property of computed) {
      style.setProperty(
        property,
        computed.getPropertyValue(property),
        computed.getPropertyPriority(property),
      );
    }
  }
  const sourceChildren = [...source.children];
  const targetChildren = [...target.children];
  for (const [index, child] of sourceChildren.entries()) {
    const targetChild = targetChildren[index];
    if (targetChild) copyComputedStyles(child, targetChild);
  }
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível renderizar a imagem do card."));
    image.src = source;
  });
}

export async function captureDashboardCard(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(bounds.width || element.offsetWidth));
  const height = Math.max(1, Math.ceil(bounds.height || element.offsetHeight));
  const clone = element.cloneNode(true) as HTMLElement;
  copyComputedStyles(element, clone);
  clone
    .querySelectorAll("[data-dashboard-export-ignore], input, select, textarea")
    .forEach((control) => control.remove());
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.append(clone);
  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    const pixelRatio = Math.max(1, Math.min(2, 2400 / Math.max(width, height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("O navegador não disponibilizou o canvas para o PDF.");
    context.scale(pixelRatio, pixelRatio);
    context.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function appendCardImages(document: JsPdfDocument, elements: readonly HTMLElement[]) {
  if (elements.length === 0) return;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 10;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  for (const element of elements) {
    const capture = await captureDashboardCard(element);
    const scale = Math.min(availableWidth / capture.width, availableHeight / capture.height);
    const width = capture.width * scale;
    const height = capture.height * scale;
    document.addPage();
    document.addImage(
      capture.dataUrl,
      "PNG",
      (pageWidth - width) / 2,
      (pageHeight - height) / 2,
      width,
      height,
    );
  }
}

export async function downloadDashboardPdf(input: DashboardPdfInput) {
  const JsPdf = await loadJsPdf();
  const document = buildDashboardPdfDocument(JsPdf, input);
  await appendCardImages(document, input.cardElements ?? []);
  const safeName = input.exportContext.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  document.save(`${safeName || "dashboard"}.pdf`);
}
