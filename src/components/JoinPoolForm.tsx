"use client";

import { useFormState, useFormStatus } from "react-dom";

import { joinPoolFromForm, type PoolActionState } from "@/lib/pools/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-neutral-600 px-4 py-2 font-medium transition hover:bg-neutral-800 disabled:opacity-50"
    >
      {pending ? "Uniéndote…" : "Unirme"}
    </button>
  );
}

export function JoinPoolForm() {
  const [state, formAction] = useFormState<PoolActionState, FormData>(
    joinPoolFromForm,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="text"
        name="inviteCode"
        placeholder="Código de invitación"
        required
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
