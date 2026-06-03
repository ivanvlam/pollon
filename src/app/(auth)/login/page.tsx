"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { login, type AuthState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-800 p-8"
      >
        <h1 className="text-2xl font-bold">Entrar a Pollon</h1>

        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
        />
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
        />

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <SubmitButton />

        <p className="text-center text-sm text-neutral-400">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="underline hover:text-white">
            Crear cuenta
          </Link>
        </p>
      </form>
    </main>
  );
}
