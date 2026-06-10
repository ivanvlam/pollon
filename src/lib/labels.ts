// ============================================================
// Pollon — Etiquetas de display compartidas
// ============================================================
// Centraliza las etiquetas en español de rondas y motivos de puntaje para
// reutilizarlas entre vistas (predicciones, perfil de jugador, etc.).

import type { Round } from "@/lib/constants";
import type { ScoreReason } from "@/types";

/** Nombre legible de cada ronda del torneo. */
export const ROUND_LABELS: Record<Round, string> = {
  group_stage: "Fase de grupos",
  round_of_32: "Dieciseisavos de final",
  round_of_16: "Octavos de final",
  quarterfinal: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

/** Etiqueta corta de por qué se otorgaron los puntos. */
export const REASON_LABELS: Record<ScoreReason, string> = {
  exact_score: "Exacto",
  correct_diff: "Diferencia",
  correct_winner: "Ganador",
  correct_draw: "Empate",
  exact_qualifier_score: "Exacto",
  correct_diff_qualifier: "Diferencia",
  correct_qualifier: "Clasificado",
  champion: "Campeón",
  top_scorer: "Goleador",
};
