"use client";

import { useId, useRef, useState, useTransition } from "react";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  const listboxId = useId();
  const labelId = useId();
  const inputId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = query.length < 2
    ? []
    : players.filter((p) =>
        `${p.name} ${p.team} ${toSpanish(p.team)}`.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 40);

  function pick(player: Player) {
    setSelected(player.name);
    setQuery(player.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && filtered.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((i) => (filtered.length === 0 ? -1 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : (i - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === "Enter") {
      const candidate = open && activeIndex >= 0 ? filtered[activeIndex] : undefined;
      if (candidate) {
        e.preventDefault();
        pick(candidate);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function save() {
    if (!selected) return;
    startTransition(async () => {
      const r = await submitTopScorer(selected);
      setIsError(!r.ok);
      setMsg(r.ok ? "Goleador guardado ✓" : r.error);
    });
  }

  const showNoResults = query.length >= 2 && filtered.length === 0 && !selected;

  return (
    <div className="flex flex-col gap-3">
      <label
        id={labelId}
        htmlFor={inputId}
        className="text-sm font-medium text-neutral-300"
      >
        Goleador del torneo
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-labelledby={labelId}
          aria-activedescendant={
            open && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          autoComplete="off"
          placeholder="Escribe el nombre del jugador…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected("");
            setOpen(true);
            setActiveIndex(-1);
            setMsg("");
          }}
          onKeyDown={onKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none transition focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        />
        {open && filtered.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Jugadores"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg"
          >
            {filtered.map((p, i) => (
              <li
                key={`${p.name}-${p.team}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // evita que el blur cierre antes del pick
                  pick(p);
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === activeIndex ? "bg-neutral-800" : ""
                }`}
              >
                <span className="font-medium text-neutral-100">{p.name}</span>
                <span className="ml-2 text-neutral-500">{toSpanish(p.team)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-neutral-500" aria-live="polite">
        {showNoResults ? `Sin resultados para "${query}"` : ""}
      </p>

      <Button onClick={save} disabled={pending || !selected}>
        {pending ? "Guardando…" : "Guardar goleador"}
      </Button>

      {msg && (
        isError
          ? <FieldError>{msg}</FieldError>
          : <p className="text-sm text-emerald-400" aria-live="polite">{msg}</p>
      )}
    </div>
  );
}
