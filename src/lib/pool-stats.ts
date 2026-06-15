// ============================================================
// Pollon — Estadísticas de una polla (función pura, testeable)
// ============================================================
// Calcula métricas de desempeño por jugador a partir de los datos que ya expone
// la polla (ranking, scores por partido y predicciones en partidos terminados).
// NO incluye SQL: recibe filas planas y devuelve el resumen.
//
// Notas de diseño:
//  - El promedio y el % de acierto usan SOLO puntos de partido (excluyen los
//    15/10 de campeón/goleador, que no son por partido).
//  - Racha = partidos terminados seguidos (en orden de kickoff) sumando >0 pts.
//    Cualquier 0 (fallado o no predicho) corta la racha.

/** Mínimo de partidos predichos para entrar en los récords de promedio/acierto.
 *  Evita que gane alguien con 1 sola predicción acertada. Se acota a la cantidad
 *  de partidos terminados cuando aún hay pocos. */
export const MIN_MATCHES_FOR_RECORD = 5;

export interface StatsMember {
  userId: string;
  displayName: string;
  /** Del ranking: total general (incluye campeón/goleador). */
  total: number;
  exactCount: number;
  diffCount: number;
  winnerCount: number;
  championCorrect: boolean;
}

export interface StatsInput {
  members: StatsMember[];
  /** IDs de partidos terminados, en orden cronológico (kickoff asc). */
  finishedMatchIds: string[];
  /** Puntos por (userId, matchId) — solo partidos que sumaron >0. */
  scores: { userId: string; matchId: string; points: number }[];
  /** Pares (userId, matchId) de partidos terminados que el jugador predijo. */
  predictions: { userId: string; matchId: string }[];
}

export interface MemberStats {
  userId: string;
  displayName: string;
  total: number;
  /** Suma de puntos de partido (sin campeón/goleador). */
  matchPoints: number;
  /** Partidos terminados que predijo. */
  predictedFinished: number;
  /** Partidos predichos en los que sumó >0. */
  hitCount: number;
  /** hitCount / predictedFinished (0 si no predijo nada). */
  accuracy: number;
  /** matchPoints / predictedFinished (0 si no predijo nada). */
  avgPerPredicted: number;
  longestStreak: number;
  currentStreak: number;
  exactCount: number;
  diffCount: number;
  winnerCount: number;
  championCorrect: boolean;
}

export interface Leader<V> {
  value: V;
  members: { userId: string; displayName: string }[];
}

export interface PoolStats {
  members: MemberStats[];
  totalFinished: number;
  /** Líderes (puede haber empate → varios). null si nadie califica. */
  longestStreak: Leader<number> | null;
  bestAvg: Leader<number> | null;
  bestAccuracy: Leader<number> | null;
}

/** Construye un set de matchIds predichos por usuario. */
function predictedSet(predictions: StatsInput["predictions"]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const p of predictions) {
    let set = map.get(p.userId);
    if (!set) {
      set = new Set();
      map.set(p.userId, set);
    }
    set.add(p.matchId);
  }
  return map;
}

/** Puntos por usuario→(matchId→points). */
function pointsMap(scores: StatsInput["scores"]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const s of scores) {
    let inner = map.get(s.userId);
    if (!inner) {
      inner = new Map();
      map.set(s.userId, inner);
    }
    inner.set(s.matchId, (inner.get(s.matchId) ?? 0) + s.points);
  }
  return map;
}

/** Recorre los partidos terminados en orden y calcula racha máxima y actual.
 *  Un partido suma a la racha solo si el jugador anotó >0 puntos ahí. */
function streaks(
  finishedMatchIds: string[],
  userPoints: Map<string, number> | undefined,
): { longest: number; current: number } {
  let longest = 0;
  let current = 0;
  for (const matchId of finishedMatchIds) {
    const pts = userPoints?.get(matchId) ?? 0;
    if (pts > 0) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return { longest, current };
}

export function computePoolStats(input: StatsInput): PoolStats {
  const totalFinished = input.finishedMatchIds.length;
  const predicted = predictedSet(input.predictions);
  const points = pointsMap(input.scores);

  const members: MemberStats[] = input.members.map((m) => {
    const userPoints = points.get(m.userId);
    const predictedFinished = predicted.get(m.userId)?.size ?? 0;

    // Puntos de partido y aciertos (solo partidos terminados).
    let matchPoints = 0;
    let hitCount = 0;
    if (userPoints) {
      for (const matchId of input.finishedMatchIds) {
        const pts = userPoints.get(matchId) ?? 0;
        if (pts > 0) {
          matchPoints += pts;
          hitCount += 1;
        }
      }
    }

    const { longest, current } = streaks(input.finishedMatchIds, userPoints);

    return {
      userId: m.userId,
      displayName: m.displayName,
      total: m.total,
      matchPoints,
      predictedFinished,
      hitCount,
      accuracy: predictedFinished > 0 ? hitCount / predictedFinished : 0,
      avgPerPredicted: predictedFinished > 0 ? matchPoints / predictedFinished : 0,
      longestStreak: longest,
      currentStreak: current,
      exactCount: m.exactCount,
      diffCount: m.diffCount,
      winnerCount: m.winnerCount,
      championCorrect: m.championCorrect,
    };
  });

  // Umbral para récords de promedio/acierto: no premiar a quien predijo casi nada.
  const minForRecord = Math.min(MIN_MATCHES_FOR_RECORD, totalFinished);

  return {
    members,
    totalFinished,
    longestStreak: bestLeader(
      members.filter((m) => m.longestStreak > 0),
      (m) => m.longestStreak,
    ),
    bestAvg: bestLeader(
      members.filter((m) => m.predictedFinished >= minForRecord && m.predictedFinished > 0),
      (m) => m.avgPerPredicted,
    ),
    bestAccuracy: bestLeader(
      members.filter((m) => m.predictedFinished >= minForRecord && m.predictedFinished > 0),
      (m) => m.accuracy,
    ),
  };
}

/** Devuelve el líder (o empatados) según `value`, o null si no hay candidatos. */
function bestLeader(
  candidates: MemberStats[],
  value: (m: MemberStats) => number,
): Leader<number> | null {
  if (candidates.length === 0) return null;
  let best = -Infinity;
  for (const m of candidates) {
    const v = value(m);
    if (v > best) best = v;
  }
  if (best <= 0) return null;
  const winners = candidates.filter((m) => value(m) === best);
  return {
    value: best,
    members: winners.map((m) => ({ userId: m.userId, displayName: m.displayName })),
  };
}
