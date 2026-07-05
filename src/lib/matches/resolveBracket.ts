// ============================================================
// Pollon — Resolución del bracket eliminatorio (función pura)
// ============================================================
// Fuente única de verdad para saber, dado el estado real del torneo, qué equipos
// juegan cada partido KO (73–104) y quién ganó cada uno. La usan:
//   - la página `bracket` (para pintar el cuadro), y
//   - el cron `sync-matches` (para detectar cruces YA definidos que todavía no
//     están en la DB e importarlos por nombre, incluso cuando el proveedor los
//     publica con un intRound inservible o fuera de eventsround).
//
// Deriva los equipos desde la tabla real de grupos (winner/runnerUp/3°) y desde
// el ganador/perdedor de los feeders, exactamente como el fixture oficial en
// `knockoutSchedule.ts`. No hardcodea equipos.

import { KNOCKOUT_MATCHES, type KnockoutSlot } from "@/lib/knockoutSchedule";
import { computeGroupStandings, type GroupMatch, type StandingRow } from "@/lib/standings";
import type { Round } from "@/types";

/** Campos mínimos de una fila KO de la DB que necesita la resolución. */
export interface KoRow {
  id: string;
  round: string;
  home_team: string;
  away_team: string;
  status: string;
  winner: string | null;
}

/**
 * Genérico en T para que cada llamador conserve el tipo COMPLETO de su fila (la
 * página necesita marcadores/penales/kickoff en `dbMatch`; el cron no). Basta con
 * que T tenga los campos de KoRow.
 */
export interface ResolvedSlot<T extends KoRow = KoRow> {
  num: number;
  round: Round;
  kickoff: string; // del fixture oficial (UTC)
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  dbMatch: T | null; // partido real de la DB matcheado por equipos (o null)
}

/**
 * Agrupa los partidos de la fase de grupos y calcula la tabla real por grupo
 * (clave = "A".."L", sin el prefijo "Group ").
 */
export function buildStandingsByGroup(
  groupMatches: (GroupMatch & { group_name: string | null })[],
): Map<string, StandingRow[]> {
  const groupsMap = new Map<string, GroupMatch[]>();
  for (const m of groupMatches) {
    const key = (m.group_name ?? "?").replace(/^Group\s+/i, "");
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(m);
  }
  const out = new Map<string, StandingRow[]>();
  for (const [g, ms] of groupsMap) out.set(g, computeGroupStandings(ms));
  return out;
}

/**
 * Resuelve cada partido del bracket a sus equipos reales y su ganador, matcheando
 * cada llave contra el partido correspondiente en la DB (por par de equipos, sin
 * orden, dentro de la ronda). Un `dbMatch` en null con ambos equipos definidos
 * significa un cruce YA determinado que todavía no existe en la DB.
 */
export function resolveBracket<T extends KoRow>(
  standingsByGroup: Map<string, StandingRow[]>,
  koMatches: T[],
): Map<number, ResolvedSlot<T>> {
  const dbByRound = new Map<string, T[]>();
  const usedByRound = new Map<string, Set<string>>();
  for (const m of koMatches) {
    if (!dbByRound.has(m.round)) {
      dbByRound.set(m.round, []);
      usedByRound.set(m.round, new Set());
    }
    dbByRound.get(m.round)!.push(m);
  }

  const winnerTeamOf = (m: T | null): string | null =>
    m && m.status === "finished" && m.winner
      ? m.winner === "home" ? m.home_team : m.away_team
      : null;
  const loserTeamOf = (m: T | null): string | null =>
    m && m.status === "finished" && m.winner
      ? m.winner === "home" ? m.away_team : m.home_team
      : null;

  const slotByNum = new Map<number, ResolvedSlot<T>>();
  const nums = Object.keys(KNOCKOUT_MATCHES).map(Number).sort((a, b) => a - b);
  for (const num of nums) {
    const def = KNOCKOUT_MATCHES[num]!;
    const resolveTeam = (slot: KnockoutSlot): string | null => {
      if (slot.type === "feeder") return slotByNum.get(slot.matchNum)?.winnerTeam ?? null;
      if (slot.type === "loser") {
        const fed = slotByNum.get(slot.matchNum);
        return fed ? loserTeamOf(fed.dbMatch) : null;
      }
      const s = standingsByGroup.get(slot.group);
      const idx = slot.type === "winner" ? 0 : slot.type === "runnerUp" ? 1 : 2;
      return s?.[idx]?.team ?? null;
    };
    const homeTeam = resolveTeam(def.home);
    const awayTeam = resolveTeam(def.away);

    const known = [homeTeam, awayTeam].filter((t): t is string => t !== null);
    const dbList = dbByRound.get(def.round) ?? [];
    const used = usedByRound.get(def.round);
    let dbMatch: T | null = null;
    if (known.length > 0 && used) {
      dbMatch =
        dbList.find(
          (m) => !used.has(m.id) && known.every((t) => m.home_team === t || m.away_team === t),
        ) ?? null;
      if (dbMatch) used.add(dbMatch.id);
    }

    slotByNum.set(num, {
      num,
      round: def.round,
      kickoff: def.kickoff,
      homeTeam,
      awayTeam,
      winnerTeam: winnerTeamOf(dbMatch),
      dbMatch,
    });
  }
  return slotByNum;
}
