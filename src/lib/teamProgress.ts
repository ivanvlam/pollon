// ============================================================
// Pollon — Avance de un equipo en el torneo (función pura)
// ============================================================
// Calcula hasta dónde llegó un equipo, para mostrarlo como protagonista en el
// perfil de equipo (TeamModal). El partido KO más avanzado del equipo determina
// por completo su estado: no se puede tener un partido posterior a una derrota.

import { ROUND_LABELS } from "@/lib/labels";
import type { MatchWinner, Round } from "@/types";

export type TeamProgressKind = "group_out" | "alive" | "out" | "champion";

export interface TeamProgress {
  label: string;
  kind: TeamProgressKind;
}

/** Datos mínimos de un partido KO para calcular el avance. */
export interface KoMatchForProgress {
  round: Round;
  home_team: string;
  away_team: string;
  status: string; // "scheduled" | "live" | "finished"
  winner: MatchWinner | null;
}

/** Orden de las rondas eliminatorias. */
const KO_ORDER: Round[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
];

const lower = (round: Round) => ROUND_LABELS[round].toLowerCase();

export function computeTeamProgress(params: {
  team: string;
  qualifiedFromGroup: boolean;
  koMatches: KoMatchForProgress[];
}): TeamProgress {
  const { team, qualifiedFromGroup, koMatches } = params;

  const mine = koMatches
    .filter((m) => m.home_team === team || m.away_team === team)
    .sort((a, b) => KO_ORDER.indexOf(a.round) - KO_ORDER.indexOf(b.round));

  if (mine.length === 0) {
    // Sin partidos KO cargados: o no clasificó, o clasificó y el cruce todavía
    // no está en la DB.
    return qualifiedFromGroup
      ? { label: "Clasificado a dieciseisavos", kind: "alive" }
      : { label: "Eliminado en fase de grupos", kind: "out" };
  }

  // El partido más avanzado define el estado.
  const last = mine[mine.length - 1]!;
  const decided = last.status === "finished" && last.winner !== null;

  if (!decided) {
    // Jugando o esperando esta ronda.
    return { label: `En ${lower(last.round)}`, kind: "alive" };
  }

  const side: MatchWinner = last.home_team === team ? "home" : "away";
  const won = last.winner === side;

  if (won) {
    if (last.round === "final") return { label: "Campeón", kind: "champion" };
    const next = KO_ORDER[KO_ORDER.indexOf(last.round) + 1]!;
    return { label: `Clasificado a ${lower(next)}`, kind: "alive" };
  }

  if (last.round === "final") return { label: "Subcampeón", kind: "out" };
  return { label: `Eliminado en ${lower(last.round)}`, kind: "out" };
}
