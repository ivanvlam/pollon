// ============================================================
// Pollon — Cliente de TheSportsDB (fixtures del Mundial)
// ============================================================
// Docs: https://www.thesportsdb.com/free_sports_api
// FIFA World Cup: idLeague 4429, temporada 2026.
//
// El endpoint de TEMPORADA (eventsseason) viene topado a ~16 resultados en
// el key gratis. El endpoint por RONDA (eventsround) devuelve la ronda
// completa, así que iteramos las rondas para tener todos los partidos.
// Códigos de ronda de TheSportsDB para el Mundial:
//   grupos = 1,2,3 · octavos = 16 · cuartos = 125 · semis = 150 · final = 200
// (Las eliminatorias aparecen recién cuando se definen los cruces.)
//
// THESPORTSDB_KEY: "3" es el key de prueba gratis. Un key premium da más
// cuota y livescores cada 2 min.

import { recordSdbRequests } from "@/lib/sdb-usage";
import type { MatchStatus, MatchWinner, Round } from "@/types";

const WORLD_CUP_LEAGUE_ID = 4429;
const WORLD_CUP_SEASON = 2026;

const ROUND_DEFS: { r: number; round: Round }[] = [
  { r: 1, round: "group_stage" },
  { r: 2, round: "group_stage" },
  { r: 3, round: "group_stage" },
  { r: 32, round: "round_of_32" },
  { r: 16, round: "round_of_16" },
  { r: 125, round: "quarterfinal" },
  { r: 150, round: "semifinal" },
  { r: 200, round: "final" },
];

export interface ExternalMatch {
  external_id: string;
  round: Round;
  group_name: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string; // ISO UTC
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  winner: MatchWinner | null;
  sdb_round: number; // número de ronda de TheSportsDB (1,2,3,16,32,125,150,200)
  live_minute: string | null; // minuto de juego (strProgress), solo si está live
}

interface SdbEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strStatus: string | null;
  strProgress: string | null;
  strGroup: string | null;
  intRound: string | null;
}

// Número de ronda SDB → enum interno. Grupos: matchdays 1,2,3.
const SDB_ROUND_TO_ROUND: Record<number, Round> = {
  1: "group_stage", 2: "group_stage", 3: "group_stage",
  32: "round_of_32", 16: "round_of_16", 125: "quarterfinal",
  150: "semifinal", 200: "final",
};

const FINISHED = new Set(["FT", "AET", "PEN", "Match Finished"]);
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);

function mapStatus(status: string | null): MatchStatus {
  if (!status) return "scheduled";
  if (FINISHED.has(status)) return "finished";
  if (LIVE.has(status)) return "live";
  return "scheduled";
}

/** kickoff en UTC. strTimestamp viene en UTC pero sin offset → se añade 'Z'. */
function toUtcIso(ev: SdbEvent): string {
  const raw =
    ev.strTimestamp ??
    (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}` : null);
  if (!raw) return new Date(0).toISOString();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const d = new Date(hasTz ? raw : `${raw}Z`);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function parseScore(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function deriveWinner(
  status: MatchStatus,
  home: number | null,
  away: number | null,
): MatchWinner | null {
  if (status !== "finished" || home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return null; // empate a 90': el clasificado (penales) no lo da esta API
}

function toExternal(ev: SdbEvent, round: Round, sdbRound: number): ExternalMatch {
  const status = mapStatus(ev.strStatus);
  const home = parseScore(ev.intHomeScore);
  const away = parseScore(ev.intAwayScore);
  const progress = ev.strProgress?.trim();
  return {
    external_id: ev.idEvent,
    round,
    group_name:
      round === "group_stage" && ev.strGroup && ev.strGroup.trim() !== ""
        ? `Group ${ev.strGroup.trim()}`
        : null,
    home_team: ev.strHomeTeam,
    away_team: ev.strAwayTeam,
    kickoff_at: toUtcIso(ev),
    status,
    home_score: home,
    away_score: away,
    winner: deriveWinner(status, home, away),
    sdb_round: sdbRound,
    // En vivo: guardamos el minuto si la API lo da (strProgress); la clave
    // gratuita no lo entrega, así que caemos al código de fase (strStatus,
    // ej. "2H") para poder mostrar "2ª mitad". formatLiveMinute lo traduce.
    live_minute:
      status === "live"
        ? progress || ev.strStatus?.trim() || null
        : null,
  };
}

export interface ExternalPlayer {
  name: string;
  team: string;
}

async function fetchPlayersByTeamId(key: string, teamId: string, teamName: string): Promise<ExternalPlayer[]> {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/${key}/lookup_all_players.php?id=${teamId}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { player: { strPlayer: string }[] | null };
  return (json.player ?? []).map((p) => ({ name: p.strPlayer, team: teamName }));
}

/**
 * Trae los jugadores del Mundial extrayendo los IDs de equipo directamente
 * desde los eventos de la fase de grupos (rondas 1-3 cubren los 48 equipos).
 * Más confiable que buscar por nombre, que devuelve equipos incorrectos.
 */
export async function fetchWorldCupPlayers(): Promise<ExternalPlayer[]> {
  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;

  interface SdbEventWithIds {
    strHomeTeam: string;
    strAwayTeam: string;
    idHomeTeam: string;
    idAwayTeam: string;
  }

  // Rondas 1-3 de grupos cubren los 48 equipos
  const rounds = await Promise.all(
    [1, 2, 3].map(async (r) => {
      const res = await fetch(`${base}/eventsround.php?id=${WORLD_CUP_LEAGUE_ID}&r=${r}&s=${WORLD_CUP_SEASON}`, { cache: "no-store" });
      if (!res.ok) return [];
      const json = (await res.json()) as { events: SdbEventWithIds[] | null };
      return json.events ?? [];
    }),
  );
  await recordSdbRequests(3);

  // Construir mapa nombre → id (deduplicado)
  const teamMap = new Map<string, string>();
  for (const events of rounds) {
    for (const ev of events) {
      if (ev.idHomeTeam) teamMap.set(ev.strHomeTeam, ev.idHomeTeam);
      if (ev.idAwayTeam) teamMap.set(ev.strAwayTeam, ev.idAwayTeam);
    }
  }

  if (teamMap.size === 0) return [];

  // Fetch en lotes de 8 para no saturar las conexiones salientes de Vercel
  const entries = [...teamMap.entries()];
  const all: ExternalPlayer[] = [];
  for (let i = 0; i < entries.length; i += 8) {
    const batch = entries.slice(i, i + 8);
    const results = await Promise.all(
      batch.map(([team, id]) => fetchPlayersByTeamId(key, id, team)),
    );
    all.push(...results.flat());
  }
  await recordSdbRequests(entries.length);

  return all;
}

/**
 * Trae todos los partidos del Mundial iterando por ronda y deduplicando.
 * Las rondas eliminatorias devuelven vacío hasta que se definen los cruces.
 * @param sdbRounds - Si se pasa, solo se fetchean esas rondas (optimización de cuota).
 */
export async function fetchWorldCupFixtures(sdbRounds?: number[]): Promise<ExternalMatch[]> {
  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;

  const roundsToFetch = sdbRounds
    ? ROUND_DEFS.filter((rd) => sdbRounds.includes(rd.r))
    : ROUND_DEFS;

  const perRound = await Promise.all(
    roundsToFetch.map(async ({ r, round }) => {
      const res = await fetch(
        `${base}/eventsround.php?id=${WORLD_CUP_LEAGUE_ID}&r=${r}&s=${WORLD_CUP_SEASON}`,
        { cache: "no-store" },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { events: SdbEvent[] | null };
      return (json.events ?? []).map((ev) => toExternal(ev, round, r));
    }),
  );
  await recordSdbRequests(roundsToFetch.length);

  // Deduplicar por external_id (por si un partido aparece en dos rondas).
  const byId = new Map<string, ExternalMatch>();
  for (const arr of perRound) {
    for (const m of arr) byId.set(m.external_id, m);
  }
  return [...byId.values()];
}

/**
 * Trae partidos puntuales por su idEvent (lookupevent). La forma MÁS confiable
 * de obtener el estado en vivo con la clave gratuita: tanto eventsround como
 * eventsday devuelven sets incompletos que omiten partidos en curso (ej.
 * Holanda-Japón aparece en lookupevent con status '1H' pero NO en eventsday).
 * Como ya tenemos todos los partidos en la DB, consultamos solo los external_id
 * que nos interesan (los de la ventana activa) → 1 request por partido.
 */
export async function fetchEventsByIds(ids: string[]): Promise<ExternalMatch[]> {
  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;

  const results = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`${base}/lookupevent.php?id=${id}`, { cache: "no-store" });
      if (!res.ok) return null;
      const json = (await res.json()) as { events: SdbEvent[] | null };
      const ev = json.events?.[0];
      if (!ev) return null;
      const sdbRound = Number(ev.intRound);
      const round = SDB_ROUND_TO_ROUND[sdbRound];
      return round ? toExternal(ev, round, sdbRound) : null;
    }),
  );
  await recordSdbRequests(ids.length);

  return results.filter((m): m is ExternalMatch => m !== null);
}
