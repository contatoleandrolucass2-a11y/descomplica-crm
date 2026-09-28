"use client";

import { BookOpen, CircleHelp, FileText, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./AssociativeLearningManual.module.css";

const tabs = [
  { key: "policy", label: "Política", icon: FileText },
  { key: "faq", label: "Perguntas", icon: CircleHelp },
] as const;
type TabKey = (typeof tabs)[number]["key"];
const panelId = (key: TabKey) => `investor-associative-learning-${key}`;
const tabFromHash = () => tabs.find(({ key }) => window.location.hash === `#${panelId(key)}`)?.key;

export function AssociativeLearningManual({
  policy,
  questions,
}: {
  policy: ReactNode;
  questions: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const buttons = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("policy");

  useEffect(() => {
    const openFromHash = () => {
      const key = tabFromHash();
      if (!key || !dialog.current) return;
      setActiveTab(key);
      if (!dialog.current.open) dialog.current.showModal();
      buttons.current[key]?.focus({ preventScroll: true });
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function selectTab(key: TabKey) {
    setActiveTab(key);
    window.history.replaceState(window.history.state, "", `#${panelId(key)}`);
    buttons.current[key]?.focus({ preventScroll: true });
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: TabKey) {
    const next =
      event.key === "Home"
        ? "policy"
        : event.key === "End"
          ? "faq"
          : event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? key === "policy"
              ? "faq"
              : "policy"
            : null;
    if (!next) return;
    event.preventDefault();
    selectTab(next);
  }

  function onClose() {
    if (tabFromHash())
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <section className="investor-learning-manual" aria-label="Manual da Associativo">
      <button
        ref={trigger}
        type="button"
        className={`investor-learning-link ${styles.trigger}`}
        aria-haspopup="dialog"
        aria-controls="investor-learning-dialog"
        onClick={() => {
          dialog.current?.showModal();
          buttons.current[activeTab]?.focus({ preventScroll: true });
        }}
      >
        <BookOpen size={20} aria-hidden="true" /> Aprenda <span aria-hidden="true">+</span>
      </button>
      <dialog
        ref={dialog}
        id="investor-learning-dialog"
        className={styles.dialog}
        aria-labelledby="investor-learning-title"
        onClose={onClose}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.currentTarget.close();
        }}
      >
        <div className={styles.frame}>
          <header className={styles.header}>
            <div>
              <span className={styles.eyebrow}>Manual do corretor</span>
              <h2 id="investor-learning-title">Aprenda Associativo</h2>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="Fechar manual da Associativo"
              title="Fechar manual"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.tabs} role="tablist" aria-label="Navegação do manual">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                ref={(element) => {
                  buttons.current[key] = element;
                }}
                id={`${panelId(key)}-tab`}
                aria-controls={panelId(key)}
                aria-selected={activeTab === key}
                tabIndex={activeTab === key ? 0 : -1}
                className={styles.tab}
                onClick={() => selectTab(key)}
                onKeyDown={(event) => onTabKeyDown(event, key)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {tabs.map(({ key }) => (
            <div
              key={key}
              id={panelId(key)}
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`${panelId(key)}-tab`}
              hidden={activeTab !== key}
              className={styles.panel}
            >
              {key === "policy" ? policy : questions}
            </div>
          ))}
        </div>
      </dialog>
    </section>
  );
}
