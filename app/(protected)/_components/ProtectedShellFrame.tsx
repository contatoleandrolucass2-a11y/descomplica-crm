import type { ReactNode } from "react";

export const PROTECTED_CONTENT_ID = "protected-main-content";

export function ProtectedShellFrame({
  children,
  chrome,
  contentClassName,
  shellClassName,
  wrapContent,
}: {
  children?: ReactNode;
  chrome: ReactNode;
  contentClassName?: string | undefined;
  shellClassName: string | undefined;
  wrapContent?: (content: ReactNode) => ReactNode;
}) {
  const content = (
    <div
      id={PROTECTED_CONTENT_ID}
      className={contentClassName}
      data-protected-main-content
      tabIndex={-1}
    >
      {children}
    </div>
  );

  return (
    <div className={shellClassName} data-protected-shell>
      {chrome}
      {wrapContent ? wrapContent(content) : content}
    </div>
  );
}
