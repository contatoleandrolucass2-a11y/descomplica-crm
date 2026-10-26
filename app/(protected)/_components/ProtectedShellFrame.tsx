import type { ReactNode } from "react";
import type { NavigationItem } from "@/lib/navigation/presentation";

import { DashboardShell } from "./DashboardShell";

export const PROTECTED_CONTENT_ID = "protected-main-content";

export function ProtectedShellFrame({
  children,
  chrome,
  contentClassName,
  shellClassName,
  pages = [],
}: {
  children?: ReactNode;
  chrome: ReactNode;
  contentClassName?: string | undefined;
  shellClassName: string | undefined;
  pages?: NavigationItem[];
}) {
  return (
    <div className={shellClassName} data-protected-shell>
      {chrome}
      <DashboardShell pages={pages}>
        <div
          id={PROTECTED_CONTENT_ID}
          className={contentClassName}
          data-protected-main-content
          tabIndex={-1}
        >
          {children}
        </div>
      </DashboardShell>
    </div>
  );
}
