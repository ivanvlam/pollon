// ============================================================
// Tipos de la base de datos Supabase
// ============================================================
// Escrito a mano para reflejar las migraciones. Cuando tengas la CLI
// de Supabase instalada, regenera con:
//   npm run db:types
// (sobreescribe este archivo con tipos verificados contra la DB local).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          timezone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          timezone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          timezone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pools: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          invite_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pool_members: {
        Row: {
          id: string;
          pool_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          pool_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          pool_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey";
            columns: ["pool_id"];
            isOneToOne: false;
            referencedRelation: "pools";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          id: string;
          external_id: string;
          round: string;
          group_name: string | null;
          home_team: string;
          away_team: string;
          kickoff_at: string;
          status: string;
          home_score: number | null;
          away_score: number | null;
          winner: string | null;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          round: string;
          group_name?: string | null;
          home_team: string;
          away_team: string;
          kickoff_at: string;
          status?: string;
          home_score?: number | null;
          away_score?: number | null;
          winner?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string;
          round?: string;
          group_name?: string | null;
          home_team?: string;
          away_team?: string;
          kickoff_at?: string;
          status?: string;
          home_score?: number | null;
          away_score?: number | null;
          winner?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          predicted_home: number | null;
          predicted_away: number | null;
          predicted_winner: string | null;
          is_locked: boolean;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          predicted_home?: number | null;
          predicted_away?: number | null;
          predicted_winner?: string | null;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: string;
          predicted_home?: number | null;
          predicted_away?: number | null;
          predicted_winner?: string | null;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prediction_history: {
        Row: {
          id: string;
          prediction_id: string;
          predicted_home: number | null;
          predicted_away: number | null;
          predicted_winner: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          prediction_id: string;
          predicted_home?: number | null;
          predicted_away?: number | null;
          predicted_winner?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          prediction_id?: string;
          predicted_home?: number | null;
          predicted_away?: number | null;
          predicted_winner?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      champion_predictions: {
        Row: {
          id: string;
          user_id: string;
          team: string;
          is_locked: boolean;
          locked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team: string;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          team?: string;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          pool_id: string;
          match_id: string | null;
          points: number;
          reason: string;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pool_id: string;
          match_id?: string | null;
          points: number;
          reason: string;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pool_id?: string;
          match_id?: string | null;
          points?: number;
          reason?: string;
          calculated_at?: string;
        };
        Relationships: [];
      };
      sent_reminders: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: { id: string; name: string; team: string };
        Insert: { id?: string; name: string; team: string };
        Update: { id?: string; name?: string; team?: string };
        Relationships: [];
      };
      top_scorer_predictions: {
        Row: {
          id: string;
          user_id: string;
          player_name: string;
          is_locked: boolean;
          locked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          player_name: string;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          player_name?: string;
          is_locked?: boolean;
          locked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      join_pool_by_code: {
        Args: { p_invite_code: string };
        Returns: string | null;
      };
      upsert_players_data: {
        Args: { players: { name: string; team: string }[] };
        Returns: number;
      };
      is_pool_member: {
        Args: { p_pool_id: string };
        Returns: boolean;
      };
      shares_pool_with: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      get_pool_ranking: {
        Args: { p_pool_id: string };
        Returns: {
          user_id: string;
          display_name: string;
          total: number;
          exact_count: number;
          diff_count: number;
          winner_count: number;
          champion_correct: boolean;
        }[];
      };
      submit_prediction: {
        Args: {
          p_match_id: string;
          p_predicted_home: number;
          p_predicted_away: number;
          p_predicted_winner?: string | null;
        };
        Returns: undefined;
      };
      replace_match_scores: {
        Args: { p_match_id: string; p_scores: Json };
        Returns: undefined;
      };
      submit_champion: {
        Args: { p_team: string };
        Returns: undefined;
      };
      replace_champion_scores: {
        Args: { p_scores: Json };
        Returns: undefined;
      };
      recalculate_top_scorer_scores: {
        Args: { p_player_name: string };
        Returns: Json;
      };
      get_my_pools_ranking: {
        Args: Record<never, never>;
        Returns: {
          pool_id: string;
          pool_name: string;
          pool_created_by: string;
          user_id: string;
          display_name: string;
          total: number;
          rank: number;
        }[];
      };
      delete_pool: {
        Args: { p_pool_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
