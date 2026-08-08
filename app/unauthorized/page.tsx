import { forbidden } from "next/navigation";

// Compatibility endpoint for old bookmarks and cached redirects. Dynamic
// rendering avoids writing a prerender artifact inside the read-only container;
// the canonical localized surface is app/forbidden.tsx and returns HTTP 403.
export const dynamic = "force-dynamic";

export default function LegacyUnauthorizedPage() {
  forbidden();
}
