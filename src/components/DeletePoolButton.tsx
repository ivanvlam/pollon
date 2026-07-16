"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

  const inputId = useId();
  const canConfirm = value.trim().toLowerCase() === CONFIRM_WORD;

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setValue("");
      setError("");
    }
  }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          Eliminar polla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar polla</DialogTitle>
        </DialogHeader>

        {hasScores ? (
          <>
            <DialogDescription>
              Esta polla ya tiene{" "}
              <span className="text-foreground">puntos registrados</span>, así que no se
              puede eliminar. Una competencia en curso se conserva.
            </DialogDescription>
            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription>
              Se eliminará para{" "}
              <span className="text-foreground">todos los participantes</span> y no se
              puede deshacer. Las predicciones de cada uno se conservan (son las mismas
              para todas tus pollas).
            </DialogDescription>

            <label htmlFor={inputId} className="block text-sm text-muted-foreground">
              Escribe{" "}
              <span className="font-semibold text-destructive">{CONFIRM_WORD}</span> para
              confirmar:
            </label>
            <input
              id={inputId}
              type="text"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) onDelete();
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/30"
            />

            {error && (
              <p role="alert" className="fade-in-subtle text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
