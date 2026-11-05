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
  const index = current === null ? -1 : ids.indexOf(current);
  const next = direction === "next" ? Math.min(index + 1, ids.length - 1) : index - 1;
  return next < 0 ? null : (ids[next] ?? null);
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

  const exit = useCallback(() => {
    setActiveCardId(null);
    setAnnouncement("Visão geral de Agendamentos.");
    requestAnimationFrame(() => window.scrollTo({ top: overviewScroll.current, behavior: "auto" }));
  }, []);

  function guide(direction: "previous" | "next") {
    const cards = presentationCards(root.current);
    const ids = cards.map((card) => card.dataset.dashboardCardId!);
    const next = stepPresentation(ids, activeCardId, direction);
    if (next === null) {
      exit();
      return;
    }
    if (activeCardId === null) overviewScroll.current = window.scrollY;
    const element = cards[ids.indexOf(next)];
    const label = element?.querySelector("h2, h3")?.textContent?.trim() || "Gráfico";
    setAnnouncement(
      `${label}. Gráfico ${ids.indexOf(next) + 1} de ${ids.length}. Escape volta à visão geral.`,
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
      const active = cards.find((card) => card.dataset.dashboardCardId === activeCardId);
      if (!active) {
        setActiveCardId(null);
        return;
      }
      for (const card of cards) {
        if (card === active) {
          card.dataset.appointmentsPresented = "true";
          if (!card.hasAttribute("tabindex")) {
            card.tabIndex = -1;
            card.dataset.appointmentsTemporaryTabindex = "true";
          }
        } else {
          delete card.dataset.appointmentsPresented;
        }
      }
      const grid = active.closest<HTMLElement>("[data-dashboard-canvas-grid]");
      if (!grid) return;
      resize.observe(active);
      resize.observe(grid);
      const bounds = grid.getBoundingClientRect();
      // Includes both the fitted surface and browser/root zoom used by accessibility QA.
      const effectiveScale = grid.offsetWidth > 0 ? bounds.width / grid.offsetWidth : surfaceScale;
      const availableHeight = Math.max(
        1,
        (window.innerHeight - Math.max(0, bounds.top) - 8) / effectiveScale,
      );
      const availableWidth = Math.max(1, grid.clientWidth);
      const fit = fitPresentationCard(
        { width: active.offsetWidth, height: active.offsetHeight },
        { width: availableWidth, height: availableHeight },
      );
      shell.style.setProperty("--appointments-focus-height", `${availableHeight}px`);
      shell.style.setProperty("--appointments-focused-zoom", String(fit));
      if (!focused) {
        active.focus({ preventScroll: true });
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
    };
  }, [enabled, root, activeCardId, surfaceScale]);

  return { activeCardId: enabled ? activeCardId : null, announcement, guide, exit };
}
