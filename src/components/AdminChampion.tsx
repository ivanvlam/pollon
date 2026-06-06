"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { setActualChampion } from "@/lib/admin/actions";

interface Props {
  teams: string[]; // en español
}

export function AdminChampion({ teams }: Props) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function handleSave() {
    if (!selected) return;
    if (!window.confirm(`¿Confirmar campeón: ${selected}? Esto recalculará los puntos de todos los participantes.`)) return;
    startTransition(async () => {
      const r = await setActualChampion(selected);
      setMsg(r.ok ? `✓ Campeón "${selected}" guardado y puntos calculados` : r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-800 p-5">
      <h2 className="font-semibold">Campeón del torneo</h2>
      <p className="text-sm text-neutral-400">
        Usa esto si la final fue a penales o la API no reportó bien el ganador.
        Recalcula los puntos de campeón para todos los participantes.
      </p>
      <div className="flex items-center gap-3">
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setMsg(""); }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
        >
          <option value="">Seleccionar equipo…</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Button onClick={handleSave} disabled={pending || !selected}>
          {pending ? "Calculando…" : "Guardar campeón real"}
        </Button>
      </div>
      {msg && <span className="text-sm text-emerald-400">{msg}</span>}
    </div>
  );
}
