"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { leavePool } from "@/lib/pools/actions";

/**
 * Opción discreta para que un participante (no el creador) abandone la polla.
 * El disparador es un texto pequeño y apagado —deliberadamente menos prominente
 * que el resto de acciones— y abre un modal de confirmación simple.
 */
export function LeavePoolButton({ poolId }: { poolId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setError("");
  }

  // Foco inicial en Cancelar + cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onLeave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      // En éxito, el Server Action redirige; solo vuelve aquí si hubo error.
      const r = await leavePool(poolId);
      if (r && "error" in r) {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-neutral-500 underline-offset-2 transition hover:text-red-400 hover:underline"
      >
        Abandonar polla
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold text-neutral-100">
              ¿Abandonar la polla?
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Dejarás de aparecer en el ranking y perderás tus puntos en{" "}
              <span className="text-neutral-200">esta</span> polla. Tus
              predicciones se conservan (son las mismas para todas tus pollas) y
              puedes volver a unirte con el código de invitación.
            </p>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                ref={cancelRef}
                variant="secondary"
                size="sm"
                onClick={close}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onLeave}
                disabled={pending}
              >
                {pending ? "Abandonando…" : "Sí, abandonar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
