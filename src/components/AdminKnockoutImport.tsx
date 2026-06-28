"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { importKnockoutFixture } from "@/lib/admin/actions";

/**
 * Botón del admin para cargar de una los 16 dieciseisavos del fixture oficial
 * (equipos derivados de la tabla de grupos real). Idempotente. No activa la
 * ronda: después usar "Activar Dieciseisavos".
 */
export function AdminKnockoutImport() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    if (!window.confirm("¿Cargar los 16 dieciseisavos del fixture oficial? Los equipos salen de la tabla de grupos real.")) return;
    setMsg(null);
    startTransition(async () => {
      const r = await importKnockoutFixture();
      if (r.ok) {
        setMsg({
          ok: true,
          text: `✓ ${r.inserted ?? 0} creados, ${r.updated ?? 0} actualizados. Activá la ronda para habilitar predicciones.`,
        });
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={run} disabled={pending}>
        {pending ? "Cargando…" : "Cargar dieciseisavos oficiales"}
      </Button>
      {msg && (
        <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>
      )}
    </div>
  );
}
