"use client";

import { useFormState, useFormStatus } from "react-dom";

import { createPool, type PoolActionState } from "@/lib/pools/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
    >
      {pending ? "Creando…" : "Crear polla"}
    </button>
  );
}

export function CreatePoolForm() {
  const [state, formAction] = useFormState<PoolActionState, FormData>(
    createPool,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="text"
        name="name"
        placeholder="Nombre de la polla"
        required
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
