"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export const COOKIE_PREFERENCES_OPEN_EVENT = "descomplica:open-cookie-preferences";

type CookiePreferencesTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
};

export function CookiePreferencesTrigger({
  children,
  type = "button",
  ...props
}: CookiePreferencesTriggerProps) {
  return (
    <button
      {...props}
      type={type}
      aria-controls="cookie-consent-panel"
      data-cookie-preferences-trigger
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          window.dispatchEvent(
            new CustomEvent(COOKIE_PREFERENCES_OPEN_EVENT, {
              detail: { opener: event.currentTarget },
            }),
          );
        }
      }}
    >
      {children}
    </button>
  );
}
