"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { submitTopScorer } from "@/lib/top-scorer/actions";
import { toSpanish } from "@/lib/teamNames";

interface Player {
  name: string;
  team: string;
}

interface Props {
  players: Player[];
  initialPlayer: string | null;
}

export function TopScorerForm({ players, initialPlayer }: Props) {
  const [query, setQuery] = useState(initialPlayer ?? "");
  const [selected, setSelected] = useState(initialPlayer ?? "");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = query.length < 2
    ? []
    : players.filter((p) =>
        `${p.name} ${p.team} ${toSpanish(p.team)}`.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 40);

  function pick(player: Player) {
    setSelected(player.name);
    setQuery(player.name);
    setOpen(false);
  }

  function save() {
    if (!selected) return;
    startTransition(async () => {
      const r = await submitTopScorer(selected);
      setIsError(!r.ok);
      setMsg(r.ok ? "Goleador guardado ✓" : r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-neutral-300">
        Goleador del torneo
      </label>

      <div className="relative">
        <input
          type="text"
          placeholder="Escribe el nombre del jugador…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected("");
            setOpen(true);
            setMsg("");
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none transition focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg">
            {filtered.map((p) => (
              <li
                key={`${p.name}-${p.team}`}
                onMouseDown={() => pick(p)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-neutral-800"
              >
                <span className="font-medium text-neutral-100">{p.name}</span>
                <span className="ml-2 text-neutral-500">{toSpanish(p.team)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {query.length >= 2 && filtered.length === 0 && !selected && (
        <p className="text-xs text-neutral-500">Sin resultados para "{query}"</p>
      )}

      <Button onClick={save} disabled={pending || !selected}>
        {pending ? "Guardando…" : "Guardar goleador"}
      </Button>

      {msg && (
        isError
          ? <FieldError>{msg}</FieldError>
          : <p className="text-sm text-emerald-400">{msg}</p>
      )}
    </div>
  );
}
