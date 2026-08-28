function iconCategory(pageKey: string) {
  if (pageKey.startsWith("crm.simulation")) return "calculator";
  if (pageKey.startsWith("crm.dialer")) return "phone";
  if (pageKey.startsWith("crm.settings")) return "settings";
  if (pageKey.startsWith("crm.stage")) return "funnel";
  if (pageKey === "crm.ranking") return "trophy";
  if (pageKey === "crm.partnerships") return "partners";
  if (pageKey.startsWith("admin")) return "shield";
  return "dashboard";
}

export function AppPageIcon({ pageKey }: { pageKey: string }) {
  const category = iconCategory(pageKey);

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {category === "calculator" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <path d="M8 6.5h8v3H8zM8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
        </>
      ) : null}
      {category === "settings" ? (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.08-1l2-1.45-2-3.46-2.25.96a7.5 7.5 0 0 0-1.73-1L14.67 3h-4l-.27 3.05a7.5 7.5 0 0 0-1.73 1l-2.25-.96-2 3.46L6.42 11a7 7 0 0 0 0 2l-2 1.45 2 3.46 2.25-.96a7.5 7.5 0 0 0 1.73 1l.27 3.05h4l.27-3.05a7.5 7.5 0 0 0 1.73-1l2.25.96 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" />
        </>
      ) : null}
      {category === "funnel" ? <path d="M4 5h16l-6.25 7.1V19l-3.5 2v-8.9L4 5Z" /> : null}
      {category === "trophy" ? (
        <>
          <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4ZM9 20h6M12 12.5V20" />
          <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
        </>
      ) : null}
      {category === "partners" ? (
        <>
          <circle cx="8" cy="9" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h1a4.5 4.5 0 0 1 4.5 4.5V20M14.5 15.5a4 4 0 0 1 6 3.5v1" />
        </>
      ) : null}
      {category === "phone" ? (
        <path d="M7.2 3.8 4.8 6.2c-.7.7-.7 1.8-.2 2.7 2.4 4.3 5.9 7.8 10.2 10.2.9.5 2 .5 2.7-.2l2.4-2.4-3.6-3.1-2.1 1.2a15.5 15.5 0 0 1-4.9-4.9l1.2-2.1-3.3-3.8Z" />
      ) : null}
      {category === "shield" ? (
        <path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6l8-3Z" />
      ) : null}
      {category === "dashboard" ? (
        <>
          <rect x="3" y="3" width="7" height="8" rx="2" />
          <rect x="14" y="3" width="7" height="5" rx="2" />
          <rect x="3" y="15" width="7" height="6" rx="2" />
          <rect x="14" y="12" width="7" height="9" rx="2" />
        </>
      ) : null}
    </svg>
  );
}
