"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const ASSOCIATIVE_REFERENCE_ROUTE = "/app/simulacao/associativo-fluxo-linear";

export function ProtectedShellFrame({
  children,
  chrome,
  shellClassName,
}: {
  children: ReactNode;
  chrome: ReactNode;
  shellClassName: string | undefined;
}) {
  const pathname = usePathname();

  if (pathname === ASSOCIATIVE_REFERENCE_ROUTE) {
    return <>{children}</>;
  }

  return (
    <div className={shellClassName}>
      {chrome}
      {children}
    </div>
  );
}
