"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationPage {
  key: string;
  path: string;
  name: string;
}

export function AuthorizedNavigation({ pages }: { pages: NavigationPage[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação autorizada"
      className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:flex-wrap sm:px-6"
    >
      {pages.map((page) => {
        const active = pathname === page.path;
        return (
          <Link
            key={page.key}
            href={page.path}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
              active
                ? "border-cyan-700 bg-cyan-50 font-medium text-cyan-900"
                : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            {page.name}
          </Link>
        );
      })}
    </nav>
  );
}
