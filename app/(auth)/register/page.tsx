import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isPublicSignupEnabled } from "@/lib/homologation/config";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Criar conta | Descomplica Platform",
};

export default function RegisterPage() {
  if (!isPublicSignupEnabled()) notFound();
  return <RegisterForm />;
}
