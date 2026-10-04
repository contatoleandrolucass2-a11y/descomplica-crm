import type { ReactNode } from "react";

export const PROTECTED_CONTENT_ID = "protected-main-content";

export function ProtectedShellFrame({
  children,
  chrome,
  contentClassName,
  shellClassName,
}: {
  children?: ReactNode;
  chrome: ReactNode;
  contentClassName?: string | undefined;
  shellClassName: string | undefined;
}) {
  return (
    <div className={shellClassName} data-protected-shell>
      {chrome}
      <div
        id={PROTECTED_CONTENT_ID}
        className={contentClassName}
        data-protected-main-content
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
