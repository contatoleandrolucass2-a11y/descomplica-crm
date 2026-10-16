"use client";

import { LoaderCircle, Monitor, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./ConnectedSystemsPanel.module.css";
import { startConsoleSession, type ConsoleProvider, type ConsoleState } from "./console-session";

const LABELS: Record<ConsoleState, string> = {
  loading: "Conectando ao console…",
  connected: "Console conectado",
  disconnected: "Console desconectado",
  expired: "Acesso ao console expirado",
  error: "Não foi possível conectar ao console",
};

export function SalesforceConsoleDialog({
  onClose,
  provider = "salesforce",
}: {
  onClose: (credentialsFailed?: boolean) => void;
  provider?: ConsoleProvider;
}) {
  const titleId = `${provider}-console-title`;
  const noteId = `${provider}-console-note`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();

    // Capture before noVNC's keyboard handler so local close/focus always remain reachable.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key === "Tab" && dialog) {
        // Tab navigates the remote login; Shift+Tab returns to the local close control.
        if (document.activeElement?.tagName === "CANVAS" && !event.shiftKey) return;
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), canvas[tabindex]"),
        ];
        if (!controls.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = controls.indexOf(document.activeElement as HTMLElement);
        const next = (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.consoleDialog}
      aria-labelledby={titleId}
      aria-describedby={noteId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles.consoleHeader}>
        <h2 id={titleId}>
          <Monitor size={18} aria-hidden="true" />
          {provider === "meta-ads" ? "Meta Ads · Facebook Ads" : "Salesforce"}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className={styles.iconButton}
          aria-label="Fechar console"
          title="Fechar console"
          onClick={() => onClose()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <ConsoleViewport
        key={`${provider}-${attempt}`}
        provider={provider}
        onClose={onClose}
        onRetry={() => {
          closeRef.current?.focus();
          setAttempt((value) => value + 1);
        }}
      />
      <footer className={styles.consoleFooter} id={noteId}>
        Acesso por até 10 minutos. Ao fechar, a sessão do navegador na VPS permanece aberta.
      </footer>
    </dialog>
  );
}

function ConsoleViewport({
  onClose,
  onRetry,
  provider,
}: {
  onClose: (credentialsFailed?: boolean) => void;
  onRetry: () => void;
  provider: ConsoleProvider;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ConsoleState>("loading");
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    return startConsoleSession(target, setState, () => onClose(true), provider);
  }, [onClose, provider]);

  return (
    <>
      <div className={styles.consoleStatus} role="status" aria-live="polite">
        {state === "loading" ? (
          <LoaderCircle size={16} className={styles.spinning} aria-hidden="true" />
        ) : null}
        <span>{LABELS[state]}</span>
        {state !== "connected" && state !== "loading" ? (
          <button type="button" className={styles.button} onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" /> Tentar novamente
          </button>
        ) : null}
      </div>
      <div className={styles.consoleScreen} aria-busy={state === "loading"}>
        <div
          ref={targetRef}
          className={styles.consoleViewport}
          data-salesforce-console-screen={provider === "salesforce" ? true : undefined}
          data-meta-ads-console-screen={provider === "meta-ads" ? true : undefined}
        />
      </div>
    </>
  );
}
