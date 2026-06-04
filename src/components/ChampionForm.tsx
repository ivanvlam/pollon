"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { submitChampion } from "@/lib/champion/actions";

interface Props {
  teams: string[];
  initialTeam: string | null;
}

export function ChampionForm({ teams, initialTeam }: Props) {
  const [team, setTeam] = useState(initialTeam ?? "");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!team) return;
    startTransition(async () => {
      const r = await submitChampion(team);
      setIsError(!r.ok);
      setMsg(r.ok ? "Campeón guardado ✓" : r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="champion-team" className="text-sm font-medium text-neutral-300">
        Equipo campeón
      </label>
      <select
        id="champion-team"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none transition focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
      >
        <option value="">Elige un equipo…</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <Button onClick={save} disabled={pending || team === ""}>
        {pending ? "Guardando…" : "Guardar campeón"}
      </Button>

      {msg &&
        (isError ? (
          <FieldError>{msg}</FieldError>
        ) : (
          <p className="text-sm text-emerald-400">{msg}</p>
        ))}
    </div>
  );
}
