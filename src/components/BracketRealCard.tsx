"use client";

import { useRouter } from "next/navigation";

import { Flag } from "@/components/Flag";
import { TeamName } from "@/components/TeamName";
import type { MatchWinner } from "@/types";

interface BracketRealCardProps {
  match: {
    id: string;
    home_team: string;
    away_team: string;
    status: string;
    kickoff_at: string;
    home_score: number | null;
    away_score: number | null;
    home_pen: number | null;
    away_pen: number | null;
    winner: string | null;
  };
  matchNum: number;
  pred: { predicted_home: number | null; predicted_away: number | null; predicted_winner: string | null } | null;
  poolId: string;
  /** Fecha ya formateada en el server (la timezone del usuario). */
  date: string;
}

/**
 * Tarjeta de un partido eliminatorio ya cargado (octavos+). Es clickeable y
 * lleva a la predicción del partido, pero los nombres de equipo abren su modal
 * (TeamName) sin navegar — por eso la tarjeta es un div con router.push en vez
 * de un <Link>: un <button> de TeamName no puede anidarse dentro de un <a>.
 */
export function BracketRealCard({ match, matchNum, pred, poolId, date }: BracketRealCardProps) {
  const router = useRouter();
  const href = `/pool/${poolId}/predictions#m-${match.id}`;
  const finished = match.status === "finished";
  const homeVal = finished ? match.home_score : (pred?.predicted_home ?? null);
  const awayVal = finished ? match.away_score : (pred?.predicted_away ?? null);
  const actualWinner: MatchWinner | null = finished ? (match.winner as MatchWinner | null) : null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(href);
      }}
      className="block w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs transition hover:border-neutral-700 hover:bg-neutral-800/60"
    >
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium">Partido {matchNum}</span>
        <span className="text-neutral-500">{date}</span>
      </div>
      <TeamRow team={match.home_team} value={homeVal} pen={finished ? match.home_pen : null} lost={actualWinner === "away"} />
      <div className="my-1 border-t border-neutral-800" />
      <TeamRow team={match.away_team} value={awayVal} pen={finished ? match.away_pen : null} lost={actualWinner === "home"} />
      <p className="mt-1 text-[10px] text-neutral-500">
        {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
      </p>
    </div>
  );
}

function TeamRow({
  team,
  value,
  pen,
  lost,
}: {
  team: string;
  value: number | null;
  pen?: number | null;
  lost: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-1 text-neutral-200 ${lost ? "opacity-50" : ""}`}>
      <span className="flex min-w-0 items-center gap-1">
        <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
        <TeamName team={team} className="min-w-0 truncate" />
      </span>
      <span className="tabular-nums">
        {value ?? "–"}
        {pen != null && <span className="text-neutral-400"> ({pen})</span>}
      </span>
    </div>
  );
}
