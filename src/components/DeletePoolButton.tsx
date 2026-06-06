"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { deletePool } from "@/lib/pools/actions";

const CONFIRM_WORD = "eliminar";

export function DeletePoolButton({
  poolId,
  hasScores,
}: {
  poolId: string;
  hasScores: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const canConfirm = value.trim().toLowerCase() === CONFIRM_WORD;

  function close() {
    if (pending) return;
    setOpen(false);
    setValue("");
    setError("");
  }

  // Foco inicial + cerrar con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      (hasScores ? closeRef.current : inputRef.current)?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onDelete() {
    if (!canConfirm || pending) return;
    setError("");
    startTransition(async () => {
      // En éxito, el Server Action redirige; solo vuelve aquí si hubo error.
      const r = await deletePool(poolId);
      if (r && "error" in r) setError(r.error);
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Eliminar polla
      </Button>

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
              Eliminar polla
            </h2>

            {hasScores ? (
              <>
                <p className="mt-2 text-sm text-neutral-400">
                  Esta polla ya tiene <span className="text-neutral-200">puntos registrados</span>,
                  así que no se puede eliminar. Una competencia en curso se conserva.
                </p>
                <div className="mt-5 flex justify-end">
                  <Button ref={closeRef} variant="secondary" size="sm" onClick={close}>
                    Cerrar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-neutral-400">
                  Se eliminará para <span className="text-neutral-200">todos los participantes</span>{" "}
                  y no se puede deshacer. Las predicciones de cada uno se conservan
                  (son las mismas para todas tus pollas).
                </p>

                <label
                  htmlFor={inputId}
                  className="mt-4 block text-sm text-neutral-300"
                >
                  Escribe{" "}
                  <span className="font-semibold text-red-400">{CONFIRM_WORD}</span>{" "}
                  para confirmar:
                </label>
                <input
                  id={inputId}
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm) onDelete();
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/30"
                />

                {error && (
                  <p role="alert" className="mt-2 text-sm text-red-400">
                    {error}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button
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
                    onClick={onDelete}
                    disabled={!canConfirm || pending}
                  >
                    {pending ? "Eliminando…" : "Eliminar polla"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
