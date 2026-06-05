"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { deletePool } from "@/lib/pools/actions";

export function DeletePoolButton({ poolId }: { poolId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        "¿Seguro que quieres eliminar esta polla? Esta acción no se puede deshacer.",
      )
    )
      return;
    startTransition(() => {
      void deletePool(poolId);
    });
  }

  return (
    <Button variant="danger" size="sm" disabled={pending} onClick={onClick}>
      {pending ? "Eliminando…" : "Eliminar polla"}
    </Button>
  );
}
