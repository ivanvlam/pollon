"use client";

import { useState, useTransition } from "react";

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
      <select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
      >
        <option value="">Elige un equipo…</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <button
        onClick={save}
        disabled={pending || team === ""}
        className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar campeón"}
      </button>

      {msg && (
        <p className={`text-sm ${isError ? "text-red-400" : "text-green-500"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
