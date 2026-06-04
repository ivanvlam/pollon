"use client";

import { useState, useTransition } from "react";

import { Flag } from "@/components/Flag";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Flag team={homeTeam} />
          {homeTeam} <span className="text-neutral-500">vs</span> {awayTeam}
          <Flag team={awayTeam} />
        </span>
        <Button
          onClick={toggleActive}
          disabled={pending}
          size="sm"
          variant={isActive ? "secondary" : "ghost"}
          className={isActive ? "border-emerald-600/50 text-emerald-400" : ""}
        >
          {isActive ? "Activo" : "Inactivo"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          max={99}
          value={home}
          aria-label={`Goles de ${homeTeam}`}
          onChange={(e) => setHome(e.target.value)}
          className="w-14 text-center"
        />
        <span className="text-neutral-500">–</span>
        <Input
          type="number"
          min={0}
          max={99}
          value={away}
          aria-label={`Goles de ${awayTeam}`}
          onChange={(e) => setAway(e.target.value)}
          className="w-14 text-center"
        />

        {isKnockout && (
          <select
            value={win}
            aria-label="Quién clasifica"
            onChange={(e) => setWin(e.target.value as MatchWinner | "")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
          >
            <option value="">Clasifica…</option>
            <option value="home">{homeTeam}</option>
            <option value="away">{awayTeam}</option>
          </select>
        )}

        <Button
          onClick={save}
          disabled={pending || home === "" || away === ""}
          size="sm"
        >
          Guardar resultado
        </Button>
      </div>

      {msg && <p className="text-xs text-neutral-400">{msg}</p>}
    </div>
  );
}
