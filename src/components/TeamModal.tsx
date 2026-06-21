"use client";

import { useEffect } from "react";

import { Flag } from "@/components/Flag";
import { formatLiveMinute } from "@/lib/liveMinute";
import type { StandingRow } from "@/lib/standings";
import { toSpanish } from "@/lib/teamNames";

interface TeamMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  is_active: boolean;
  live_minute: string | null;
  group_name: string | null;
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
  onClose: () => void;
  onOpenGroup?: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

export function TeamModal({ team, standing, matches, groupName, position, onClose, onOpenGroup }: Props) {
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

  const teamEs = toSpanish(team);
  const groupLabel = groupName ? groupName.replace(/^Group\s+/i, "Grupo ") : null;

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Flag team={team} className="h-9 w-14 shrink-0" />
            <div>
              <h2 className="text-xl font-bold">{teamEs}</h2>
              {groupLabel && (
                <p className="text-sm text-neutral-400">
                  {onOpenGroup ? (
                    <button
                      type="button"
                      onClick={onOpenGroup}
                      className="font-medium text-neutral-300 underline-offset-2 transition-colors hover:text-neutral-100 hover:underline"
                    >
                      {groupLabel}
                    </button>
                  ) : (
                    groupLabel
                  )}
                  {position !== null && (
                    <>
                      {" · "}
                      <span className="font-semibold text-neutral-200">
                        {position}° puesto
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

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
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Partidos
              </p>
              {matches.map((match) => {
                const finished = match.status === "finished";
                const live = match.status === "live";
                const homeEs = toSpanish(match.home_team);
                const awayEs = toSpanish(match.away_team);

                return (
                  <div key={match.id} className="rounded-xl border border-neutral-800 p-3">
                    <div className="mb-2.5 flex items-start justify-between gap-2 text-xs text-neutral-500">
                      <span className="min-w-0 truncate">{fmtDate(match.kickoff_at)}</span>
                      {live ? (
                        <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                            <span className="font-medium text-red-400">EN VIVO</span>
                          </span>
                          {formatLiveMinute(match.live_minute) && (
                            <span className="text-neutral-400">
                              {formatLiveMinute(match.live_minute)}
                            </span>
                          )}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-sm">
                      <div className="flex min-w-0 items-center justify-end gap-1.5">
                        <span className="truncate text-right font-medium leading-tight">{homeEs}</span>
                        <Flag team={match.home_team} className="shrink-0" />
                      </div>
                      <div className="px-3 text-center">
                        {live || match.home_score !== null ? (
                          <span className="text-xl font-bold tabular-nums text-neutral-200">
                            {match.home_score ?? 0} – {match.away_score ?? 0}
                          </span>
                        ) : (
                          <span className="text-neutral-600">vs</span>
                        )}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Flag team={match.away_team} className="shrink-0" />
                        <span className="truncate font-medium leading-tight">{awayEs}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
