// ============================================================
// Pollon — Lógica de puntuación (función pura, testeable)
// ============================================================
// Sistema de puntos (excluyente, se aplica el nivel más alto):
//
// Fase de grupos:
//   5 pts — marcador exacto                          → exact_score
//   3 pts — tipo correcto + misma diferencia de goles → correct_diff
//   2 pts — solo tipo correcto (ganador/empate)       → correct_winner / correct_draw
//
// Eliminatorias:
//   5 pts — marcador exacto a 90 min + clasificado   → exact_qualifier_score
//   3 pts — tipo + diferencia correcta + clasificado  → correct_diff_qualifier
//   2 pts — solo clasificado correcto                 → correct_qualifier

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

  const actualDiff = match.home_score - match.away_score;
  const predictedDiff = prediction.predicted_home - prediction.predicted_away;
  const sameDiff = actualDiff === predictedDiff;

  const actualOutcome = outcomeOf(match.home_score, match.away_score);
  const predictedOutcome = outcomeOf(prediction.predicted_home, prediction.predicted_away);
  const sameOutcome = actualOutcome === predictedOutcome;

  if (match.round === "group_stage") {
    if (exactScore) return { points: POINTS.EXACT, reason: "exact_score" };
    if (sameDiff) return { points: POINTS.DIFF, reason: "correct_diff" };
    if (sameOutcome) {
      return {
        points: POINTS.WINNER,
        reason: actualOutcome === "draw" ? "correct_draw" : "correct_winner",
      };
    }
    return null;
  }

  // Eliminatorias: sin clasificado correcto no hay puntos
  const qualifierCorrect =
    prediction.predicted_winner !== null &&
    match.winner !== null &&
    prediction.predicted_winner === match.winner;

  if (!qualifierCorrect) return null;

  if (exactScore) return { points: POINTS.EXACT, reason: "exact_qualifier_score" };
  if (sameDiff) return { points: POINTS.DIFF, reason: "correct_diff_qualifier" };
  return { points: POINTS.WINNER, reason: "correct_qualifier" };
}
