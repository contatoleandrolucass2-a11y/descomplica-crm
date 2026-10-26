"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./MetaAdsDashboardFrame.module.css";

const MINIMUM_FRAME_HEIGHT = 760;
const OPEN_ALERTS_EVENT = "descomplica:meta-ads-open-alerts";
const OPEN_ALERTS_AFTER_NAVIGATION_KEY = "descomplica-meta-ads-open-alerts";

export function getVisibleFrameViewport(
  frame: Pick<DOMRect, "height" | "top">,
  viewportTop: number,
  viewportBottom: number,
) {
  const top = Math.min(Math.max(viewportTop - frame.top, 0), frame.height);
  const bottom = Math.min(Math.max(viewportBottom - frame.top, 0), frame.height);

  return { height: Math.max(bottom - top, 0), top };
}

export type MetaAdsDashboardView =
  | "overview"
  | "campaigns"
  | "accounts"
  | "reports"
  | "map"
  | "settings";

export function MetaAdsDashboardFrame({
  document: dashboardDocument,
  initialView,
  storageScope = "isolated-preview",
}: {
  document: string;
  initialView: MetaAdsDashboardView;
  storageScope?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MINIMUM_FRAME_HEIGHT);
  const frameDocument = dashboardDocument.replace(
    "<html ",
    `<html data-crm-view="${initialView}" data-storage-scope="${encodeURIComponent(storageScope)}" `,
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

    function handleFrameMessage(event: MessageEvent) {
      if (
        event.source !== iframe.contentWindow ||
        event.data?.type !== "descomplica:meta-ads-modal-open"
      ) {
        return;
      }
      syncVisibleViewport();
    }

    function openAlerts() {
      iframe.contentWindow?.postMessage({ type: OPEN_ALERTS_EVENT }, "*");
    }

    function openRequestedAlerts() {
      try {
        if (window.sessionStorage.getItem(OPEN_ALERTS_AFTER_NAVIGATION_KEY) !== "1") return;
        window.sessionStorage.removeItem(OPEN_ALERTS_AFTER_NAVIGATION_KEY);
      } catch {
        return;
      }
      openAlerts();
    }

    function syncTheme() {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) return;
      const crmTheme = document.documentElement.dataset.theme;
      frameDocument.documentElement.dataset.theme =
        crmTheme === "dark" ? "dark" : crmTheme === "balanced" ? "medium" : "light";
      if (frameDocument.body)
        frameDocument.body.dataset.theme = frameDocument.documentElement.dataset.theme;
    }

    function measure() {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) return;
      const nextHeight = Math.max(
        MINIMUM_FRAME_HEIGHT,
        Math.ceil(frameDocument.getElementById("main")?.getBoundingClientRect().height ?? 0),
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
      openRequestedAlerts();
    }

    iframe.addEventListener("load", observeDocument);
    document.addEventListener("scroll", scheduleViewportSync, true);
    window.addEventListener("resize", scheduleViewportSync);
    window.addEventListener("message", handleFrameMessage);
    window.addEventListener(OPEN_ALERTS_EVENT, openAlerts);
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
      window.removeEventListener("message", handleFrameMessage);
      window.removeEventListener(OPEN_ALERTS_EVENT, openAlerts);
      window.visualViewport?.removeEventListener("resize", scheduleViewportSync);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportSync);
      cancelAnimationFrame(viewportFrame);
      observer?.disconnect();
      themeObserver?.disconnect();
    };
  }, [dashboardDocument, initialView, storageScope]);

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
        allowFullScreen
      />
    </section>
  );
}
