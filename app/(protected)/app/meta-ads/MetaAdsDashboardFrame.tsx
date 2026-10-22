"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./MetaAdsDashboardFrame.module.css";

const MINIMUM_FRAME_HEIGHT = 760;

export function getVisibleFrameViewport(
  frame: Pick<DOMRect, "height" | "top">,
  viewportTop: number,
  viewportBottom: number,
) {
  const top = Math.min(Math.max(viewportTop - frame.top, 0), frame.height);
  const bottom = Math.min(Math.max(viewportBottom - frame.top, 0), frame.height);

  return { height: Math.max(bottom - top, 0), top };
}

export type MetaAdsDashboardView = "overview" | "campaigns" | "accounts" | "reports";

export function MetaAdsDashboardFrame({
  document: dashboardDocument,
  initialView,
}: {
  document: string;
  initialView: MetaAdsDashboardView;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MINIMUM_FRAME_HEIGHT);
  const frameDocument = dashboardDocument.replace(
    "<html ",
    `<html data-crm-view="${initialView}" `,
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const iframe: HTMLIFrameElement = frame;

    let observer: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let viewportFrame = 0;

    function syncVisibleViewport() {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) return;

      const visualViewport = window.visualViewport;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
      const topbarBottom =
        document.querySelector<HTMLElement>("[data-protected-topbar]")?.getBoundingClientRect()
          .bottom ?? viewportTop;
      const viewport = getVisibleFrameViewport(
        iframe.getBoundingClientRect(),
        Math.max(viewportTop, topbarBottom),
        viewportBottom,
      );
      const root = frameDocument.documentElement;
      if (!root) return;
      root.style.setProperty("--crm-visible-frame-top", `${viewport.top}px`);
      root.style.setProperty("--crm-visible-frame-height", `${Math.max(viewport.height, 1)}px`);
    }

    function scheduleViewportSync() {
      cancelAnimationFrame(viewportFrame);
      viewportFrame = requestAnimationFrame(syncVisibleViewport);
    }

    function syncTheme() {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) return;
      const crmTheme = document.documentElement.dataset.theme;
      frameDocument.documentElement.dataset.theme =
        crmTheme === "dark" ? "dark" : crmTheme === "balanced" ? "medium" : "light";
    }

    function measure() {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) return;
      const nextHeight = Math.max(
        MINIMUM_FRAME_HEIGHT,
        frameDocument.documentElement.scrollHeight,
        frameDocument.body?.scrollHeight ?? 0,
      );
      iframe.style.height = `${nextHeight}px`;
      setHeight(nextHeight);
      scheduleViewportSync();
    }

    function observeDocument() {
      observer?.disconnect();
      const frameDocument = iframe.contentDocument;
      if (!frameDocument?.documentElement) return;
      observer = new ResizeObserver(measure);
      observer.observe(frameDocument.documentElement);
      if (frameDocument.body) observer.observe(frameDocument.body);
      syncTheme();
      measure();
      syncVisibleViewport();
    }

    iframe.addEventListener("load", observeDocument);
    document.addEventListener("scroll", scheduleViewportSync, true);
    window.addEventListener("resize", scheduleViewportSync);
    window.visualViewport?.addEventListener("resize", scheduleViewportSync);
    window.visualViewport?.addEventListener("scroll", scheduleViewportSync);
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    if (iframe.contentDocument?.readyState === "complete") observeDocument();

    return () => {
      iframe.removeEventListener("load", observeDocument);
      document.removeEventListener("scroll", scheduleViewportSync, true);
      window.removeEventListener("resize", scheduleViewportSync);
      window.visualViewport?.removeEventListener("resize", scheduleViewportSync);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportSync);
      cancelAnimationFrame(viewportFrame);
      observer?.disconnect();
      themeObserver?.disconnect();
    };
  }, [dashboardDocument, initialView]);

  return (
    <section className={styles.frameShell} aria-label="Dashboard Meta Ads">
      <iframe
        key={initialView}
        ref={frameRef}
        className={styles.frame}
        srcDoc={frameDocument}
        style={{ height }}
        title="Descomplica Ads — desempenho de campanhas Meta"
        sandbox="allow-downloads allow-forms allow-modals allow-same-origin allow-scripts"
      />
    </section>
  );
}
