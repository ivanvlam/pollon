"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { createPool, type PoolActionState } from "@/lib/pools/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creando…" : "Crear polla"}
    </Button>
  );
}

export function CreatePoolForm() {
  const [state, formAction] = useFormState<PoolActionState, FormData>(
    createPool,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input
        type="text"
        name="name"
        placeholder="Nombre de la polla"
        aria-label="Nombre de la polla"
        required
      />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton />
    </form>
  );
}
