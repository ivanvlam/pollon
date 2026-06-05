"use client";

import { useState } from "react";

import { Flag } from "@/components/Flag";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { Card } from "@/components/ui/Card";
import type { StandingRow } from "@/lib/standings";
import { isPredictionLocked } from "@/lib/timing";

export interface GroupMatchRow {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
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

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "- : -" : `${h} : ${a}`;

export function GroupCard({ name, standings, matches, yourPoints }: Props) {
  const [open, setOpen] = useState(false);

  const pendingCount = matches.filter(
    (m) => m.is_active && !isPredictionLocked(m.kickoff_at) && !m.pred,
  ).length;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{name}</h2>
        {yourPoints > 0 && (
          <span className="text-sm text-emerald-400">{yourPoints} pts</span>
        )}
      </div>

      {/* Tabla de posiciones */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] text-left text-sm">
          <thead className="border-b border-neutral-800 text-xs text-neutral-500">
            <tr>
              <th className="pb-1 pr-2">#</th>
              <th className="pb-1">Equipo</th>
              <th className="pb-1 pr-2 text-center">PJ</th>
              <th className="pb-1 pr-2 text-center">DG</th>
              <th className="pb-1 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.team} className="border-b border-neutral-900 last:border-0">
                <td className="py-1.5 pr-2 text-neutral-500">{i + 1}</td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2">
                    <Flag team={row.team} />
                    {row.team}
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

      {/* Toggle partidos */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
      >
        {open ? "Ocultar partidos ▲" : `Ver ${matches.length} partidos ▾`}
        {!open && pendingCount > 0 && (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
            {pendingCount} sin predicción
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {matches.map((match) => {
            const locked = isPredictionLocked(match.kickoff_at);
            const finished = match.status === "finished";
            const canPredict = match.is_active && !locked;

            return (
              <div key={match.id} className="rounded-lg border border-neutral-800 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>{new Date(match.kickoff_at).toLocaleString()}</span>
                  {finished ? (
                    <span className="font-medium text-neutral-300">
                      Final {fmt(match.home_score, match.away_score)}
                    </span>
                  ) : locked ? (
                    <span>Empezó</span>
                  ) : (
                    <LockCountdown kickoffAt={match.kickoff_at} />
                  )}
                </div>

                {canPredict ? (
                  <PredictionForm
                    matchId={match.id}
                    homeTeam={match.home_team}
                    awayTeam={match.away_team}
                    isKnockout={false}
                    initialHome={match.pred?.predicted_home ?? null}
                    initialAway={match.pred?.predicted_away ?? null}
                    initialWinner={null}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Flag team={match.home_team} />
                      {match.home_team}
                      <span className="text-neutral-600">vs</span>
                      {match.away_team}
                      <Flag team={match.away_team} />
                    </span>
                    <span className="shrink-0 text-neutral-400">
                      {match.pred
                        ? fmt(match.pred.predicted_home, match.pred.predicted_away)
                        : "—"}
                      {match.myPoints !== undefined && (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">
                          +{match.myPoints}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
