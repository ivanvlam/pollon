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
  { r: 160, round: "third_place" },
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
  home_score: number | null; // resultado en cancha (incluye alargue)
  away_score: number | null;
  winner: MatchWinner | null;
  sdb_round: number; // número de ronda de TheSportsDB (1,2,3,16,32,125,150,160,200)
  live_minute: string | null; // minuto de juego (strProgress), solo si está live
  // Marcador a 90' que reporta la API EN ESE MOMENTO (= home_score salvo cuando
  // el partido ya pasó del reglamentario). null si ya está en alargue/penales:
  // ahí el cron preserva el valor capturado en vivo durante 1H/HT/2H.
  home_score_90: number | null;
  away_score_90: number | null;
  // Tanda de penales (intHomeScoreExtra/intAwayScoreExtra; status "AP").
  home_pen: number | null;
  away_pen: number | null;
  // El partido pasó del tiempo reglamentario (alargue/penales) → no pisar *_90.
  past_regulation: boolean;
}

interface SdbEvent {
  idEvent: string;
  idLeague?: string | null; // para filtrar searchevents (no filtra por liga)
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intHomeScoreExtra: string | null; // tanda de penales (status "AP")
  intAwayScoreExtra: string | null;
  strResult: string | null;         // texto: "X win 4-3 on penalties"
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
  150: "semifinal", 160: "third_place", 200: "final",
};

// Enum interno → número de ronda SDB canónico. Se usa al importar un cruce por
// nombre con la ronda FORZADA (el proveedor a veces publica los KO con
// intRound=0), para guardar un sdb_round coherente igual que si viniera por
// eventsround.
const ROUND_TO_SDB: Partial<Record<Round, number>> = {
  round_of_32: 32, round_of_16: 16, quarterfinal: 125, semifinal: 150,
  third_place: 160, final: 200,
};

// "AP" = After Penalties (lo que de verdad usa la API en partidos a penales),
// "AET" = After Extra Time. Sin "AP" en esta lista, los partidos a penales NO
// se auto-finalizaban (había que marcarlos a mano en /admin).
const FINISHED = new Set(["FT", "AET", "AP", "PEN", "Match Finished"]);
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
// Estados que indican que el partido pasó del tiempo reglamentario (alargue o
// penales). En estos NO se debe pisar el marcador a 90' (*_90).
const PAST_REGULATION = new Set(["ET", "BT", "P", "AET", "AP", "PEN"]);

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
  homePen: number | null,
  awayPen: number | null,
): MatchWinner | null {
  if (status !== "finished" || home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  // Empate en cancha → lo decide la tanda de penales si la API la trae (status
  // "AP" trae intHomeScoreExtra/intAwayScoreExtra). Antes esto quedaba null y el
  // clasificado había que marcarlo a mano.
  if (homePen !== null && awayPen !== null && homePen !== awayPen) {
    return homePen > awayPen ? "home" : "away";
  }
  return null; // empate sin datos de penales → lo marca el admin
}

function toExternal(ev: SdbEvent, round: Round, sdbRound: number): ExternalMatch {
  const rawStatus = ev.strStatus?.trim() ?? "";
  const status = mapStatus(ev.strStatus);
  const home = parseScore(ev.intHomeScore);
  const away = parseScore(ev.intAwayScore);
  const homePen = parseScore(ev.intHomeScoreExtra);
  const awayPen = parseScore(ev.intAwayScoreExtra);
  const progress = ev.strProgress?.trim();
  // ¿El partido ya pasó del tiempo reglamentario? Por estado (ET/penales) o
  // porque ya hay marcador de la tanda de penales.
  const pastReg = PAST_REGULATION.has(rawStatus) || homePen !== null || awayPen !== null;
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
    winner: deriveWinner(status, home, away, homePen, awayPen),
    sdb_round: sdbRound,
    // En vivo: guardamos el minuto si la API lo da (strProgress); la clave
    // gratuita no lo entrega, así que caemos al código de fase (strStatus,
    // ej. "2H") para poder mostrar "2ª mitad". formatLiveMinute lo traduce.
    live_minute:
      status === "live"
        ? progress || ev.strStatus?.trim() || null
        : null,
    // En reglamentario el marcador actual ES el de 90'. Pasado el reglamentario
    // no lo sabemos desde la API (el actual incluye alargue) → null, y el cron
    // conserva el *_90 que ya capturó en vivo durante 1H/HT/2H.
    home_score_90: pastReg ? null : home,
    away_score_90: pastReg ? null : away,
    home_pen: homePen,
    away_pen: awayPen,
    past_regulation: pastReg,
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

/**
 * Busca partidos por NOMBRE ("Home vs Away") vía searchevents. Es la única forma
 * confiable de descubrir cruces KO nuevos con la clave gratuita: eventsround
 * queda CACHEADO/congelado (los partidos que el proveedor publica después NO
 * aparecen ahí aunque tengan el mismo idLeague/season/round), mientras que
 * searchevents sí los devuelve frescos. Se usa para reconciliar los partidos
 * cargados a mano (manual-*) con su fixture real en cuanto el proveedor lo
 * publica. 1 request por par. Filtra por idLeague (searchevents no filtra por
 * liga, así que un homónimo de otra competición no se cuela).
 */
export async function fetchEventsByName(
  pairs: { home: string; away: string; round?: Round }[],
): Promise<ExternalMatch[]> {
  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;

  // searchevents matchea el nombre exacto "A vs B" y es SENSIBLE al orden. El
  // bracket puede resolver un cruce en distinto orden que el proveedor, así que
  // probamos los dos órdenes y nos quedamos con el primero que exista.
  const searchOne = async (a: string, b: string): Promise<SdbEvent | null> => {
    const name = encodeURIComponent(`${a} vs ${b}`);
    const res = await fetch(
      `${base}/searchevents.php?e=${name}&s=${WORLD_CUP_SEASON}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { event: SdbEvent[] | null };
    return (json.event ?? []).find((e) => e.idLeague === String(WORLD_CUP_LEAGUE_ID)) ?? null;
  };

  const results = await Promise.all(
    pairs.map(async ({ home, away, round: forcedRound }) => {
      // Resiliente por-item: una request que falla no debe hundir el lote.
      try {
        const ev = (await searchOne(home, away)) ?? (await searchOne(away, home));
        if (!ev) return null;
        const sdbRound = Number(ev.intRound);
        // Cuando el llamador ya sabe la ronda (cruce resuelto por el bracket o
        // fila manual), la FORZAMOS: el proveedor publica algunos KO con
        // intRound=0, que no está en SDB_ROUND_TO_ROUND y haría descartar el
        // partido. Sin ronda conocida, se deriva del intRound como siempre.
        const round = forcedRound ?? SDB_ROUND_TO_ROUND[sdbRound];
        if (!round) return null;
        const sdbNum = forcedRound ? (ROUND_TO_SDB[forcedRound] ?? sdbRound) : sdbRound;
        return toExternal(ev, round, sdbNum);
      } catch {
        return null;
      }
    }),
  );
  await recordSdbRequests(pairs.length);

  return results.filter((m): m is ExternalMatch => m !== null);
}
