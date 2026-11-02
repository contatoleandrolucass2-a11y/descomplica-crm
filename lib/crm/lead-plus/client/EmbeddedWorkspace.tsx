"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AuthProvider } from "./Auth";
import WorkspaceApp from "./WorkspaceApp";

/** Shadow DOM confines the complete LEAD+ stylesheet to its own workspace. */
export default function EmbeddedWorkspace({ initialScreen = "Leads" }: { initialScreen?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState("light");
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const shadow = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    const mirror = () => {
      element.dataset.theme = document.documentElement.dataset.theme || "light";
      setTheme(element.dataset.theme);
      element.style.colorScheme = element.dataset.theme === "dark" ? "dark" : "light";
    };
    mirror();
    const observer = new MutationObserver(mirror);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    setRoot(shadow);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={host} data-lead-plus-host>
      {root ? (
        createPortal(
          <>
            <link rel="stylesheet" href="/lead-plus/workspace.css" />
            <link rel="stylesheet" href="/lead-plus/whatsapp-central.css" />
            <div data-theme={theme}>
              <AuthProvider>
                <WorkspaceApp initialScreen={initialScreen} />
              </AuthProvider>
            </div>
          </>,
          root,
        )
      ) : (
        <p role="status">Abrindo DESCOMPLICA LEAD…</p>
      )}
    </div>
  );
}
