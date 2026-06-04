"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

import { register, type AuthState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creando…" : "Crear cuenta"}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(register, null);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-8"
      >
        <h1 className="text-2xl font-bold">Crear cuenta</h1>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Tu nombre</Label>
          <Input
            id="displayName"
            type="text"
            name="displayName"
            placeholder="Cómo te verán en el ranking"
            required
            autoComplete="nickname"
          />
        </div>

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
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
          />
        </div>

        <FieldError>{state?.error}</FieldError>
        <SubmitButton />

        <p className="text-center text-sm text-neutral-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
