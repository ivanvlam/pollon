"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Botón de borrado para el panel admin. El disparador es una "X" discreta y la
 * confirmación es un modal en pantalla (no texto al lado ni window.confirm).
 * Recibe la Server Action ya "bindeada" con el id.
 */
export function AdminDeleteButton({
  action,
  title = "¿Eliminar?",
  description = "Esta acción no se puede deshacer.",
}: {
  action: () => Promise<Result>;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (pending) return;
    setOpen(false);
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

  function onDelete() {
    if (pending) return;
    start(async () => {
      const r = await action();
      // En éxito puede haber redirect/revalidate; en error lo mostramos.
      if (!r.ok) setError(r.error);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Eliminar"
        title="Eliminar"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-400 transition hover:bg-red-500/10"
      >
        <span aria-hidden className="text-base leading-none">✕</span>
      </button>

      {error && <span className="ml-2 text-xs text-red-400">{error}</span>}

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
              {title}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">{description}</p>

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
                onClick={onDelete}
                disabled={pending}
              >
                {pending ? "Eliminando…" : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
