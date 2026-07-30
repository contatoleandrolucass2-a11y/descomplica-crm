"use client";

/**
 * Login form Client Component.
 *
 * Delegates all auth logic to `loginAction` (Server Action). This component
 * owns only presentation and pending state. No Supabase access, no
 * environment reads, no local storage, no cookie manipulation.
 */

import Link from "next/link";
import { useActionState } from "react";

import { initialLoginActionState, loginAction } from "@/lib/auth/actions/login";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialLoginActionState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900">Entrar</h1>
        <p className="mb-6 text-sm text-gray-500">Acesse sua conta para continuar.</p>

        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isPending}
              placeholder="seu@email.com"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 transition outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 transition outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {state.status === "error" && state.message ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800 focus:ring-2 focus:ring-blue-600/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Ainda não tem conta?{" "}
          <Link href="/register" className="font-medium text-blue-900 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
