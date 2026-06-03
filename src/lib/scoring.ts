// ============================================================
// Pollon — Lógica de puntuación (función pura, testeable)
// ============================================================
// Reglas del CLAUDE.md:
//
// Fase de grupos (excluyente):
//   - 3 pts marcador exacto
//   - 1 pt  ganador/empate correcto sin marcador exacto
//
// Eliminatorias (se suman, máx 4):
//   - 2 pts acertar quién clasifica
//   - 2 pts marcador exacto a 90 min
//
// Como `scores` tiene UNIQUE(user_id, pool_id, match_id), se guarda UNA
// fila por partido. La `reason` resume la combinación:
//   - exact_qualifier_score : exacto + clasificado (4 pts)
//   - exact_score           : exacto (grupo 3 pts; elim solo-exacto 2 pts)
//   - correct_winner        : ganador correcto en grupos (1 pt)
//   - correct_draw          : empate correcto en grupos (1 pt)
//   - correct_qualifier     : solo clasificado en elim (2 pts)

import { POINTS } from "@/lib/constants";
import type { MatchWinner, Round, ScoreReason } from "@/types";

export interface ScoredMatch {
  round: Round;
  home_score: number | null;
  away_score: number | null;
  winner: MatchWinner | null;
}

export interface ScoredPrediction {
  predicted_home: number | null;
  predicted_away: number | null;
  predicted_winner: MatchWinner | null;
}

export interface MatchScore {
  points: number;
  reason: ScoreReason;
}

type Outcome = "home" | "away" | "draw";

function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Calcula el puntaje de un partido finalizado para una predicción.
 * Devuelve `null` si el partido no tiene resultado, la predicción está
 * incompleta, o no se anota ningún punto.
 */
export function calculateMatchScore(
  match: ScoredMatch,
  prediction: ScoredPrediction,
): MatchScore | null {
  if (match.home_score === null || match.away_score === null) return null;
  if (prediction.predicted_home === null || prediction.predicted_away === null) {
    return null;
  }

  const exactScore =
    prediction.predicted_home === match.home_score &&
    prediction.predicted_away === match.away_score;

  if (match.round === "group_stage") {
    if (exactScore) {
      return { points: POINTS.GROUP_EXACT, reason: "exact_score" };
    }
    const actual = outcomeOf(match.home_score, match.away_score);
    const predicted = outcomeOf(
      prediction.predicted_home,
      prediction.predicted_away,
    );
    if (actual === predicted) {
      return {
        points: POINTS.GROUP_WINNER,
        reason: actual === "draw" ? "correct_draw" : "correct_winner",
      };
    }
    return null;
  }

  // Eliminatorias
  const qualifierCorrect =
    prediction.predicted_winner !== null &&
    match.winner !== null &&
    prediction.predicted_winner === match.winner;

  let points = 0;
  if (qualifierCorrect) points += POINTS.ELIM_QUALIFIER;
  if (exactScore) points += POINTS.ELIM_EXACT;

  if (points === 0) return null;

  let reason: ScoreReason;
  if (qualifierCorrect && exactScore) reason = "exact_qualifier_score";
  else if (exactScore) reason = "exact_score";
  else reason = "correct_qualifier";

  return { points, reason };
}
