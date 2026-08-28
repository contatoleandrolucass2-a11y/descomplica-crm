import type { Metadata } from "next";

import { LegalDocument } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Privacidade | Descomplica CRM",
};

export default function PrivacyPage() {
  return <LegalDocument documentKey="privacy" />;
}
