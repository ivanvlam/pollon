// ============================================================
// Constantes del proyecto Pollon
// ============================================================

/** Horas antes del kickoff en que se cierran las predicciones de partidos. Debe coincidir con v_lock_hours en submit_prediction. */
export const LOCK_HOURS_BEFORE_KICKOFF = 1;

/**
 * Horas antes del PRIMER partido en que se cierra la predicción de campeón y
 * goleador. Negativo = DESPUÉS del kickoff. Hoy = -2 → cierra 2h después del
 * inicio del primer partido. Debe coincidir con v_lock_hours en submit_champion
 * y con el offset de specials_revealed (la revelación de picks ajenos ocurre en
 * el mismo instante que el cierre, por fairness).
 */
export const CHAMPION_LOCK_HOURS = -2;

/** Puntos por acertar el campeón del Mundial. */
export const CHAMPION_POINTS = 15;

/** Puntos por acertar el goleador del Mundial. */
export const TOP_SCORER_POINTS = 10;

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
