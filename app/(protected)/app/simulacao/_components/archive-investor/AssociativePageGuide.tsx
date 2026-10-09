"use client";

import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { ASSOCIATIVE_PAGE_GUIDE_STEPS } from "./associative-page-guide-content";

type Rect = { top: number; left: number; width: number; height: number };

function visibleTarget(root: HTMLElement, selector: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  });
}

export function AssociativePageGuide({
  rootRef,
  onStart,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  onStart: () => void;
}) {
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [atLeft, setAtLeft] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const step = ASSOCIATIVE_PAGE_GUIDE_STEPS[index] ?? ASSOCIATIVE_PAGE_GUIDE_STEPS[0];

  function close() {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    root.classList.add("associative-guide-open");
    return () => {
      root.classList.remove("associative-guide-open");
      root.style.removeProperty("--associative-guide-space");
    };
  }, [open, rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;

    let target: HTMLElement | undefined;
    let frame = 0;
    let disposed = false;
    const resizeObserver = new ResizeObserver(schedule);

    function measure() {
      frame = 0;
      if (disposed || !root) return;
      // Leave scroll space so the floating guide never traps the last page controls.
      root.style.setProperty(
        "--associative-guide-space",
        `${Math.ceil((panel.current?.getBoundingClientRect().height ?? 0) + 32)}px`,
      );
      const exact = visibleTarget(root, step.selector);
      const next =
        exact ??
        (step.fallback ? visibleTarget(root, step.fallback) : undefined) ??
        visibleTarget(root, '[data-tour="proposal"]') ??
        visibleTarget(root, ".investor-stock-panel");
      setMissing(!exact);
      if (target !== next) {
        if (target) {
          target.classList.remove("associative-guide-active-target");
          resizeObserver.unobserve(target);
        }
        target = next;
        if (target) {
          target.classList.add("associative-guide-active-target");
          resizeObserver.observe(target);
          const scroller = target.closest<HTMLElement>(".investor-stock-results");
          const scrollLeft = scroller?.scrollLeft;
          target.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
          if (scroller && scrollLeft !== undefined) scroller.scrollLeft = scrollLeft;
        }
      }
      if (!target) {
        setHighlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const topbar = document
        .querySelector<HTMLElement>("[data-protected-topbar]")
        ?.getBoundingClientRect();
      const safeTop = Math.max(offsetTop + 8, (topbar?.bottom ?? 0) + 8);
      const panelTop = panel.current?.getBoundingClientRect().top ?? height + offsetTop;
      const left = Math.max(offsetLeft + 6, rect.left - 4);
      const top = Math.max(safeTop, rect.top - 4);
      const right = Math.min(offsetLeft + width - 6, rect.right + 4);
      const bottom = Math.min(
        offsetTop + height - 8,
        rect.bottom + 4,
        width <= 760 ? panelTop - 8 : offsetTop + height - 8,
      );
      setAtLeft(width > 760 && rect.width < width - 400 && rect.left + rect.width / 2 > width / 2);
      setHighlight(
        right > left && bottom > top
          ? { left, top, width: right - left, height: bottom - top }
          : null,
      );
    }

    function schedule() {
      if (!frame && !disposed) frame = window.requestAnimationFrame(measure);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || root?.querySelector("dialog[open]"))
        return;
      if (event.target instanceof Element && event.target.closest("select,[aria-haspopup]")) return;
      event.preventDefault();
      setOpen(false);
      launcher.current?.focus({ preventScroll: true });
    }

    const mutations = new MutationObserver(schedule);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "aria-busy"],
    });
    if (panel.current) resizeObserver.observe(panel.current);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.addEventListener("keydown", onKeyDown);
    panel.current?.focus({ preventScroll: true });
    schedule();
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      target?.classList.remove("associative-guide-active-target");
      resizeObserver.disconnect();
      mutations.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, index, rootRef, step]);

  return (
    <>
      <div className="associative-page-guide-launcher">
        <button
          ref={launcher}
          type="button"
          className="investor-guided-start"
          aria-haspopup="dialog"
          aria-controls="associative-page-guide"
          aria-expanded={open}
          onClick={() => {
            onStart();
            setPortalRoot(rootRef.current);
            setIndex(0);
            setHighlight(null);
            setOpen(true);
          }}
        >
          Guia passo a passo
        </button>
      </div>
      {open && portalRoot
        ? createPortal(
            <>
              {highlight ? (
                <div
                  className="associative-page-guide-spotlight"
                  aria-hidden="true"
                  style={highlight}
                />
              ) : null}
              <aside
                ref={panel}
                id="associative-page-guide"
                className={["associative-page-guide", atLeft ? "at-left" : ""].join(" ")}
                role="dialog"
                aria-modal="false"
                aria-label="Guia passo a passo da página"
                aria-describedby="associative-page-guide-description"
                tabIndex={-1}
                data-step-id={step.id}
              >
                <header>
                  <span>
                    Passo {index + 1} de {ASSOCIATIVE_PAGE_GUIDE_STEPS.length}
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Fechar guia"
                    title="Fechar guia"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>
                <div
                  className="associative-page-guide-progress"
                  role="progressbar"
                  aria-label="Progresso do guia da página"
                  aria-valuemin={1}
                  aria-valuemax={ASSOCIATIVE_PAGE_GUIDE_STEPS.length}
                  aria-valuenow={index + 1}
                >
                  <span
                    style={{
                      width: `${((index + 1) / ASSOCIATIVE_PAGE_GUIDE_STEPS.length) * 100}%`,
                    }}
                  />
                </div>
                <div
                  className="associative-page-guide-copy"
                  role="region"
                  aria-labelledby="associative-page-guide-title"
                  tabIndex={0}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <h2 id="associative-page-guide-title">{step.title}</h2>
                  <p id="associative-page-guide-description">{step.description}</p>
                  {missing ? (
                    <p className="associative-page-guide-unavailable">
                      {step.unavailable ??
                        "Esta área aparece depois de selecionar a unidade e completar as etapas anteriores. Você pode continuar a apresentação sem preencher nada."}
                    </p>
                  ) : null}
                </div>
                <footer>
                  <button
                    type="button"
                    onClick={() => setIndex((current) => Math.max(0, current - 1))}
                    disabled={index === 0}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={
                      index === ASSOCIATIVE_PAGE_GUIDE_STEPS.length - 1
                        ? close
                        : () =>
                            setIndex((current) =>
                              Math.min(ASSOCIATIVE_PAGE_GUIDE_STEPS.length - 1, current + 1),
                            )
                    }
                  >
                    {index === ASSOCIATIVE_PAGE_GUIDE_STEPS.length - 1 ? (
                      <>
                        Concluir guia
                        <Check size={16} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Próximo
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </footer>
              </aside>
            </>,
            portalRoot,
          )
        : null}
    </>
  );
}
