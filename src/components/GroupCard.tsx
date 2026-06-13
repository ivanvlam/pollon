"use client";

import { useState } from "react";

import { Flag } from "@/components/Flag";
import { GroupModal } from "@/components/GroupModal";
import { Card } from "@/components/ui/Card";
import type { StandingRow } from "@/lib/standings";
import { toSpanish } from "@/lib/teamNames";
import { isPredictionLocked } from "@/lib/timing";

export interface GroupMatchRow {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  live_minute: string | null;
  is_active: boolean;
  pred: { predicted_home: number | null; predicted_away: number | null } | null;
  myPoints: number | undefined;
}

interface Props {
  name: string;
  standings: StandingRow[];
  matches: GroupMatchRow[];
  yourPoints: number;
}

export function GroupCard({ name, standings, matches, yourPoints }: Props) {
  const [open, setOpen] = useState(false);

  const pendingCount = matches.filter(
    (m) => m.is_active && !isPredictionLocked(m.kickoff_at) && !m.pred,
  ).length;
  const hasScores = matches.some((m) => m.myPoints !== undefined);

  return (
    <>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{name}</h2>
          {hasScores && (
            yourPoints > 0 ? (
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-sm font-medium text-emerald-400">{yourPoints} puntos</span>
            ) : (
              <span className="rounded bg-neutral-500/15 px-2 py-0.5 text-sm font-medium text-neutral-500">0 puntos</span>
            )
          )}
        </div>

        {/* Tabla de posiciones */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[16rem] text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs text-neutral-500">
              <tr>
                <th className="pb-1 px-2 text-center">#</th>
                <th className="pb-1">Equipo</th>
                <th className="pb-1 pr-2 text-center">PJ</th>
                <th className="pb-1 pr-2 text-center">DG</th>
                <th className="pb-1 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team} className="border-b border-neutral-900 last:border-0">
                  <td className="py-1.5 px-2 text-center tabular-nums text-neutral-500">{i + 1}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <Flag team={row.team} />
                      {toSpanish(row.team)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-center text-neutral-400">{row.played}</td>
                  <td className="py-1.5 pr-2 text-center text-neutral-400">
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="py-1.5 text-center font-semibold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botón abrir modal */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
        >
          <span>Ver {matches.length} partidos</span>
          {pendingCount > 0 ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              {pendingCount} sin predicción
            </span>
          ) : (
            <span className="text-neutral-600">→</span>
          )}
        </button>
      </Card>

      {open && (
        <GroupModal
          name={name}
          standings={standings}
          matches={matches}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
