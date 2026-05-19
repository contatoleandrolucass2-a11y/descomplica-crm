import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | Descomplica Platform",
};

export default function LoginPage() {
  return <LoginForm />;
}
