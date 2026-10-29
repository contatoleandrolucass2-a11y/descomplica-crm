"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";

import { resizeCardLayout, type DashboardCardLayoutPolicy } from "../layout/limits";
import { packCanvas } from "../layout/pack-canvas";
import { normalizeDashboardCards } from "../state/migrations";
import type { CanvasCommitReason, DashboardCard, DashboardCardSize } from "../types";
import { useElementSize } from "./use-element-size";
import styles from "./dashboard-canvas.module.css";

interface PointerInteraction {
  kind: CanvasCommitReason;
  cardId: string;
  pointerId: number;
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  originalCards: DashboardCard[];
  initialLayout: DashboardCard["layout"];
  floatingRect: Pick<DOMRect, "width" | "height" | "left" | "top">;
  offsetX: number;
  offsetY: number;
  captureTarget: HTMLElement;
}

export type DashboardCanvasRenderer = (card: DashboardCard, size: DashboardCardSize) => ReactNode;
export type DashboardCanvasCommitHandler = (
  cards: DashboardCard[],
  reason: CanvasCommitReason,
) => void;

export interface DashboardCanvasProps {
  cards: readonly DashboardCard[];
  renderCard: DashboardCanvasRenderer;
  onCommit: DashboardCanvasCommitHandler;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  gap?: number;
  layoutPolicy?: DashboardCardLayoutPolicy | undefined;
  cornerResizeHandle?: boolean;
  compactControls?: boolean;
}

function cardName(card: DashboardCard) {
  return card.title?.trim() || card.metric;
}

function reorderCards(cards: readonly DashboardCard[], cardId: string, targetIndex: number) {
  const fromIndex = cards.findIndex((card) => card.id === cardId);
  if (fromIndex < 0) return [...cards];
  const clampedTarget = Math.min(Math.max(targetIndex, 0), cards.length - 1);
  if (fromIndex === clampedTarget) return [...cards];
  const next = [...cards];
  const [active] = next.splice(fromIndex, 1);
  if (!active) return [...cards];
  next.splice(clampedTarget, 0, active);
  return next.map((card, order) => ({
    ...card,
    layout: { ...card.layout, order },
  }));
}

function useFlipLayout(
  elements: React.MutableRefObject<Map<string, HTMLElement>>,
  layoutKey: string,
  disabled: boolean,
) {
  const previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const current = new Map<string, DOMRect>();
    for (const [id, element] of elements.current) current.set(id, element.getBoundingClientRect());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!disabled && !reduceMotion) {
      for (const [id, finalRect] of current) {
        const initialRect = previous.current.get(id);
        const element = elements.current.get(id);
        if (!initialRect || !element || finalRect.width <= 0 || finalRect.height <= 0) continue;
        const deltaX = initialRect.left - finalRect.left;
        const deltaY = initialRect.top - finalRect.top;
        const scaleX = initialRect.width / finalRect.width;
        const scaleY = initialRect.height / finalRect.height;
        if (
          Math.abs(deltaX) < 0.5 &&
          Math.abs(deltaY) < 0.5 &&
          Math.abs(scaleX - 1) < 0.01 &&
          Math.abs(scaleY - 1) < 0.01
        ) {
          continue;
        }
        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})` },
            { transform: "none" },
          ],
          { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    }
    previous.current = current;
  }, [disabled, elements, layoutKey]);
}

function MeasuredCardContent({
  card,
  renderCard,
}: {
  card: DashboardCard;
  renderCard: DashboardCanvasRenderer;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(contentRef);
  return (
    <div ref={contentRef} className={styles.content} data-dashboard-card-content>
      {renderCard(card, size)}
    </div>
  );
}

export function DashboardCanvas({
  cards,
  renderCard,
  onCommit,
  ariaLabel = "Canvas analítico",
  className,
  disabled = false,
  gap = 16,
  layoutPolicy,
  cornerResizeHandle = false,
  compactControls = false,
}: DashboardCanvasProps) {
  const normalizedCards = useMemo(
    () => normalizeDashboardCards(cards, layoutPolicy),
    [cards, layoutPolicy],
  );
  const [previewCards, setPreviewCards] = useState(normalizedCards);
  const [interaction, setInteraction] = useState<PointerInteraction | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const previewRef = useRef(previewCards);
  const interactionRef = useRef(interaction);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardElements = useRef(new Map<string, HTMLElement>());
  const frame = useRef(0);
  const pendingPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    previewRef.current = previewCards;
  }, [previewCards]);

  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  useEffect(() => {
    if (!interactionRef.current) setPreviewCards(normalizedCards);
  }, [normalizedCards]);

  const packed = packCanvas(previewCards, interaction?.cardId, layoutPolicy);
  const layoutKey = packed
    .map(
      ({ card, row, column }) =>
        `${card.id}:${row}:${column}:${card.layout.columnSpan}:${card.layout.height}:${card.layout.width ?? "auto"}`,
    )
    .join("|");
  useFlipLayout(cardElements, layoutKey, interaction !== null);

  function cancelInteraction(message = "Alteração cancelada.") {
    const active = interactionRef.current;
    if (!active) return;
    if (active.captureTarget.hasPointerCapture(active.pointerId)) {
      active.captureTarget.releasePointerCapture(active.pointerId);
    }
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    pendingPoint.current = null;
    setPreviewCards(active.originalCards);
    previewRef.current = active.originalCards;
    setInteraction(null);
    interactionRef.current = null;
    setAnnouncement(message);
  }

  useEffect(() => {
    if (!interaction) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelInteraction();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function targetIndexAt(clientX: number, clientY: number, cardId: string) {
    const candidates = previewRef.current.filter((card) => card.id !== cardId);
    if (candidates.length === 0) return 0;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidates.length; index += 1) {
      const element = cardElements.current.get(candidates[index]!.id);
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      const distance = Math.hypot(
        clientX - (bounds.left + bounds.width / 2),
        clientY - (bounds.top + bounds.height / 2),
      );
      if (distance < closestDistance) {
        closest = index;
        closestDistance = distance;
      }
    }
    const element = cardElements.current.get(candidates[closest]!.id);
    const bounds = element?.getBoundingClientRect();
    const after = bounds
      ? clientY > bounds.bottom ||
        (clientY >= bounds.top &&
          clientY <= bounds.bottom &&
          clientX > bounds.left + bounds.width / 2)
      : false;
    return Math.min(closest + (after ? 1 : 0), previewRef.current.length - 1);
  }

  function applyPendingPoint() {
    frame.current = 0;
    const active = interactionRef.current;
    const point = pendingPoint.current;
    if (!active || !point) return;
    const nextInteraction = { ...active, clientX: point.x, clientY: point.y };
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
    if (active.kind === "drag") {
      const next = reorderCards(
        previewRef.current,
        active.cardId,
        targetIndexAt(point.x, point.y, active.cardId),
      );
      previewRef.current = next;
      setPreviewCards(next);
      return;
    }
    const card = previewRef.current.find(({ id }) => id === active.cardId);
    const containerWidth = gridRef.current?.clientWidth ?? 0;
    if (!card) return;
    const nextLayout = resizeCardLayout({
      type: card.type,
      initial: active.initialLayout,
      deltaX: point.x - active.originX,
      deltaY: point.y - active.originY,
      containerWidth,
      gap,
      policy: layoutPolicy,
    });
    const next = previewRef.current.map((entry) =>
      entry.id === active.cardId ? { ...entry, layout: nextLayout } : entry,
    );
    previewRef.current = next;
    setPreviewCards(next);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactionRef.current || event.pointerId !== interactionRef.current.pointerId) return;
    pendingPoint.current = { x: event.clientX, y: event.clientY };
    if (!frame.current) frame.current = requestAnimationFrame(applyPendingPoint);
  }

  function finishInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const active = interactionRef.current;
    if (!active || event.pointerId !== active.pointerId) return;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      applyPendingPoint();
    }
    if (active.captureTarget.hasPointerCapture(active.pointerId)) {
      active.captureTarget.releasePointerCapture(active.pointerId);
    }
    const next = normalizeDashboardCards(previewRef.current, layoutPolicy);
    setPreviewCards(next);
    previewRef.current = next;
    setInteraction(null);
    interactionRef.current = null;
    setAnnouncement(
      `${cardName(next.find(({ id }) => id === active.cardId) ?? active.originalCards[0]!)}: ${active.kind === "drag" ? "posição alterada" : "tamanho alterado"}.`,
    );
    onCommit(next, active.kind);
  }

  function beginInteraction(
    event: ReactPointerEvent<HTMLButtonElement>,
    card: DashboardCard,
    kind: CanvasCommitReason,
  ) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const cardElement = cardElements.current.get(card.id);
    const captureTarget = gridRef.current;
    if (!cardElement || !captureTarget) return;
    const bounds = cardElement.getBoundingClientRect();
    captureTarget.setPointerCapture(event.pointerId);
    const nextInteraction: PointerInteraction = {
      kind,
      cardId: card.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      originalCards: previewRef.current,
      initialLayout: layoutPolicy?.freeResize
        ? { ...card.layout, width: Math.round(bounds.width) }
        : card.layout,
      floatingRect: bounds,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      captureTarget,
    };
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  }

  function keyboardMove(event: ReactKeyboardEvent<HTMLButtonElement>, card: DashboardCard) {
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0;
    if (!direction || disabled) return;
    event.preventDefault();
    const currentIndex = previewRef.current.findIndex(({ id }) => id === card.id);
    const next = normalizeDashboardCards(
      reorderCards(previewRef.current, card.id, currentIndex + direction),
      layoutPolicy,
    );
    setPreviewCards(next);
    onCommit(next, "drag");
    setAnnouncement(
      `${cardName(card)}: posição ${next.findIndex(({ id }) => id === card.id) + 1} de ${next.length}.`,
    );
  }

  function keyboardResize(event: ReactKeyboardEvent<HTMLButtonElement>, card: DashboardCard) {
    if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
      return;
    event.preventDefault();
    const horizontal = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const step = layoutPolicy?.freeResize ? (event.shiftKey ? 10 : 1) : 24;
    const vertical = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    const nextLayout = resizeCardLayout({
      type: card.type,
      initial: layoutPolicy?.freeResize
        ? {
            ...card.layout,
            width: Math.round(
              cardElements.current.get(card.id)?.getBoundingClientRect().width ?? 128,
            ),
          }
        : card.layout,
      deltaX:
        horizontal * (layoutPolicy?.freeResize ? step : (gridRef.current?.clientWidth ?? 12) / 12),
      deltaY: vertical,
      containerWidth: gridRef.current?.clientWidth ?? 12,
      gap,
      policy: layoutPolicy,
    });
    const next = normalizeDashboardCards(
      previewRef.current.map((entry) =>
        entry.id === card.id ? { ...entry, layout: nextLayout } : entry,
      ),
      layoutPolicy,
    );
    setPreviewCards(next);
    onCommit(next, "resize");
    setAnnouncement(
      `${cardName(card)}: ${nextLayout.width !== undefined ? `${nextLayout.width} pixels de largura` : `${nextLayout.columnSpan} colunas`}, ${nextLayout.height} pixels de altura.`,
    );
  }

  const floatingCard = interaction
    ? (previewCards.find((card) => card.id === interaction.cardId) ?? null)
    : null;
  const floatingStyle: CSSProperties | undefined = interaction
    ? {
        left: interaction.clientX - interaction.offsetX,
        top: interaction.clientY - interaction.offsetY,
        width: interaction.floatingRect.width,
        height:
          interaction.kind === "resize"
            ? floatingCard?.layout.height
            : interaction.floatingRect.height,
      }
    : undefined;

  function cardStyle(card: DashboardCard, columnSpan: number): CSSProperties {
    return {
      gridColumn: `span ${columnSpan}`,
      height: card.layout.height,
      ...(layoutPolicy?.freeResize
        ? {
            width:
              card.layout.width ??
              `calc(${(columnSpan * 100) / 12}% - ${(gap * (12 - columnSpan)) / 12}px)`,
            maxWidth: "100%",
          }
        : {}),
    };
  }

  return (
    <section
      className={[styles.shell, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-readonly={disabled ? "true" : undefined}
      data-corner-resize={cornerResizeHandle ? "true" : undefined}
      data-compact-controls={compactControls ? "true" : undefined}
      data-free-resize={layoutPolicy?.freeResize ? "true" : undefined}
    >
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ gap }}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={() => cancelInteraction("Alteração cancelada pelo dispositivo.")}
      >
        {packed.map(({ card, columnSpan, isActive }) =>
          isActive && interaction?.kind === "drag" ? (
            <div
              key={card.id}
              className={styles.placeholder}
              style={cardStyle(card, columnSpan)}
              data-fixed-width={card.layout.width !== undefined ? "true" : undefined}
              aria-hidden="true"
            />
          ) : (
            <article
              key={card.id}
              ref={(element) => {
                if (element) cardElements.current.set(card.id, element);
                else cardElements.current.delete(card.id);
              }}
              className={[styles.card, isActive ? styles.active : ""].filter(Boolean).join(" ")}
              style={cardStyle(card, columnSpan)}
              data-fixed-width={card.layout.width !== undefined ? "true" : undefined}
              data-dashboard-card-id={card.id}
            >
              <header className={styles.header}>
                <button
                  type="button"
                  className={styles.dragHandle}
                  data-dashboard-export-ignore
                  aria-label={`Mover ${cardName(card)}`}
                  disabled={disabled}
                  onPointerDown={(event) => beginInteraction(event, card, "drag")}
                  onKeyDown={(event) => keyboardMove(event, card)}
                >
                  <GripVertical size={18} aria-hidden="true" />
                </button>
                {!compactControls ? (
                  <strong className={styles.title} title={cardName(card)}>
                    {cardName(card)}
                  </strong>
                ) : null}
              </header>
              <MeasuredCardContent card={card} renderCard={renderCard} />
              <button
                type="button"
                className={styles.resizeHandle}
                data-dashboard-export-ignore
                aria-label={`Redimensionar ${cardName(card)}`}
                disabled={disabled}
                onPointerDown={(event) => beginInteraction(event, card, "resize")}
                onKeyDown={(event) => keyboardResize(event, card)}
              />
            </article>
          ),
        )}
      </div>
      {interaction && floatingCard && interaction.kind === "drag" ? (
        <article
          className={[styles.card, styles.floating].join(" ")}
          style={floatingStyle}
          aria-hidden="true"
        >
          <header className={styles.header}>
            <GripVertical size={18} aria-hidden="true" />
            {!compactControls ? (
              <strong className={styles.title}>{cardName(floatingCard)}</strong>
            ) : null}
          </header>
          <MeasuredCardContent card={floatingCard} renderCard={renderCard} />
        </article>
      ) : null}
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
