"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { setRoundActive } from "@/lib/admin/actions";

interface Props {
  poolId: string;
  round: string;
  label: string;
}

export function AdminRoundActivator({ poolId, round, label }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function activate() {
    if (!window.confirm(`¿Activar todos los partidos de ${label}? Los participantes podrán empezar a predecir.`)) return;
    startTransition(async () => {
      const r = await setRoundActive(poolId, round);
      setMsg(r.ok ? `✓ ${(r as { count?: number }).count ?? "?"} partidos activados` : r.error);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-emerald-400">{msg}</span>}
      <Button size="sm" onClick={activate} disabled={pending}>
        {pending ? "Activando…" : `Activar ${label}`}
      </Button>
    </div>
  );
}
