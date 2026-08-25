import type { Metadata } from "next";

import { LegalDocument } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Cookies | Descomplica CRM",
};

export default function CookiesPage() {
  return <LegalDocument documentKey="cookies" />;
}
