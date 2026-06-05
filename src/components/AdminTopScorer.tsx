"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { setActualTopScorer, syncMatches, syncPlayers } from "@/lib/admin/actions";

interface Player { name: string; team: string; }

interface Props {
  poolId: string;
  players: Player[];
}

export function AdminTopScorer({ poolId, players }: Props) {
  const [matchSyncMsg, setMatchSyncMsg] = useState("");
  const [matchSyncPending, startMatchSync] = useTransition();

  const [syncMsg, setSyncMsg] = useState("");
  const [syncPending, startSync] = useTransition();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [savePending, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState("");

  const filtered = query.length < 2
    ? []
    : players.filter((p) =>
        `${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 40);

  function pick(p: Player) {
    setSelected(p.name);
    setQuery(p.name);
    setOpen(false);
  }

  function handleMatchSync() {
    startMatchSync(async () => {
      const r = await syncMatches(poolId);
      setMatchSyncMsg(r.ok ? `✓ ${(r as { count?: number }).count ?? "?"} partidos sincronizados` : r.error);
    });
  }

  function handleSync() {
    startSync(async () => {
      const r = await syncPlayers(poolId);
      setSyncMsg(r.ok ? `✓ ${(r as { count?: number }).count ?? "?"} jugadores sincronizados` : r.error);
    });
  }

  function handleSave() {
    if (!selected) return;
    startSave(async () => {
      const r = await setActualTopScorer(poolId, selected);
      setSaveMsg(r.ok ? "✓ Goleador real guardado y puntos calculados" : r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-neutral-800 p-5">
      <h2 className="font-semibold">Setup inicial</h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-neutral-400">
          Carga el fixture completo del Mundial desde TheSportsDB. Hacerlo antes de abrir las predicciones.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleMatchSync} disabled={matchSyncPending}>
            {matchSyncPending ? "Sincronizando…" : "Sincronizar partidos"}
          </Button>
          {matchSyncMsg && <span className="text-sm text-emerald-400">{matchSyncMsg}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-neutral-400">
          Sincroniza los planteles de jugadores (hacer una sola vez, puede tardar ~2 min).
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleSync} disabled={syncPending}>
            {syncPending ? "Sincronizando…" : "Sincronizar jugadores"}
          </Button>
          {syncMsg && <span className="text-sm text-emerald-400">{syncMsg}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-neutral-400">
          Al terminar el torneo, selecciona el goleador real para calcular los puntos.
        </p>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar jugador…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(""); setOpen(true); }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg">
              {filtered.map((p) => (
                <li
                  key={`${p.name}-${p.team}`}
                  onMouseDown={() => pick(p)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-neutral-800"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-neutral-500">{p.team}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={savePending || !selected}>
            {savePending ? "Calculando…" : "Guardar goleador real"}
          </Button>
          {saveMsg && <span className="text-sm text-emerald-400">{saveMsg}</span>}
        </div>
      </div>
    </div>
  );
}
