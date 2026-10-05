"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { getAccountFirstName } from "@/lib/navigation/account-identity";

import styles from "./ProtectedShell.module.css";

const ACCOUNT_PANEL_ID = "protected-account-menu";

interface AccountMenuProps {
  children: ReactNode;
  identity: string;
  displayName?: unknown;
  role: string;
}

function getIdentityInitials(identity: string) {
  const localIdentity = identity.trim().split("@")[0] ?? "";
  const parts = localIdentity.split(/[\s._+\-]+/u).filter(Boolean);
  if (parts.length === 0) return "U";

  const first = Array.from(parts[0] ?? "");
  const second = parts.length > 1 ? Array.from(parts.at(-1) ?? "") : first.slice(1);
  return `${first[0] ?? ""}${second[0] ?? ""}`.toLocaleUpperCase("pt-BR") || "U";
}

export function AccountMenu(props: AccountMenuProps) {
  const pathname = usePathname();

  return <AccountMenuState key={pathname} {...props} />;
}

function AccountMenuState({ children, identity, displayName, role }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = getIdentityInitials(identity);
  const firstName = getAccountFirstName(displayName);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("focusin", closeFromOutside, true);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("focusin", closeFromOutside, true);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  function closeAfterAction(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("a, button[type='submit']")) setOpen(false);
  }

  return (
    <div className={styles.accountMenu} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.accountTrigger}
        aria-controls={ACCOUNT_PANEL_ID}
        aria-expanded={open}
        aria-label={firstName ? `Conta de ${firstName} (${identity})` : `Conta de ${identity}`}
        title={identity}
        data-session-identity
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.accountAvatar} aria-hidden="true">
          {initials}
        </span>
        <span
          className={styles.accountTriggerIdentity}
          aria-hidden="true"
          data-session-identity-trigger-label
        >
          {firstName ?? "Conta"}
        </span>
        <ChevronDown
          className={styles.accountChevron}
          aria-hidden="true"
          size={16}
          strokeWidth={1.8}
        />
      </button>

      <div
        id={ACCOUNT_PANEL_ID}
        className={styles.accountPanel}
        hidden={!open}
        onClick={closeAfterAction}
      >
        <div className={styles.accountProfile}>
          <span className={styles.accountProfileLabel}>Conta conectada</span>
          <strong data-session-identity-label>{identity}</strong>
          <span>{role}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
