// ============================================================
// Pollon — Cliente de football-data.org (proveedor alternativo) — PREPARADO
// ============================================================
// Docs: https://docs.football-data.org/general/v4/match.html
//
// ⚠️ PREPARADO, NO ACTIVO. Este módulo es un reemplazo drop-in de
// `thesportsdb.ts`: devuelve `ExternalMatch[]` con el mismo shape, listo para
// enchufar en el cron. NO está conectado todavía porque cambiar de proveedor a
// mitad de torneo exige re-keyear `matches.external_id` en su lugar (ver el
// bloque "Migración a football-data.org" en CLAUDE.md), no re-importar (eso
// crearía filas nuevas y dejaría huérfanas las predicciones, que apuntan a
// `matches.id`).
//
// Ventajas sobre el v1 gratuito de TheSportsDB:
//  - 1 SOLO request trae TODO el fixture del Mundial (y el estado en vivo).
//  - Trae el minuto de juego real (`minute`) y el estado IN_PLAY/PAUSED.
//  - Límite gratis: 10 req/min, sin tope diario. Incluye el Mundial.
//
// Requiere FOOTBALL_DATA_TOKEN (header X-Auth-Token). Registro gratis en
// https://www.football-data.org/client/register

import type { ExternalMatch } from "@/lib/thesportsdb";
import type { MatchStatus, MatchWinner, Round } from "@/types";

const WORLD_CUP_CODE = "WC";
const BASE = "https://api.football-data.org/v4";

// Estados de football-data → estado interno.
const FD_FINISHED = new Set(["FINISHED", "AWARDED"]);
const FD_LIVE = new Set(["IN_PLAY", "PAUSED"]);

// Stage de football-data → enum de ronda interno + número estilo TheSportsDB
// (para mantener `sdb_round` coherente con el resto del código).
const STAGE_TO_ROUND: Record<string, Round> = {
  GROUP_STAGE: "group_stage",
  LAST_32: "round_of_32",
  LAST_16: "round_of_16",
  QUARTER_FINALS: "quarterfinal",
  SEMI_FINALS: "semifinal",
  FINAL: "final",
};
const STAGE_TO_SDB_ROUND: Record<string, number> = {
  LAST_32: 32,
  LAST_16: 16,
  QUARTER_FINALS: 125,
  SEMI_FINALS: 150,
  FINAL: 200,
};

interface FdScoreLine {
  home: number | null;
  away: number | null;
}
interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  minute: number | null;
  homeTeam: { name: string | null };
  awayTeam: { name: string | null };
  score: {
    winner: "HOME" | "AWAY" | "DRAW" | null;
    duration: string | null;
    fullTime: FdScoreLine;
  };
}

function mapStatus(status: string): MatchStatus {
  if (FD_FINISHED.has(status)) return "finished";
  if (FD_LIVE.has(status)) return "live";
  return "scheduled";
}

// Igual que en thesportsdb.ts: derivamos el ganador del marcador a 90', NO de
// score.winner (que incluiría penales). El clasificado por penales lo pone el
// admin a mano, así no se pisa.
function deriveWinner(
  status: MatchStatus,
  home: number | null,
  away: number | null,
): MatchWinner | null {
  if (status !== "finished" || home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return null;
}

function toExternal(m: FdMatch): ExternalMatch | null {
  const round = STAGE_TO_ROUND[m.stage];
  if (!round) return null; // p.ej. THIRD_PLACE u otros stages no soportados

  const status = mapStatus(m.status);
  const home = m.score.fullTime.home;
  const away = m.score.fullTime.away;

  // sdb_round: grupos = matchday (1,2,3); eliminatorias = código fijo.
  const sdbRound =
    round === "group_stage" ? m.matchday ?? 1 : STAGE_TO_SDB_ROUND[m.stage] ?? 0;

  return {
    external_id: String(m.id),
    round,
    group_name:
      round === "group_stage" && m.group
        ? m.group.replace(/^GROUP_/, "Group ") // GROUP_A → "Group A"
        : null,
    home_team: m.homeTeam.name ?? "",
    away_team: m.awayTeam.name ?? "",
    kickoff_at: new Date(m.utcDate).toISOString(),
    status,
    home_score: home,
    away_score: away,
    winner: deriveWinner(status, home, away),
    sdb_round: sdbRound,
    // football-data SÍ entrega el minuto real cuando está en juego.
    live_minute: status === "live" && m.minute != null ? String(m.minute) : null,
    // Cliente inactivo: no separa el marcador a 90' ni la tanda de penales en
    // este parser, así que *_90 = marcador final (best-effort) y pen = null.
    // past_regulation se infiere del campo duration.
    home_score_90: home,
    away_score_90: away,
    home_pen: null,
    away_pen: null,
    past_regulation:
      m.score.duration === "EXTRA_TIME" || m.score.duration === "PENALTY_SHOOTOUT",
  };
}

/**
 * Trae TODO el fixture del Mundial en UN solo request (incluye el estado en
 * vivo con marcador y minuto). Reemplazo drop-in de `fetchWorldCupFixtures`.
 */
export async function fetchWorldCupFixturesFD(): Promise<ExternalMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN no configurado");

  const res = await fetch(`${BASE}/competitions/${WORLD_CUP_CODE}/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`football-data.org respondió ${res.status}`);
  }

  const json = (await res.json()) as { matches: FdMatch[] | null };
  return (json.matches ?? [])
    .map(toExternal)
    .filter((m): m is ExternalMatch => m !== null);
}
