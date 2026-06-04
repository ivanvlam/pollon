"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

import { login, type AuthState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-8"
      >
        <h1 className="text-2xl font-bold">Entrar a Pollon</h1>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            placeholder="tu@email.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            name="password"
            placeholder="••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <FieldError>{state?.error}</FieldError>
        <SubmitButton />

        <p className="text-center text-sm text-neutral-400">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-emerald-400 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>
    </main>
  );
}
