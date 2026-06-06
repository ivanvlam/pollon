"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { joinPoolFromForm, type PoolActionState } from "@/lib/pools/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? "Uniéndote…" : "Unirme"}
    </Button>
  );
}

export function JoinPoolForm() {
  const [state, formAction] = useFormState<PoolActionState, FormData>(
    joinPoolFromForm,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input
        type="text"
        name="inviteCode"
        placeholder="Código de invitación"
        aria-label="Código de invitación"
      />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton />
    </form>
  );
}
