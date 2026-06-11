"use client";

import { useEffect } from "react";

import { Flag } from "@/components/Flag";
import type { GroupMatchRow } from "@/components/GroupCard";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { formatLiveMinute } from "@/lib/liveMinute";
import type { StandingRow } from "@/lib/standings";
import { toSpanish } from "@/lib/teamNames";
import { hasMatchStarted, isPredictionLocked } from "@/lib/timing";

interface Props {
  name: string;
  standings: StandingRow[];
  matches: GroupMatchRow[];
  onClose: () => void;
}

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "- : -" : `${h} : ${a}`;

export function GroupModal({ name, standings, matches, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-neutral-700 bg-neutral-950 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h2 className="text-base font-semibold">{name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {/* Tabla de posiciones */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[16rem] text-left text-sm">
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

          {/* Partidos */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Partidos
            </h3>
            {matches.map((match) => {
              const locked = isPredictionLocked(match.kickoff_at);
              const started = match.status === "live" || hasMatchStarted(match.kickoff_at);
              const finished = match.status === "finished";
              const canPredict = match.is_active && !locked;
              const homeEs = toSpanish(match.home_team);
              const awayEs = toSpanish(match.away_team);

              return (
                <div key={match.id} className="rounded-xl border border-neutral-800 p-3">
                  <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                    <span>{new Date(match.kickoff_at).toLocaleString()}</span>
                    {finished ? (
                      <span className="font-medium text-neutral-300">
                        Final {fmt(match.home_score, match.away_score)}
                      </span>
                    ) : match.status === "live" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        <span className="font-medium text-red-400">EN VIVO</span>
                        {match.home_score !== null && match.away_score !== null && (
                          <span className="text-neutral-200">
                            {fmt(match.home_score, match.away_score)}
                          </span>
                        )}
                        {formatLiveMinute(match.live_minute) && (
                          <span className="text-neutral-400">
                            {formatLiveMinute(match.live_minute)}
                          </span>
                        )}
                      </span>
                    ) : started ? (
                      <span>Empezó</span>
                    ) : locked ? (
                      <span className="text-neutral-500">Cerrado</span>
                    ) : (
                      <LockCountdown kickoffAt={match.kickoff_at} />
                    )}
                  </div>

                  {canPredict ? (
                    <PredictionForm
                      matchId={match.id}
                      homeTeam={homeEs}
                      awayTeam={awayEs}
                      isKnockout={false}
                      initialHome={match.pred?.predicted_home ?? null}
                      initialAway={match.pred?.predicted_away ?? null}
                      initialWinner={null}
                    />
                  ) : (
                    <div className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Flag team={match.home_team} className="shrink-0" />
                          <span className="truncate">{homeEs}</span>
                        </span>
                        <span className="tabular-nums text-neutral-300">
                          {match.pred?.predicted_home ?? "–"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Flag team={match.away_team} className="shrink-0" />
                          <span className="truncate">{awayEs}</span>
                        </span>
                        <span className="tabular-nums text-neutral-300">
                          {match.pred?.predicted_away ?? "–"}
                        </span>
                      </div>
                      {match.myPoints !== undefined && (
                        <div className="mt-1.5 text-right">
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">
                            +{match.myPoints} pts
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
