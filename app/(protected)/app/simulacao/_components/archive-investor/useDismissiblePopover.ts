"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const OPEN_EVENT = "descomplica:popover-open";

export function useDismissiblePopover() {
  const instanceId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpenState] = useState(false);

  const setOpen = useCallback((nextOpen: boolean) => {
    setOpenState(nextOpen);
    if (nextOpen) {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));
    }
  }, [instanceId]);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenState(false);
    };
    const closeFromFocus = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenState(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenState(false);
      triggerRef.current?.focus();
    };
    const closeOtherPopover = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) setOpenState(false);
    };

    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("focusin", closeFromFocus, true);
    document.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener(OPEN_EVENT, closeOtherPopover);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("focusin", closeFromFocus, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener(OPEN_EVENT, closeOtherPopover);
    };
  }, [instanceId, open]);

  return [rootRef, triggerRef, open, setOpen, toggle] as const;
}
