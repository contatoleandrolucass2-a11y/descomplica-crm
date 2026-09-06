"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const ARCHIVE_SIMULATOR_ROUTES = new Set([
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/tabela-direta",
]);

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

  if (ARCHIVE_SIMULATOR_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className={shellClassName}>
      {chrome}
      {children}
    </div>
  );
}
