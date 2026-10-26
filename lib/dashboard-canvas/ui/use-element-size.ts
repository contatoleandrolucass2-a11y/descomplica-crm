"use client";

import { useEffect, useState, type RefObject } from "react";

import type { DashboardCardSize } from "../types";

const EMPTY_SIZE: DashboardCardSize = { width: 0, height: 0 };

export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<DashboardCardSize>(EMPTY_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bounds = element.getBoundingClientRect();
      setSize((current) => {
        const next = { width: Math.max(0, bounds.width), height: Math.max(0, bounds.height) };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
