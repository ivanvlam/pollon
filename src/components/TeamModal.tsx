"use client";

import { useEffect } from "react";

import { Flag } from "@/components/Flag";
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
  group_name: string | null;
}

interface Props {
  team: string;
  standing: StandingRow | null;
  matches: TeamMatch[];
  groupName: string | null;
  onClose: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

export function TeamModal({ team, standing, matches, groupName, onClose }: Props) {
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
  const groupLabel = groupName
    ? groupName.replace(/^Group\s+/i, "Grupo ")
    : null;

  const stats = standing
    ? [
        ["PJ", standing.played],
        ["PG", standing.won],
        ["PE", standing.drawn],
        ["PP", standing.lost],
        ["GF", standing.gf],
        ["GC", standing.ga],
        ["DG", standing.gd > 0 ? `+${standing.gd}` : standing.gd],
        ["Pts", standing.points],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-neutral-700 bg-neutral-950 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Flag team={team} className="h-6 w-9 shrink-0" />
            <div>
              <h2 className="text-base font-semibold">{teamEs}</h2>
              {groupLabel && (
                <p className="text-xs text-neutral-500">{groupLabel}</p>
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
          {standing ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Estadísticas
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {stats.map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex flex-col items-center gap-0.5 rounded-lg bg-neutral-900 py-2.5"
                  >
                    <span className="text-[10px] text-neutral-500">{label}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${label === "Pts" ? "text-emerald-400" : ""}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Sin datos de fase de grupos.
            </p>
          )}

          {matches.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Partidos
              </p>
              <div className="flex flex-col gap-2">
                {matches.map((match) => {
                  const isHome = match.home_team === team;
                  const opponent = isHome ? match.away_team : match.home_team;
                  const myScore = isHome ? match.home_score : match.away_score;
                  const oppScore = isHome ? match.away_score : match.home_score;
                  const finished = match.status === "finished";

                  let outcome: "G" | "E" | "P" | null = null;
                  if (finished && myScore !== null && oppScore !== null) {
                    if (myScore > oppScore) outcome = "G";
                    else if (myScore < oppScore) outcome = "P";
                    else outcome = "E";
                  }

                  const outcomeClass =
                    outcome === "G"
                      ? "text-emerald-400"
                      : outcome === "P"
                        ? "text-red-400"
                        : "text-neutral-400";

                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Flag team={opponent} className="shrink-0" />
                        <span className="text-neutral-200">
                          {toSpanish(opponent)}
                        </span>
                        <span className="text-[10px] text-neutral-600">
                          {isHome ? "L" : "V"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {finished && myScore !== null && oppScore !== null ? (
                          <>
                            <span className="tabular-nums font-medium text-neutral-200">
                              {myScore}–{oppScore}
                            </span>
                            <span
                              className={`w-3 text-center text-xs font-bold ${outcomeClass}`}
                            >
                              {outcome}
                            </span>
                          </>
                        ) : match.status === "live" ? (
                          <span className="text-xs font-medium text-red-400">
                            EN VIVO
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">
                            {fmtDate(match.kickoff_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
