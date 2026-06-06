"use client";

import { useState, useTransition } from "react";

import { buttonClasses } from "@/components/ui/Button";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Botón de borrado para el panel admin, con confirmación en dos pasos
 * (sin window.confirm). Recibe la Server Action ya "bindeada" con el id.
 */
export function AdminDeleteButton({ action }: { action: () => Promise<Result> }) {
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
        Eliminar
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await action();
            if (!r.ok) {
              setError(r.error);
              setConfirming(false);
            }
          })
        }
        className={buttonClasses("danger", "sm")}
      >
        {pending ? "Eliminando…" : "Confirmar"}
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
