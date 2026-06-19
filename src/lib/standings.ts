// ============================================================
// Pollon — Tabla de posiciones FIFA por grupo (función pura)
// ============================================================
// Calcula la tabla real del torneo (no las predicciones) a partir de los
// partidos finalizados: 3 pts por victoria, 1 por empate, 0 por derrota.
// Orden: puntos, luego diferencia de gol, luego goles a favor, luego nombre.

export interface GroupMatch {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

export interface StandingRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number; // goles a favor
  ga: number; // goles en contra
  gd: number; // diferencia
  points: number;
}

export function computeGroupStandings(matches: GroupMatch[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  const ensure = (team: string): StandingRow => {
    let row = table.get(team);
    if (!row) {
      row = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      };
      table.set(team, row);
    }
    return row;
  };

  for (const m of matches) {
    // Todos los equipos aparecen aunque aún no hayan jugado.
    ensure(m.home_team);
    ensure(m.away_team);

    if (
      m.status !== "finished" ||
      m.home_score === null ||
      m.away_score === null
    ) {
      continue;
    }

    const home = ensure(m.home_team);
    const away = ensure(m.away_team);

    home.played += 1;
    away.played += 1;
    home.gf += m.home_score;
    home.ga += m.away_score;
    away.gf += m.away_score;
    away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (m.home_score < m.away_score) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...table.values()];
  for (const r of rows) r.gd = r.gf - r.ga;

  rows.sort(
    (x, y) =>
      y.points - x.points ||
      y.gd - x.gd ||
      y.gf - x.gf ||
      x.team.localeCompare(y.team),
  );

  return rows;
}

/** Dirección del cambio de posición proyectado para un equipo. */
export type PositionDir = "up" | "down" | "same";

export interface LivePosition {
  pos: number; // posición proyectada en el grupo (1-based)
  dir: PositionDir; // sube / baja / se mantiene respecto a la tabla actual
}

/**
 * Proyecta la posición final en el grupo de cada equipo si los resultados en
 * vivo se mantienen. Compara dos tablas:
 *  - base: solo partidos `finished`.
 *  - proyectada: base + todos los partidos `live` (con su marcador actual)
 *    contados como finalizados.
 * Así funciona también en la última fecha, cuando hay dos partidos del mismo
 * grupo en vivo simultáneamente.
 *
 * `groupMatches` debe contener todos los partidos del grupo (finalizados y en
 * vivo). Devuelve un mapa equipo → posición proyectada + dirección.
 */
export function projectLivePositions(
  groupMatches: GroupMatch[],
): Map<string, LivePosition> {
  const base = computeGroupStandings(groupMatches);
  const projectedInput = groupMatches.map((m) =>
    m.status === "live" && m.home_score !== null && m.away_score !== null
      ? { ...m, status: "finished" }
      : m,
  );
  const projected = computeGroupStandings(projectedInput);

  const basePos = new Map(base.map((r, i) => [r.team, i + 1]));
  const result = new Map<string, LivePosition>();
  projected.forEach((r, i) => {
    const before = basePos.get(r.team);
    if (before === undefined) return;
    const pos = i + 1;
    const dir: PositionDir = pos < before ? "up" : pos > before ? "down" : "same";
    result.set(r.team, { pos, dir });
  });
  return result;
}
