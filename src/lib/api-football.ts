// ============================================================
// Pollon — Cliente de API-Football
// ============================================================
// Docs: https://www.api-football.com/documentation-v3
// Plan gratuito: 100 req/día. El sync debe ser frugal.

import type { MatchStatus, MatchWinner, Round } from "@/types";

const API_BASE = "https://v3.football.api-sports.io";

// FIFA World Cup. Ajustar al id/season reales de la edición 2026.
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

export interface ExternalMatch {
  external_id: string;
  round: Round;
  group_name: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string; // ISO UTC
  status: MatchStatus;
  home_score: number | null; // marcador a 90 min (fulltime)
  away_score: number | null;
  winner: MatchWinner | null;
}

interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: {
    home: { name: string; winner: boolean | null };
    away: { name: string; winner: boolean | null };
  };
  score: { fulltime: { home: number | null; away: number | null } };
  league: { round: string };
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);

function mapStatus(short: string): MatchStatus {
  if (FINISHED_STATUSES.has(short)) return "finished";
  if (LIVE_STATUSES.has(short)) return "live";
  return "scheduled";
}

/** Mapea el texto de "round" de API-Football a nuestras rondas. */
function mapRound(round: string): { round: Round; group_name: string | null } {
  const r = round.toLowerCase();
  if (r.includes("group")) {
    // ej. "Group Stage - Group A" → group_name "Group A"
    const match = round.match(/group\s+([A-Z])/i);
    return {
      round: "group_stage",
      group_name: match ? `Group ${match[1]!.toUpperCase()}` : null,
    };
  }
  if (r.includes("16")) return { round: "round_of_16", group_name: null };
  if (r.includes("quarter")) return { round: "quarterfinal", group_name: null };
  if (r.includes("semi")) return { round: "semifinal", group_name: null };
  if (r.includes("final")) return { round: "final", group_name: null };
  // Fallback razonable.
  return { round: "group_stage", group_name: null };
}

function mapWinner(home: boolean | null, away: boolean | null): MatchWinner | null {
  if (home) return "home";
  if (away) return "away";
  return null;
}

/**
 * Descarga los fixtures del Mundial y los normaliza a ExternalMatch[].
 * Lanza si la API responde con error o falta la key.
 */
export async function fetchWorldCupFixtures(): Promise<ExternalMatch[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY no configurada");

  const url = `${API_BASE}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    // Sin caché: queremos resultados frescos.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football respondió ${res.status}`);
  }

  const json = (await res.json()) as { response: ApiFixture[] };

  return json.response.map((f) => {
    const { round, group_name } = mapRound(f.league.round);
    const status = mapStatus(f.fixture.status.short);
    return {
      external_id: String(f.fixture.id),
      round,
      group_name,
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      kickoff_at: f.fixture.date,
      status,
      home_score: f.score.fulltime.home,
      away_score: f.score.fulltime.away,
      winner:
        status === "finished"
          ? mapWinner(f.teams.home.winner, f.teams.away.winner)
          : null,
    };
  });
}
