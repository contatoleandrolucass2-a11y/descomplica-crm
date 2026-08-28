import type { Metadata } from "next";

import { PasswordRecoveryForm } from "./PasswordRecoveryForm";

export const metadata: Metadata = {
  title: "Recuperar senha | Descomplica CRM",
};

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  return <PasswordRecoveryForm invalidLink={params.status === "invalid"} />;
}
