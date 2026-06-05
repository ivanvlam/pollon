// ============================================================
// Pollon — Cliente de TheSportsDB (fixtures del Mundial)
// ============================================================
// Docs: https://www.thesportsdb.com/free_sports_api
// FIFA World Cup: idLeague 4429, temporada 2026.
// El key de prueba "3" es gratis pero viene recortado (subconjunto de
// partidos, sin strStage). Para el fixture completo, usar un key premium
// en THESPORTSDB_KEY.

import type { MatchStatus, MatchWinner, Round } from "@/types";

const WORLD_CUP_LEAGUE_ID = 4429;
const WORLD_CUP_SEASON = 2026;

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
  strGroup: string | null;
  strStage: string | null;
  strEvent: string | null;
}

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
  const iso = hasTz ? raw : `${raw}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/** Clasifica ronda y grupo. Los partidos de grupos traen strGroup. */
function mapRound(ev: SdbEvent): { round: Round; group_name: string | null } {
  if (ev.strGroup && ev.strGroup.trim() !== "") {
    return { round: "group_stage", group_name: `Group ${ev.strGroup.trim()}` };
  }
  const text = `${ev.strStage ?? ""} ${ev.strEvent ?? ""}`.toLowerCase();
  if (text.includes("round of 16") || text.includes("octavos")) {
    return { round: "round_of_16", group_name: null };
  }
  if (text.includes("quarter") || text.includes("cuartos")) {
    return { round: "quarterfinal", group_name: null };
  }
  if (text.includes("semi")) return { round: "semifinal", group_name: null };
  if (text.includes("final")) return { round: "final", group_name: null };
  // Sin etiqueta de fase: asumimos primera ronda eliminatoria (best-effort).
  return { round: "round_of_16", group_name: null };
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

export async function fetchWorldCupFixtures(): Promise<ExternalMatch[]> {
  const key = process.env.THESPORTSDB_KEY || "3";
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${WORLD_CUP_LEAGUE_ID}&s=${WORLD_CUP_SEASON}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`TheSportsDB respondió ${res.status}`);
  }

  const json = (await res.json()) as { events: SdbEvent[] | null };
  const events = json.events ?? [];

  return events.map((ev) => {
    const status = mapStatus(ev.strStatus);
    const { round, group_name } = mapRound(ev);
    const home = parseScore(ev.intHomeScore);
    const away = parseScore(ev.intAwayScore);
    return {
      external_id: ev.idEvent,
      round,
      group_name,
      home_team: ev.strHomeTeam,
      away_team: ev.strAwayTeam,
      kickoff_at: toUtcIso(ev),
      status,
      home_score: home,
      away_score: away,
      winner: deriveWinner(status, home, away),
    };
  });
}
