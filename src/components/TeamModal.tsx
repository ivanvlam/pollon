"use client";

import { Flag } from "@/components/Flag";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUND_LABELS } from "@/lib/labels";
import { formatLiveMinute } from "@/lib/liveMinute";
import type { StandingRow } from "@/lib/standings";
import type { TeamProgress } from "@/lib/teamProgress";
import { toSpanish } from "@/lib/teamNames";
import type { Round } from "@/types";

interface TeamMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_pen?: number | null;
  away_pen?: number | null;
  is_active: boolean;
  live_minute: string | null;
  group_name: string | null;
  round?: string | null;
  myPoints?: number;
  pred: {
    predicted_home: number | null;
    predicted_away: number | null;
    predicted_winner: string | null;
  } | null;
}

interface Props {
  team: string;
  standing: StandingRow | null;
  matches: TeamMatch[];
  groupName: string | null;
  position: number | null;
  progress?: TeamProgress | null;
  onClose: () => void;
  onOpenGroup?: () => void;
}

/** Color del estado del torneo según el tipo de avance. */
const PROGRESS_COLOR: Record<TeamProgress["kind"], string> = {
  champion: "text-amber-400",
  alive: "text-emerald-400",
  out: "text-red-400",
  group_out: "text-red-400",
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

export function TeamModal({ team, standing, matches, groupName, position, progress, onClose, onOpenGroup }: Props) {
  const teamEs = toSpanish(team);
  const groupLabel = groupName ? groupName.replace(/^Group\s+/i, "Grupo ") : null;

  // Puntos que el usuario ganó con partidos de este equipo (mismos en cualquier
  // polla; se muestran como en la pestaña de grupos).
  const scoredMatches = matches.filter((m) => m.myPoints !== undefined);
  const totalPoints = scoredMatches.reduce((sum, m) => sum + (m.myPoints ?? 0), 0);

  const stats = standing
    ? [
        ["Partidos jugados", standing.played],
        ["Puntos", standing.points],
        ["Ganados", standing.won],
        ["Goles a favor", standing.gf],
        ["Empatados", standing.drawn],
        ["Goles en contra", standing.ga],
        ["Perdidos", standing.lost],
        ["Diferencia de goles", standing.gd > 0 ? `+${standing.gd}` : standing.gd],
      ]
    : [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[60] flex max-h-[85dvh] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border-neutral-700 bg-neutral-950 p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Flag team={team} className="h-9 w-14 shrink-0" />
            <div>
              <DialogTitle className="text-xl font-bold">{teamEs}</DialogTitle>
              {progress && (
                <p className={`text-sm font-semibold ${PROGRESS_COLOR[progress.kind]}`}>
                  {progress.label}
                </p>
              )}
              {groupLabel && (
                <p className="text-xs text-neutral-500">
                  {onOpenGroup ? (
                    <button
                      type="button"
                      onClick={onOpenGroup}
                      className="underline-offset-2 transition-colors hover:text-neutral-300 hover:underline"
                    >
                      {groupLabel}
                    </button>
                  ) : (
                    groupLabel
                  )}
                  {position !== null && (
                    <>
                      {" · "}
                      <span className="text-neutral-400">{position}° puesto</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Stats grid */}
          {standing ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Estadísticas
              </p>
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 rounded-xl bg-neutral-900 p-4">
                {stats.map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-neutral-400">{label}</span>
                    <span
                      className={`text-base font-bold tabular-nums ${label === "Puntos" ? "text-emerald-400" : "text-neutral-100"}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Sin datos de fase de grupos.</p>
          )}

          {/* Partidos */}
          {matches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Partidos
                </p>
                {scoredMatches.length > 0 && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      totalPoints > 0
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-neutral-500/15 text-neutral-500"
                    }`}
                  >
                    {totalPoints} {totalPoints === 1 ? "punto" : "puntos"} con {teamEs}
                  </span>
                )}
              </div>
              {matches.map((match) => {
                const finished = match.status === "finished";
                const live = match.status === "live";
                const homeEs = toSpanish(match.home_team);
                const awayEs = toSpanish(match.away_team);

                return (
                  <div key={match.id} className="rounded-xl border border-neutral-800 p-3">
                    <div className="mb-2.5 flex items-start justify-between gap-2 text-xs">
                      {/* Izquierda: fecha + estado (EN VIVO). */}
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-neutral-500">
                        {match.round && match.round !== "group_stage" && (
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                            {ROUND_LABELS[match.round as Round]}
                          </span>
                        )}
                        <span className="truncate">{fmtDate(match.kickoff_at)}</span>
                        {live ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                            <span className="font-medium text-red-400">
                              EN VIVO
                              {formatLiveMinute(match.live_minute)
                                ? ` · ${formatLiveMinute(match.live_minute)}`
                                : ""}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      {/* Derecha: mi predicción. */}
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
                    </div>

                    <div className="text-sm">
                      {/* Nombres en mobile (fila separada): el marcador no deja espacio inline */}
                      <div className="mb-2 flex items-center justify-between font-medium sm:hidden">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Flag team={match.home_team} className="shrink-0" />
                          <span className="truncate">{homeEs}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{awayEs}</span>
                          <Flag team={match.away_team} className="shrink-0" />
                        </span>
                      </div>
                      <div className="flex justify-center sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-2">
                        <div className="hidden min-w-0 items-center justify-end gap-1.5 sm:flex">
                          <span className="truncate text-right font-medium leading-tight">{homeEs}</span>
                          <Flag team={match.home_team} className="shrink-0" />
                        </div>
                        <div className="flex flex-col items-center px-3 text-center">
                          {live || match.home_score !== null ? (
                            <span className="text-xl font-bold tabular-nums text-neutral-200">
                              {match.home_score ?? 0} – {match.away_score ?? 0}
                            </span>
                          ) : (
                            <span className="text-neutral-600">vs</span>
                          )}
                          {match.home_pen != null && match.away_pen != null && (
                            <span className="whitespace-nowrap text-[10px] font-medium text-neutral-400">
                              ({match.home_pen}-{match.away_pen} pen.)
                            </span>
                          )}
                        </div>
                        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                          <Flag team={match.away_team} className="shrink-0" />
                          <span className="truncate font-medium leading-tight">{awayEs}</span>
                        </div>
                      </div>
                    </div>

                    {match.myPoints !== undefined && (
                      <div className="mt-2 flex justify-center">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            match.myPoints > 0
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-neutral-500/15 text-neutral-500"
                          }`}
                        >
                          {match.myPoints > 0 ? `+${match.myPoints}` : "0"}{" "}
                          {match.myPoints === 1 ? "punto" : "puntos"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
