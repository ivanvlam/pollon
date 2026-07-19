// ============================================================
// Pollon — "Wrapped" del Mundial (resumen tipo Spotify Wrapped)
// ============================================================
// Lógica pura y testeable para el resumen personal de fin de torneo: elige el
// "personaje" del jugador a partir de sus estadísticas y arma el payload que
// consume el componente de stories (`WrappedStory`). NO toca la DB: recibe
// números ya calculados por la página server.

/** Datos que la página server calcula por usuario y pasa al cliente. */
export interface WrappedData {
  poolName: string;
  displayName: string;
  /** Cantidad de jugadores en la polla. */
  memberCount: number;
  /** Puesto final (RANK, no DENSE_RANK). null si no tiene posición. */
  rank: number | null;
  /** Empatado en su puesto con otro(s). */
  tied: boolean;
  /** Puntos totales (incluye campeón/goleador). */
  total: number;
  /** Puntos del líder de la polla (para contextualizar los tuyos). */
  topPoints: number;
  /** Promedio de puntos de la polla. */
  poolAvgPoints: number;
  /** Cuántos jugadores terminaron por debajo de ti (estrictamente). */
  beatCount: number;
  /** Puntos que te separaron del líder (0 si eres el líder). */
  pointsBehindLeader: number;
  exactCount: number;
  diffCount: number;
  winnerCount: number;
  /** Partidos terminados que predijo. */
  predictionCount: number;
  /** Racha más larga (partidos seguidos sumando). */
  longestStreak: number;
  /** Aciertos / partidos predichos (0..1). */
  accuracy: number;
  /** Puntos por partido predicho. */
  avgPerPredicted: number;
  /** El mejor pálpito: el partido donde sumó más puntos. */
  bestPrediction: BestPrediction | null;
  /** Pick de campeón y si acertó. null si no hay pick. */
  champion: SpecialPick | null;
  /** Pick de goleador y si acertó. null si no hay pick. */
  topScorer: SpecialPick | null;
  /** Ganador de la polla (cima del ranking). */
  poolWinner: { name: string; isMe: boolean } | null;
  /** La final ya terminó (el torneo cerró). */
  tournamentFinished: boolean;
  persona: Persona;
  /** Totales globales del proyecto (para la slide de agradecimiento). */
  projectStats: ProjectStats;
}

export interface ProjectStats {
  predictions: number;
  users: number;
  pools: number;
  matchesFinished: number;
}

export interface BestPrediction {
  /** Ronda o grupo legible, ej. "Final" o "Grupo A". */
  context: string;
  /** Fecha del partido, ya formateada en la timezone del viewer. */
  date: string;
  homeTeam: string;
  awayTeam: string;
  /** Resultado final del partido "H-A". */
  finalScore: string;
  /** Lo que predijo "H-A". */
  predictedScore: string;
  points: number;
  /** Etiqueta del motivo, ej. "Exacto". */
  reasonLabel: string;
  /** El pálpito fue un marcador exacto (5 pts). */
  isExact: boolean;
  /** Cuántos OTROS miembros igualaron o superaron tu puntaje en ese partido. */
  alsoNailed: number;
  /** Promedio de puntos del resto de la polla en ese partido (0 si estás solo). */
  othersAvg: number;
}

/** Elige, entre los partidos que el jugador acertó, el pálpito más
 *  diferenciador: prioriza los exactos y, dentro de ellos, aquel donde el resto
 *  de la polla sacó mucho menos (mayor brecha) y menos gente lo clavó. Devuelve
 *  el índice ganador de `candidates`, o -1 si no hay ninguno. */
export function pickBestPrediction(
  candidates: { points: number; isExact: boolean; alsoNailed: number; othersAvg: number }[],
): number {
  let best = -1;
  for (let i = 0; i < candidates.length; i++) {
    if (best === -1) {
      best = i;
      continue;
    }
    const a = candidates[i]!;
    const b = candidates[best]!;
    // 1) exacto sobre no-exacto
    if (a.isExact !== b.isExact) {
      if (a.isExact) best = i;
      continue;
    }
    // 2) mayor brecha contra el resto (tu puntaje - promedio del resto)
    const gapA = a.points - a.othersAvg;
    const gapB = b.points - b.othersAvg;
    if (gapA !== gapB) {
      if (gapA > gapB) best = i;
      continue;
    }
    // 3) más exclusivo: menos gente lo clavó
    if (a.alsoNailed < b.alsoNailed) best = i;
  }
  return best;
}

export interface SpecialPick {
  pick: string | null;
  correct: boolean;
  points: number;
}

export interface Persona {
  title: string;
  emoji: string;
  blurb: string;
}

/** Insumos mínimos para elegir personaje. */
export interface PersonaInput {
  rank: number | null;
  memberCount: number;
  championCorrect: boolean;
  exactCount: number;
  longestStreak: number;
  accuracy: number;
  predictionCount: number;
}

/**
 * Elige el "personaje" del jugador. Reglas ordenadas de más épica a más
 * general; se aplica la primera que calce. Tono siempre positivo.
 */
export function choosePersona(s: PersonaInput): Persona {
  const isChampion = s.rank === 1;
  const isPodium = s.rank !== null && s.rank <= 3 && s.memberCount >= 3;

  if (isChampion && s.championCorrect) {
    return {
      title: "El Oráculo",
      emoji: "🔮",
      blurb: "Lo viste todo venir: campeón acertado y corona de la polla.",
    };
  }
  if (isChampion) {
    return {
      title: "El Rey de la Polla",
      emoji: "👑",
      blurb: "Nadie predijo mejor que tú. El trono es tuyo.",
    };
  }
  if (s.exactCount >= 5) {
    return {
      title: "El Francotirador",
      emoji: "🎯",
      blurb: "Marcadores exactos como si tuvieras la bola de cristal.",
    };
  }
  if (s.longestStreak >= 5) {
    return {
      title: "El Imparable",
      emoji: "🔥",
      blurb: "Una racha que no se apagaba nunca.",
    };
  }
  if (isPodium) {
    return {
      title: "El Podio",
      emoji: "🥉",
      blurb: "Top 3. Estuviste a nada de la gloria.",
    };
  }
  if (s.accuracy >= 0.6 && s.predictionCount >= 5) {
    return {
      title: "El Certero",
      emoji: "🧠",
      blurb: "Fallabas poco: puro ojo clínico partido a partido.",
    };
  }
  if (s.predictionCount === 0) {
    return {
      title: "El Espectador",
      emoji: "🍿",
      blurb: "Miraste el Mundial de tribuna. La próxima te lanzas.",
    };
  }
  return {
    title: "El Pollero",
    emoji: "⚽",
    blurb: "Jugaste el Mundial partido a partido, con corazón.",
  };
}

/** Texto para compartir el resultado (Web Share / portapapeles). */
export function shareText(d: WrappedData): string {
  const pos =
    d.rank !== null
      ? `terminé ${d.tied ? "empatado en el " : ""}#${d.rank} de ${d.memberCount}`
      : "jugué el Mundial";
  return `🏆 Mi Mundial 2026 en "${d.poolName}": ${pos} con ${d.total} puntos. Soy ${d.persona.title} ${d.persona.emoji}. ¿Te la ganas la próxima?`;
}
