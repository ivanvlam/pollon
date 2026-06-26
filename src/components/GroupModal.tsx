"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Flag } from "@/components/Flag";
import { rowClinchClass, type GroupMatchRow } from "@/components/GroupCard";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { TeamName } from "@/components/TeamName";
import { formatLiveMinute } from "@/lib/liveMinute";
import { calculateMatchScore } from "@/lib/scoring";
import type { GroupClinch, StandingRow } from "@/lib/standings";
import { toSpanish } from "@/lib/teamNames";
import { hasMatchStarted, isPredictionLocked } from "@/lib/timing";

interface Props {
  name: string;
  standings: StandingRow[];
  matches: GroupMatchRow[];
  onClose: () => void;
  qualifyingThirds?: Set<string>;
  clinch?: Map<string, GroupClinch>;
}

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "– – –" : `${h} – ${a}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

export function GroupModal({ name, standings, matches, onClose, qualifyingThirds, clinch }: Props) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950"
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
                  <th className="w-7 pb-1 pr-2 text-center">#</th>
                  <th className="pb-1">Equipo</th>
                  <th className="pb-1 pr-2 text-center">PJ</th>
                  <th className="pb-1 pr-2 text-center">DG</th>
                  <th className="pb-1 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const projected = i < 2 || (i === 2 && (qualifyingThirds?.has(row.team) ?? false));
                  const state = clinch?.get(row.team);
                  return (
                  <tr key={row.team} className={`border-b border-neutral-900 last:border-0${state === "eliminated" ? " opacity-50" : ""}`}>
                    <td className={`w-7 py-1.5 pr-2 text-center tabular-nums text-neutral-500${rowClinchClass(state, projected)}`}>{i + 1}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <Flag team={row.team} />
                        <TeamName team={row.team} />
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-center text-neutral-400">{row.played}</td>
                    <td className="py-1.5 pr-2 text-center text-neutral-400">
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className="py-1.5 text-center font-semibold">{row.points}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Partidos */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Partidos
            </h3>
            {[...matches]
              .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
              .map((match) => {
              const locked = isPredictionLocked(match.kickoff_at);
              const started = match.status === "live" || hasMatchStarted(match.kickoff_at);
              const finished = match.status === "finished";
              const canPredict = match.is_active && !locked;
              const homeEs = toSpanish(match.home_team);
              const awayEs = toSpanish(match.away_team);

              // Puntos provisionales del partido en vivo (lo que ganarías si
              // terminara ahora). Los finalizados usan match.myPoints (scores).
              const liveScore =
                match.status === "live" &&
                match.home_score !== null &&
                match.away_score !== null &&
                match.pred &&
                match.pred.predicted_home !== null &&
                match.pred.predicted_away !== null
                  ? calculateMatchScore(
                      {
                        round: "group_stage",
                        home_score: match.home_score,
                        away_score: match.away_score,
                        winner: null,
                      },
                      {
                        predicted_home: match.pred.predicted_home,
                        predicted_away: match.pred.predicted_away,
                        predicted_winner: null,
                      },
                    )
                  : null;

              return (
                <div key={match.id} className="rounded-xl border border-neutral-800 p-3">
                  <div className="mb-3 flex items-start justify-between gap-2 text-xs">
                    {/* Izquierda: fecha + estado (EN VIVO / Final / cuenta regresiva). */}
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-neutral-500">
                      <span className="truncate">{fmtDate(match.kickoff_at)}</span>
                      {finished ? (
                        <span className="font-medium text-neutral-400">Final</span>
                      ) : match.status === "live" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                          <span className="font-medium text-red-400">
                            EN VIVO
                            {formatLiveMinute(match.live_minute)
                              ? ` · ${formatLiveMinute(match.live_minute)}`
                              : ""}
                          </span>
                        </span>
                      ) : started ? (
                        <span>Empezó</span>
                      ) : locked ? (
                        <span>Cerrado</span>
                      ) : (
                        <LockCountdown kickoffAt={match.kickoff_at} />
                      )}
                    </span>
                    {/* Derecha: mi predicción (en partidos ya no editables). */}
                    {!canPredict && (
                      <span className="shrink-0 text-right text-neutral-500">
                        {match.pred &&
                        match.pred.predicted_home !== null &&
                        match.pred.predicted_away !== null ? (
                          <>
                            Mi predicción:{" "}
                            <span className="font-medium tabular-nums text-neutral-300">
                              {match.pred.predicted_home}–{match.pred.predicted_away}
                            </span>
                          </>
                        ) : (
                          <span className="text-neutral-600">Sin predicción</span>
                        )}
                      </span>
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
                      {/* Nombres en mobile (fila separada): el marcador no deja espacio inline */}
                      <div className="mb-2 flex items-center justify-between font-medium sm:hidden">
                        <span className="flex items-center gap-1.5">
                          <Flag team={match.home_team} className="shrink-0" />
                          <span className="truncate">{homeEs}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{awayEs}</span>
                          <Flag team={match.away_team} className="shrink-0" />
                        </span>
                      </div>
                      <div className="flex justify-center sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-1">
                        <div className="hidden min-w-0 items-center justify-end gap-1.5 sm:flex">
                          <span className="truncate text-right">{homeEs}</span>
                          <Flag team={match.home_team} className="shrink-0" />
                        </div>
                        <div className="flex flex-col items-center px-2">
                          <span className="whitespace-nowrap text-xl font-bold tabular-nums text-neutral-100">
                            {finished || match.status === "live"
                              ? fmt(match.home_score, match.away_score)
                              : "vs"}
                          </span>
                        </div>
                        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                          <Flag team={match.away_team} className="shrink-0" />
                          <span className="truncate">{awayEs}</span>
                        </div>
                      </div>
                      {(match.myPoints !== undefined || (finished && match.pred !== null) || liveScore !== null) && (
                        <div className="mt-2 text-center">
                          {finished ? (
                            match.myPoints && match.myPoints > 0 ? (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                                +{match.myPoints} puntos
                              </span>
                            ) : (
                              <span className="rounded bg-neutral-500/15 px-1.5 py-0.5 text-xs font-medium text-neutral-500">0 puntos</span>
                            )
                          ) : liveScore && liveScore.points > 0 ? (
                            <span className="animate-pulse rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                              +{liveScore.points} puntos
                            </span>
                          ) : (
                            <span className="rounded bg-neutral-500/15 px-1.5 py-0.5 text-xs font-medium text-neutral-500">0 puntos</span>
                          )}
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
    </div>,
    document.body,
  );
}
