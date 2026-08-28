import type { Metadata } from "next";

import { LegalDocument } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: "Termos de Uso | Descomplica CRM",
};

export default function TermsPage() {
  return <LegalDocument documentKey="terms" />;
}
