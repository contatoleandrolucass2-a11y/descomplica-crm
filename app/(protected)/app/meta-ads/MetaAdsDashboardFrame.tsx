"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./MetaAdsDashboardFrame.module.css";

const MINIMUM_FRAME_HEIGHT = 760;

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

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const iframe: HTMLIFrameElement = frame;

    let observer: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;

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
      setHeight(
        Math.max(
          MINIMUM_FRAME_HEIGHT,
          frameDocument.documentElement.scrollHeight,
          frameDocument.body?.scrollHeight ?? 0,
        ),
      );
    }

    function observeDocument() {
      observer?.disconnect();
      const frameDocument = iframe.contentDocument;
      if (!frameDocument?.documentElement) return;
      observer = new ResizeObserver(measure);
      observer.observe(frameDocument.documentElement);
      if (frameDocument.body) observer.observe(frameDocument.body);
      if (iframe.contentWindow?.location.hash !== `#${initialView}`) {
        iframe.contentWindow?.location.replace(`#${initialView}`);
      }
      syncTheme();
      measure();
    }

    iframe.addEventListener("load", observeDocument);
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    if (iframe.contentDocument?.readyState === "complete") observeDocument();

    return () => {
      iframe.removeEventListener("load", observeDocument);
      observer?.disconnect();
      themeObserver?.disconnect();
    };
  }, [dashboardDocument, initialView]);

  return (
    <section className={styles.frameShell} aria-label="Dashboard Meta Ads">
      <iframe
        ref={frameRef}
        className={styles.frame}
        srcDoc={dashboardDocument}
        style={{ height }}
        title="Descomplica Ads — desempenho de campanhas Meta"
        sandbox="allow-downloads allow-forms allow-modals allow-same-origin allow-scripts"
      />
    </section>
  );
}
