// ============================================================
// Tipos de dominio de Pollon
// ============================================================
// Tipos "amigables" para usar en la app. Los tipos crudos generados
// desde la base de datos viven en ./database.ts (supabase gen types).

import type { Round } from "@/lib/constants";

export type { Round };

export type MatchStatus = "scheduled" | "live" | "finished";
export type MatchWinner = "home" | "away";

export type ScoreReason =
  | "exact_score"
  | "correct_winner"
  | "correct_draw"
  | "correct_qualifier"
  | "exact_qualifier_score"
  | "champion";

export interface Profile {
  id: string;
  display_name: string;
  timezone: string | null;
  created_at: string;
}

export interface Pool {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface PoolMember {
  id: string;
  pool_id: string;
  user_id: string;
  joined_at: string;
}

export interface Match {
  id: string;
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
  is_active: boolean;
  updated_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home: number | null;
  predicted_away: number | null;
  predicted_winner: MatchWinner | null;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChampionPrediction {
  id: string;
  user_id: string;
  team: string;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
}

export interface Score {
  id: string;
  user_id: string;
  pool_id: string;
  match_id: string | null;
  points: number;
  reason: ScoreReason;
  calculated_at: string;
}

/** Fila del ranking de una polla (resultado agregado). */
export interface RankingRow {
  user_id: string;
  display_name: string;
  total: number;
  exact_count: number;
  winner_count: number;
  champion_correct: boolean;
}
