"use client";

import { useState, useTransition } from "react";

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

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setError("");
  }

  function onLeave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      // En éxito, el Server Action redirige; solo vuelve aquí si hubo error.
      const r = await leavePool(poolId);
      if (r && "error" in r) setError(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 transition hover:text-destructive hover:underline"
        >
          Abandonar polla
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Abandonar la polla?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Dejarás de aparecer en el ranking y perderás tus puntos en{" "}
          <span className="text-foreground">esta</span> polla. Tus predicciones se
          conservan (son las mismas para todas tus pollas) y puedes volver a unirte con el
          código de invitación.
        </DialogDescription>

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
          <Button variant="danger" size="sm" onClick={onLeave} disabled={pending}>
            {pending ? "Abandonando…" : "Sí, abandonar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
