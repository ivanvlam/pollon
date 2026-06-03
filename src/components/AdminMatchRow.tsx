"use client";

import { useState, useTransition } from "react";

import { saveMatchResult, setMatchActive } from "@/lib/admin/actions";
import type { MatchWinner } from "@/types";

interface Props {
  poolId: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  isKnockout: boolean;
  isActive: boolean;
  homeScore: number | null;
  awayScore: number | null;
  winner: MatchWinner | null;
}

export function AdminMatchRow({
  poolId,
  matchId,
  homeTeam,
  awayTeam,
  isKnockout,
  isActive,
  homeScore,
  awayScore,
  winner,
}: Props) {
  const [home, setHome] = useState(homeScore?.toString() ?? "");
  const [away, setAway] = useState(awayScore?.toString() ?? "");
  const [win, setWin] = useState<MatchWinner | "">(winner ?? "");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const r = await setMatchActive(poolId, matchId, !isActive);
      setMsg(r.ok ? "" : r.error);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await saveMatchResult(poolId, matchId, {
        homeScore: Number(home),
        awayScore: Number(away),
        winner: isKnockout ? (win === "" ? null : win) : null,
      });
      setMsg(r.ok ? "Guardado ✓" : r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">
          {homeTeam} vs {awayTeam}
        </span>
        <button
          onClick={toggleActive}
          disabled={pending}
          className={`rounded px-2 py-1 text-xs ${
            isActive
              ? "bg-green-600/20 text-green-400"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {isActive ? "Activo" : "Inactivo"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={99}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-14 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
        />
        <span className="text-neutral-500">–</span>
        <input
          type="number"
          min={0}
          max={99}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-14 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
        />

        {isKnockout && (
          <select
            value={win}
            onChange={(e) => setWin(e.target.value as MatchWinner | "")}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            <option value="">Clasifica…</option>
            <option value="home">{homeTeam}</option>
            <option value="away">{awayTeam}</option>
          </select>
        )}

        <button
          onClick={save}
          disabled={pending || home === "" || away === ""}
          className="rounded bg-white px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
        >
          Guardar resultado
        </button>
      </div>

      {msg && <p className="text-xs text-neutral-400">{msg}</p>}
    </div>
  );
}
