import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ranking dos corretores | Descomplica CRM",
  description:
    "Ranking público dos corretores com produção, pontos, conversões e desempenho do período.",
  alternates: {
    canonical: "https://descomplicapro.com.br/ranking",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export { dynamic, default } from "../configuracoes/metas/pontos/page";
