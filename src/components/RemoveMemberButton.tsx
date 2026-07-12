"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { buttonClasses } from "@/components/ui/Button";
import { removeMember } from "@/lib/pools/actions";

/** Botón del creador para expulsar a un participante (confirmación en dos pasos). */
export function RemoveMemberButton({
  poolId,
  userId,
}: {
  poolId: string;
  userId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        className={buttonClasses("danger", "sm")}
      >
        Quitar
      </button>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeMember(poolId, userId);
            if (r) {
              setError(r.error);
              setConfirming(false);
              toast.error(r.error);
            } else {
              toast.success("Participante quitado");
            }
          })
        }
        className={buttonClasses("danger", "sm")}
      >
        {pending ? "Quitando…" : "Confirmar"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className={buttonClasses("ghost", "sm")}
      >
        Cancelar
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
