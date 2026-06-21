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

/**
 * Estado de clasificación MATEMÁTICA de un equipo dentro de su grupo, válido en
 * TODOS los escenarios posibles de los partidos que faltan:
 *  - "qualified": termina 1° o 2° pase lo que pase (clasificado seguro, ya que
 *    el top-2 siempre avanza; ignora la vía del "mejor tercero", así que nunca
 *    sobre-afirma).
 *  - "eliminated": termina último pase lo que pase (el último nunca clasifica,
 *    ni como tercero).
 *  - "open": todavía puede terminar 3° en algún escenario → su suerte depende de
 *    la carrera de los mejores terceros (cross-grupo), no se afirma nada.
 */
export type GroupClinch = "qualified" | "eliminated" | "open";

/**
 * Posición de grupo matemáticamente asegurada (para los slots del bracket):
 *  - "first": tiene el 1° asegurado pase lo que pase.
 *  - "second": tiene exactamente el 2° asegurado (ni puede ser 1° ni caer al 3°).
 *  - "none": su posición exacta todavía puede variar.
 */
export type GroupPositionLock = "first" | "second" | "none";

/** Cuántos clasifican directo por grupo (1° y 2°). */
const DIRECT_QUALIFY = 2;

const isDecidedMatch = (m: GroupMatch) =>
  m.status === "finished" && m.home_score !== null && m.away_score !== null;

interface GroupScenarioStats {
  canMissTopTwo: boolean; // algún escenario fuera del top-2
  canAvoidLast: boolean; // algún escenario sin ser último
  canNotBeSoleFirst: boolean; // algún escenario sin ser 1° en solitario
  canNotBeExactlySecond: boolean; // algún escenario sin ser exactamente 2°
}

/**
 * Recorre por fuerza bruta los resultados (V/E/D) de los partidos no
 * finalizados del grupo y agrega, por equipo, en qué situaciones puede caer.
 *
 * Es deliberadamente CONSERVADOR: solo usa puntos y resuelve los empates en
 * contra o a favor del equipo según el criterio, por lo que nunca afirma un
 * clinch/lock que dependa del desempate por diferencia de gol (que los partidos
 * futuros pueden alterar). Los partidos `live` se tratan como indecisos: un
 * "100%" no debe fiarse de un marcador que aún puede cambiar.
 *
 * `matches` debe contener TODOS los partidos del grupo (finalizados + por jugar).
 * Cada grupo tiene a lo sumo 6 partidos → ≤ 3⁶ = 729 escenarios.
 */
function bruteForceGroupStats(matches: GroupMatch[]): Map<string, GroupScenarioStats> {
  const teams = new Set<string>();
  for (const m of matches) {
    teams.add(m.home_team);
    teams.add(m.away_team);
  }
  const teamList = [...teams];
  const lastRank = teamList.length; // "último" del grupo

  const add = (map: Map<string, number>, team: string, pts: number) =>
    map.set(team, (map.get(team) ?? 0) + pts);

  // Puntos ya asegurados por los partidos finalizados.
  const basePoints = new Map<string, number>();
  for (const t of teamList) basePoints.set(t, 0);
  for (const m of matches) {
    if (!isDecidedMatch(m)) continue;
    if (m.home_score! > m.away_score!) add(basePoints, m.home_team, 3);
    else if (m.home_score! < m.away_score!) add(basePoints, m.away_team, 3);
    else {
      add(basePoints, m.home_team, 1);
      add(basePoints, m.away_team, 1);
    }
  }

  const remaining = matches.filter((m) => !isDecidedMatch(m));
  const stats = new Map<string, GroupScenarioStats>();
  for (const t of teamList) {
    stats.set(t, {
      canMissTopTwo: false,
      canAvoidLast: false,
      canNotBeSoleFirst: false,
      canNotBeExactlySecond: false,
    });
  }

  const total = 3 ** remaining.length;
  for (let s = 0; s < total; s++) {
    const pts = new Map(basePoints);
    let code = s;
    for (const rm of remaining) {
      const outcome = code % 3;
      code = Math.floor(code / 3);
      if (outcome === 0) add(pts, rm.home_team, 3);
      else if (outcome === 1) add(pts, rm.away_team, 3);
      else {
        add(pts, rm.home_team, 1);
        add(pts, rm.away_team, 1);
      }
    }

    for (const t of teamList) {
      const tp = pts.get(t)!;
      let strictlyAbove = 0;
      let tied = 0;
      for (const r of teamList) {
        if (r === t) continue;
        const rp = pts.get(r)!;
        if (rp > tp) strictlyAbove += 1;
        else if (rp === tp) tied += 1;
      }
      const st = stats.get(t)!;
      // Peor caso (empates en contra) y mejor caso (empates a favor).
      const worstRank = 1 + strictlyAbove + tied;
      const bestRank = 1 + strictlyAbove;
      if (worstRank > DIRECT_QUALIFY) st.canMissTopTwo = true;
      if (bestRank < lastRank) st.canAvoidLast = true;
      if (strictlyAbove > 0 || tied > 0) st.canNotBeSoleFirst = true;
      if (!(strictlyAbove === 1 && tied === 0)) st.canNotBeExactlySecond = true;
    }
  }
  return stats;
}

/**
 * Clinch de clasificación de cada equipo del grupo. Ver {@link GroupClinch}.
 * Grupo ya terminado (sin partidos por jugar): usa la tabla real (con su
 * desempate por diferencia de gol), no el cálculo conservador por puntos.
 */
export function computeGroupClinch(matches: GroupMatch[]): Map<string, GroupClinch> {
  const remaining = matches.filter((m) => !isDecidedMatch(m));
  if (remaining.length === 0) {
    const standings = computeGroupStandings(matches);
    const lastIdx = standings.length - 1;
    const exact = new Map<string, GroupClinch>();
    standings.forEach((row, i) => {
      exact.set(
        row.team,
        i < DIRECT_QUALIFY ? "qualified" : i === lastIdx ? "eliminated" : "open",
      );
    });
    return exact;
  }

  const stats = bruteForceGroupStats(matches);
  const result = new Map<string, GroupClinch>();
  for (const [team, st] of stats) {
    if (!st.canMissTopTwo) result.set(team, "qualified");
    else if (!st.canAvoidLast) result.set(team, "eliminated");
    else result.set(team, "open");
  }
  return result;
}

/**
 * Posición de grupo asegurada de cada equipo. Ver {@link GroupPositionLock}.
 * Pensado para los slots del bracket ("1° Grupo X" / "2° Grupo X"). Grupo ya
 * terminado: usa la tabla real con desempate.
 */
export function computeGroupPositionLock(
  matches: GroupMatch[],
): Map<string, GroupPositionLock> {
  const remaining = matches.filter((m) => !isDecidedMatch(m));
  if (remaining.length === 0) {
    const standings = computeGroupStandings(matches);
    const exact = new Map<string, GroupPositionLock>();
    standings.forEach((row, i) => {
      exact.set(row.team, i === 0 ? "first" : i === 1 ? "second" : "none");
    });
    return exact;
  }

  const stats = bruteForceGroupStats(matches);
  const result = new Map<string, GroupPositionLock>();
  for (const [team, st] of stats) {
    if (!st.canNotBeSoleFirst) result.set(team, "first");
    else if (!st.canNotBeExactlySecond) result.set(team, "second");
    else result.set(team, "none");
  }
  return result;
}
