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
// Eliminatorias (marcador a 90'):
//   5 pts — exacto a 90' + clasificado                → exact_qualifier_score
//   3 pts — tipo + diferencia + clasificado (decisivo) → correct_diff_qualifier
//          — empate a 90' + clasificado (la diff de un empate siempre coincide) → correct_diff_qualifier
//          — empate EXACTO a 90' sin clasificado       → correct_diff_qualifier
//   2 pts — solo clasificado correcto (resultado decisivo) → correct_qualifier
//          — empate a 90' acertado (no exacto) sin clasificado → correct_draw

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

/**
 * Clasificado PROVISIONAL de un partido de eliminatoria EN VIVO, para proyectar
 * los puntos mientras se juega: el equipo que va ganando sería el que clasifica
 * si terminara ahora. Si va empatado, devuelve null (el empate a 90' puntúa por
 * sí solo, sin asumir un clasificado). En fase de grupos no aplica.
 */
export function liveKnockoutWinner(
  round: Round,
  homeScore: number,
  awayScore: number,
): MatchWinner | null {
  if (round === "group_stage") return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return null;
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

  // Eliminatorias. El marcador es a 90'. Un empate a 90' acertado puntúa aunque
  // NO se acierte el clasificado; los resultados decisivos sí necesitan el
  // clasificado correcto.
  const qualifierCorrect =
    prediction.predicted_winner !== null &&
    match.winner !== null &&
    prediction.predicted_winner === match.winner;

  const bothDraw = actualOutcome === "draw" && predictedOutcome === "draw";

  if (bothDraw) {
    // Empate a 90' acertado. La diferencia de goles de un empate SIEMPRE coincide
    // (0 = 0); por eso, con el clasificado correcto cuenta como "tipo + misma
    // diferencia + clasificado" (3 pts), no solo "clasificado" (2):
    //   exacto + clasificado          → 5 (exact_qualifier_score)
    //   no exacto + clasificado       → 3 (correct_diff_qualifier)
    //   exacto sin clasificado        → 3 (empate exacto a 90' igual puntúa)
    //   no exacto sin clasificado     → 2 (correct_draw: el empate a 90' acertado)
    if (exactScore && qualifierCorrect) {
      return { points: POINTS.EXACT, reason: "exact_qualifier_score" };
    }
    if (qualifierCorrect) return { points: POINTS.DIFF, reason: "correct_diff_qualifier" };
    if (exactScore) return { points: POINTS.DIFF, reason: "correct_diff_qualifier" };
    return { points: POINTS.WINNER, reason: "correct_draw" };
  }

  // Resultado decisivo a 90': sin acertar el clasificado no hay puntos.
  if (!qualifierCorrect) return null;
  if (exactScore) return { points: POINTS.EXACT, reason: "exact_qualifier_score" };
  if (sameDiff) return { points: POINTS.DIFF, reason: "correct_diff_qualifier" };
  return { points: POINTS.WINNER, reason: "correct_qualifier" };
}
