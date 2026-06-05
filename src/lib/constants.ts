// ============================================================
// Constantes del proyecto Pollon
// ============================================================

/** Horas antes del kickoff en que se cierran las predicciones de partidos. 0 = cierra al inicio. */
export const LOCK_HOURS_BEFORE_KICKOFF = 0;

/** Horas antes del PRIMER partido en que se cierra la predicción de campeón. */
export const CHAMPION_LOCK_HOURS = 1;

/** Puntos por acertar el campeón del Mundial. */
export const CHAMPION_POINTS = 15;

/** Tabla de puntos del sistema de puntuación. */
export const POINTS = {
  /** Marcador exacto (grupos) / exacto + clasificado (eliminatorias). */
  EXACT: 5,
  /** Tipo de resultado correcto + misma diferencia de goles. */
  DIFF: 3,
  /** Solo tipo de resultado correcto (ganador/empate) o solo clasificado. */
  WINNER: 2,
} as const;

/** Debounce (ms) antes de enviar una predicción desde el frontend. */
export const PREDICTION_DEBOUNCE_MS = 500;

/** Rondas del torneo. */
export const ROUNDS = [
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
] as const;

export type Round = (typeof ROUNDS)[number];

/** Una ronda es eliminatoria si no es fase de grupos. */
export function isKnockoutRound(round: Round): boolean {
  return round !== "group_stage";
}
