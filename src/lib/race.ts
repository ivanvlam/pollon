// ============================================================
// Pollon — Carrera del historial (función pura, testeable)
// ============================================================
// Convierte la evolución partido a partido (los mismos datos que arma la página
// de historial) en frames de una "carrera de autos". NO toca el DOM ni SQL.
//
// Modelo de avance (ver constantes RACE_DRIFT y TOTAL_TOURNAMENT_MATCHES):
//   raw_i,k  = drift·(k+1) + puntosAcumulados_i,k        // aditivo
//   pos_i,k  = (raw_i,k / rawLíderFinal) · (jugados/104)  // 0 .. jugados/104
// Propiedades:
//   - Deriva constante y lenta: el término drift·(k+1) avanza a todos un poco
//     cada partido, aunque no sumen.
//   - Salto grande proporcional: entre frames Δpos ∝ (drift + puntosGanados),
//     así un acierto de 5 salta ~5× un partido sin puntos.
//   - El 1° (más puntos al final) llega justo a `jugados/104`; toca la meta
//     (x = 1) solo cuando se jugaron los 104 partidos del torneo.

import { RACE_DRIFT, TOTAL_TOURNAMENT_MATCHES } from "./constants";

export interface RaceHistoryPoint {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string;
  /** Puntos acumulados por userId tras este partido. */
  cumulativePoints: Record<string, number>;
  /** Puntos ganados por userId en este partido (0 si no sumó). */
  pointsEarned: Record<string, number>;
}

export interface RaceMember {
  id: string;
  name: string;
}

export interface RaceCar {
  userId: string;
  /** Posición en la pista: 0..1 (1 = meta = vuelta completa de los 104). */
  x: number;
  /** Puntos acumulados tras este partido. */
  points: number;
  /** Puntos ganados en este partido (para el badge "+N"). 0 si no sumó. */
  gained: number;
  /** Posición en la tabla tras este partido (1 = líder). */
  rank: number;
}

export interface RaceFrame {
  /** Partidos jugados hasta e incluyendo este (1-indexed). */
  played: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string;
  cars: RaceCar[];
}

export interface RaceData {
  frames: RaceFrame[];
  totalMatches: number;
  /** Posición final del líder en la pista (0..1) = partidosJugados / total. */
  leaderFinalX: number;
}

export interface ComputeRaceInput {
  history: RaceHistoryPoint[];
  members: RaceMember[];
  totalMatches?: number;
  drift?: number;
}

export function computeRaceFrames({
  history,
  members,
  totalMatches = TOTAL_TOURNAMENT_MATCHES,
  drift = RACE_DRIFT,
}: ComputeRaceInput): RaceData {
  const ids = members.map((m) => m.id);
  const K = history.length; // partidos jugados
  const playedFrac = totalMatches > 0 ? Math.min(K / totalMatches, 1) : 0;

  // Denominador: raw del líder (más puntos) en el ÚLTIMO partido jugado. Así su
  // auto cae justo en `playedFrac` y la escala es estable en todos los frames.
  const lastPoint = K > 0 ? history[K - 1]! : null;
  const maxFinalPoints = lastPoint
    ? Math.max(0, ...ids.map((id) => lastPoint.cumulativePoints[id] ?? 0))
    : 0;
  const rawLeaderFinal = drift * K + maxFinalPoints || 1; // evita /0

  const frames: RaceFrame[] = history.map((h, k) => {
    // Rank por puntos acumulados (desc); empate estabilizado por id.
    const ranked = [...ids].sort((a, b) => {
      const pa = h.cumulativePoints[a] ?? 0;
      const pb = h.cumulativePoints[b] ?? 0;
      return pb - pa || a.localeCompare(b);
    });
    const rankOf = new Map<string, number>();
    ranked.forEach((id, i) => rankOf.set(id, i + 1));

    const cars: RaceCar[] = ids.map((uid) => {
      const points = h.cumulativePoints[uid] ?? 0;
      const raw = drift * (k + 1) + points;
      return {
        userId: uid,
        x: (raw / rawLeaderFinal) * playedFrac,
        points,
        gained: h.pointsEarned[uid] ?? 0,
        rank: rankOf.get(uid) ?? ids.length,
      };
    });

    return {
      played: k + 1,
      homeTeam: h.homeTeam,
      awayTeam: h.awayTeam,
      homeScore: h.homeScore,
      awayScore: h.awayScore,
      kickoffAt: h.kickoffAt,
      cars,
    };
  });

  return { frames, totalMatches, leaderFinalX: playedFrac };
}
