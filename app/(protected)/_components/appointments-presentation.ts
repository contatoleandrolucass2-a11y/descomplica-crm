"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export const APPOINTMENTS_REFERENCE_WIDTH = 1236;

const overviewMetrics = new Set([
  "appointments.goal",
  "team.productive",
  "brokers.total",
  "managers.total",
  "visits.total",
  "sales.total",
  "conversion.opportunity-appointment",
  "conversion.appointment-visit",
  "conversion.appointment-sale",
  "appointments.rate",
  "appointments.yesterday",
  "appointments.today",
]);

export function isPresentationMetric(metric: string | undefined) {
  return Boolean(metric && !overviewMetrics.has(metric));
}

export function fitPresentationCard(
  card: { width: number; height: number },
  available: { width: number; height: number },
) {
  if (card.width <= 0 || card.height <= 0 || available.width <= 0 || available.height <= 0)
    return 1;
  return Math.min(available.width / card.width, available.height / card.height);
}

export function stepPresentation(
  ids: readonly string[],
  current: string | null,
  direction: "previous" | "next",
) {
  if (ids.length === 0) return null;
  if (current === null && direction === "previous") return ids.at(-1) ?? null;
  const index = current === null ? -1 : ids.indexOf(current);
  const next = direction === "next" ? Math.min(index + 1, ids.length - 1) : index - 1;
  return next < 0 ? null : (ids[next] ?? null);
}

/** Read the overview's visual rows before the guide hides any article. */
export function groupPresentationRows(
  cards: readonly { id: string; top: number; left: number }[],
): string[][] {
  const rows: { top: number; cards: { id: string; left: number }[] }[] = [];
  for (const card of [...cards].sort((a, b) => a.top - b.top || a.left - b.left)) {
    let row = rows.find((candidate) => Math.abs(candidate.top - card.top) <= 2);
    if (!row) {
      row = { top: card.top, cards: [] };
      rows.push(row);
    }
    row.cards.push({ id: card.id, left: card.left });
  }
  return rows.map((row) => row.cards.sort((a, b) => a.left - b.left).map((card) => card.id));
}

function presentationCards(root: HTMLElement | null) {
  return root
    ? [
        ...root.querySelectorAll<HTMLElement>(
          "[data-appointments-canvas] [data-dashboard-card-id]",
        ),
      ].filter((element) => isPresentationMetric(element.dataset.dashboardCardMetric))
    : [];
}

/** Presents the existing React-owned article; no clones, reparenting, or profile writes. */
export function useAppointmentsPresentation({
  enabled,
  root,
  surfaceScale,
}: {
  enabled: boolean;
  root: RefObject<HTMLDivElement | null>;
  surfaceScale: number;
}) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const overviewScroll = useRef(0);
  const overviewRows = useRef<{ ids: string[]; height: number }[]>([]);

  useLayoutEffect(() => {
    const shell = root.current;
    if (!enabled || !shell || activeCardId !== null) return;
    let frame = 0;
    let signature = "";
    let width = shell.clientWidth;
    const alignedGeometry = new Map<HTMLElement, { width: string; height: string }[]>();
    const cards = () => [
      ...shell.querySelectorAll<HTMLElement>("[data-appointments-canvas] [data-dashboard-card-id]"),
    ];
    const baseSignature = () =>
      JSON.stringify(
        cards().map((card) => [
          card.dataset.dashboardCardId,
          card.style.width,
          card.style.height,
          card.style.gridColumn,
          card.style.order,
          card.style.getPropertyValue("--dashboard-card-width"),
        ]),
      );
    const clear = (card: HTMLElement) => {
      delete card.dataset.appointmentsAligned;
      card.style.removeProperty("--appointments-row-width");
      card.style.removeProperty("--appointments-row-height");
    };
    const align = () => {
      const placeholders = shell.querySelectorAll<HTMLElement>(
        '[data-appointments-canvas] [data-dashboard-canvas-grid] > [aria-hidden="true"]',
      );
      // Drag replaces one article. Keep that slot and its siblings stable until commit/cancel.
      if (placeholders.length) {
        for (const placeholder of placeholders) {
          const grid = placeholder.parentElement;
          if (!grid) continue;
          const index = [...grid.children].indexOf(placeholder);
          const geometry = alignedGeometry.get(grid)?.[index];
          if (!geometry) continue;
          placeholder.style.setProperty("--appointments-row-width", geometry.width);
          placeholder.style.setProperty("--appointments-row-height", geometry.height);
          placeholder.dataset.appointmentsAligned = "true";
        }
        signature = baseSignature();
        return;
      }
      const elements = cards();
      // Measure the saved composition, never our own equalized dimensions.
      elements.forEach(clear);
      alignedGeometry.clear();
      const measurements = elements.map((card) => {
        const bounds = card.getBoundingClientRect();
        const explicitHeight = /^\d+(?:\.\d+)?px$/.test(card.style.height)
          ? Number.parseFloat(card.style.height)
          : 0;
        return {
          id: card.dataset.dashboardCardId!,
          top: bounds.top,
          left: bounds.left,
          card,
          height: explicitHeight > 0 ? explicitHeight : card.offsetHeight,
        };
      });
      for (const ids of groupPresentationRows(measurements)) {
        const row = measurements.filter((item) => ids.includes(item.id));
        const grid = row[0]?.card.closest<HTMLElement>("[data-dashboard-canvas-grid]");
        if (!grid) continue;
        const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
        const rowWidth = `calc((100% - ${gap * (row.length - 1)}px) / ${row.length})`;
        const rowHeight = `${Math.max(...row.map((item) => item.height))}px`;
        for (const { card } of row) {
          card.style.setProperty("--appointments-row-width", rowWidth);
          card.style.setProperty("--appointments-row-height", rowHeight);
          card.dataset.appointmentsAligned = "true";
          const index = [...grid.children].indexOf(card);
          const slots = alignedGeometry.get(grid) ?? [];
          slots[index] = { width: rowWidth, height: rowHeight };
          alignedGeometry.set(grid, slots);
        }
      }
      signature = baseSignature();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    };
    const changes = new MutationObserver(() => {
      // React and pointer tilt also write styles; only saved geometry/order matters.
      if (baseSignature() !== signature) schedule();
    });
    changes.observe(shell, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "data-dashboard-card-id"],
    });
    const resize = new ResizeObserver(() => {
      if (shell.clientWidth !== width) {
        width = shell.clientWidth;
        schedule();
      }
    });
    resize.observe(shell);
    align();
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      resize.disconnect();
      cards().forEach(clear);
    };
  }, [enabled, root, activeCardId, surfaceScale]);

  const exit = useCallback(() => {
    setActiveCardId(null);
    overviewRows.current = [];
    setAnnouncement("Visão geral de Agendamentos.");
    requestAnimationFrame(() => window.scrollTo({ top: overviewScroll.current, behavior: "auto" }));
  }, []);

  function guide(direction: "previous" | "next") {
    const cards = presentationCards(root.current);
    if (activeCardId === null) {
      overviewRows.current = groupPresentationRows(
        cards.map((card) => {
          const bounds = card.getBoundingClientRect();
          return { id: card.dataset.dashboardCardId!, top: bounds.top, left: bounds.left };
        }),
      ).map((ids) => ({
        ids,
        height: Math.max(
          ...cards
            .filter((card) => ids.includes(card.dataset.dashboardCardId!))
            .map((card) => card.offsetHeight),
        ),
      }));
    }
    const rows = overviewRows.current;
    const ids = rows.map((row) => row.ids[0]!);
    const next = stepPresentation(ids, activeCardId, direction);
    if (next === null) {
      exit();
      return;
    }
    if (activeCardId === null) overviewScroll.current = window.scrollY;
    const row = rows[ids.indexOf(next)];
    if (!row) return;
    const label = row.ids
      .map(
        (id) =>
          cards
            .find((card) => card.dataset.dashboardCardId === id)
            ?.querySelector("h2, h3")
            ?.textContent?.trim() || "Gráfico",
      )
      .join("; ");
    setAnnouncement(
      `${label}. Linha ${ids.indexOf(next) + 1} de ${ids.length}. Escape volta à visão geral.`,
    );
    setActiveCardId(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    if (!enabled || activeCardId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog owns Escape while open. Its focus trap remains independent.
      if (event.key !== "Escape" || document.querySelector('[role="dialog"], dialog[open]')) return;
      event.preventDefault();
      exit();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, activeCardId, exit]);

  useLayoutEffect(() => {
    const shell = root.current;
    if (!enabled || !shell || activeCardId === null) return;
    let frame = 0;
    let focused = false;
    const decorate = () => {
      const cards = presentationCards(shell);
      const row = overviewRows.current.find((item) => item.ids[0] === activeCardId);
      const active = cards.filter((card) => row?.ids.includes(card.dataset.dashboardCardId!));
      const first = active[0];
      if (!row || !first) {
        setActiveCardId(null);
        return;
      }
      for (const card of cards) {
        if (active.includes(card)) {
          card.dataset.appointmentsPresented = "true";
          if (!card.hasAttribute("tabindex")) {
            card.tabIndex = -1;
            card.dataset.appointmentsTemporaryTabindex = "true";
          }
        } else {
          delete card.dataset.appointmentsPresented;
        }
      }
      const grid = first.closest<HTMLElement>("[data-dashboard-canvas-grid]");
      if (!grid) return;
      for (const card of active) resize.observe(card);
      const bounds = grid.getBoundingClientRect();
      // Includes both the fitted surface and browser/root zoom used by accessibility QA.
      const effectiveScale = grid.offsetWidth > 0 ? bounds.width / grid.offsetWidth : surfaceScale;
      const availableHeight = Math.max(
        1,
        (window.innerHeight - Math.max(0, bounds.top) - 8) / effectiveScale,
      );
      shell.style.setProperty("--appointments-focus-height", `${availableHeight}px`);
      shell.style.setProperty("--appointments-presented-columns", String(active.length));
      shell.style.setProperty(
        "--appointments-presented-height",
        `${Math.min(row.height, availableHeight)}px`,
      );
      shell.style.setProperty("--appointments-focused-zoom", "1");
      if (!focused) {
        first.focus({ preventScroll: true });
        focused = true;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(decorate);
    };
    const changes = new MutationObserver(schedule);
    changes.observe(shell, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(shell);
    decorate();
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      for (const card of shell.querySelectorAll<HTMLElement>(
        "[data-appointments-presented], [data-appointments-temporary-tabindex]",
      )) {
        delete card.dataset.appointmentsPresented;
        if (card.dataset.appointmentsTemporaryTabindex) {
          card.removeAttribute("tabindex");
          delete card.dataset.appointmentsTemporaryTabindex;
        }
      }
      shell.style.removeProperty("--appointments-focus-height");
      shell.style.removeProperty("--appointments-focused-zoom");
      shell.style.removeProperty("--appointments-presented-columns");
      shell.style.removeProperty("--appointments-presented-height");
    };
  }, [enabled, root, activeCardId, surfaceScale]);

  return { activeCardId: enabled ? activeCardId : null, announcement, guide, exit };
}
