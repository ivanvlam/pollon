"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { leavePool } from "@/lib/pools/actions";

export function LeavePoolButton({ poolId }: { poolId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("¿Seguro que quieres salir de esta polla?")) return;
    startTransition(() => {
      void leavePool(poolId);
    });
  }

  return (
    <Button variant="danger" size="sm" disabled={pending} onClick={onClick}>
      {pending ? "Saliendo…" : "Salir de la polla"}
    </Button>
  );
}
