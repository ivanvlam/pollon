export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          count: number
          day: string
        }
        Insert: {
          count?: number
          day?: string
        }
        Update: {
          count?: number
          day?: string
        }
        Relationships: []
      }
      champion_predictions: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          locked_at: string | null
          team: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          team: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          team?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_pen: number | null
          away_score: number | null
          away_score_90: number | null
          away_team: string
          external_id: string
          group_name: string | null
          home_pen: number | null
          home_score: number | null
          home_score_90: number | null
          home_team: string
          id: string
          is_active: boolean
          kickoff_at: string
          live_minute: string | null
          reached_extra_time: boolean
          round: string
          sdb_round: number | null
          status: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          away_pen?: number | null
          away_score?: number | null
          away_score_90?: number | null
          away_team: string
          external_id: string
          group_name?: string | null
          home_pen?: number | null
          home_score?: number | null
          home_score_90?: number | null
          home_team: string
          id?: string
          is_active?: boolean
          kickoff_at: string
          live_minute?: string | null
          reached_extra_time?: boolean
          round: string
          sdb_round?: number | null
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          away_pen?: number | null
          away_score?: number | null
          away_score_90?: number | null
          away_team?: string
          external_id?: string
          group_name?: string | null
          home_pen?: number | null
          home_score?: number | null
          home_score_90?: number | null
          home_team?: string
          id?: string
          is_active?: boolean
          kickoff_at?: string
          live_minute?: string | null
          reached_extra_time?: boolean
          round?: string
          sdb_round?: number | null
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          id: string
          name: string
          team: string
        }
        Insert: {
          id?: string
          name: string
          team: string
        }
        Update: {
          id?: string
          name?: string
          team?: string
        }
        Relationships: []
      }
      pool_members: {
        Row: {
          id: string
          joined_at: string
          pool_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          pool_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          pool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      prediction_history: {
        Row: {
          changed_at: string
          id: string
          predicted_away: number | null
          predicted_home: number | null
          predicted_winner: string | null
          prediction_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_winner?: string | null
          prediction_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_winner?: string | null
          prediction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_history_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          locked_at: string | null
          match_id: string
          predicted_away: number | null
          predicted_home: number | null
          predicted_winner: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          match_id: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_winner?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          match_id?: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_winner?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          timezone: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          timezone?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          timezone?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          calculated_at: string
          id: string
          match_id: string | null
          points: number
          pool_id: string
          reason: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          id?: string
          match_id?: string | null
          points: number
          pool_id: string
          reason: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          id?: string
          match_id?: string | null
          points?: number
          pool_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_reminders: {
        Row: {
          id: string
          match_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          match_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          match_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_reminders_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      top_scorer_predictions: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          locked_at: string | null
          player_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          player_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          player_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_pool: { Args: { p_pool_id: string }; Returns: undefined }
      get_api_usage: {
        Args: { p_days?: number }
        Returns: {
          count: number
          day: string
        }[]
      }
      get_my_pools_ranking: {
        Args: never
        Returns: {
          display_name: string
          pool_created_by: string
          pool_id: string
          pool_name: string
          rank: number
          total: number
          user_id: string
        }[]
      }
      get_pool_ranking: {
        Args: { p_pool_id: string }
        Returns: {
          champion_correct: boolean
          diff_count: number
          display_name: string
          exact_count: number
          prediction_count: number
          total: number
          user_id: string
          winner_count: number
        }[]
      }
      increment_api_usage: { Args: { p_delta: number }; Returns: undefined }
      is_in_any_pool: { Args: never; Returns: boolean }
      is_pool_member: { Args: { p_pool_id: string }; Returns: boolean }
      join_pool_by_code: { Args: { p_invite_code: string }; Returns: string }
      leave_pool: { Args: { p_pool_id: string }; Returns: undefined }
      recalculate_top_scorer_scores: {
        Args: { p_player_name: string }
        Returns: Json
      }
      remove_pool_member: {
        Args: { p_pool_id: string; p_user_id: string }
        Returns: undefined
      }
      replace_champion_scores: { Args: { p_scores: Json }; Returns: undefined }
      replace_match_scores: {
        Args: { p_match_id: string; p_scores: Json }
        Returns: undefined
      }
      replace_user_pool_scores: {
        Args: { p_pool_id: string; p_scores: Json; p_user_id: string }
        Returns: undefined
      }
      shares_pool_with: { Args: { p_user_id: string }; Returns: boolean }
      specials_revealed: { Args: never; Returns: boolean }
      submit_champion: { Args: { p_team: string }; Returns: undefined }
      submit_prediction: {
        Args: {
          p_match_id: string
          p_predicted_away: number
          p_predicted_home: number
          p_predicted_winner?: string
        }
        Returns: undefined
      }
      upsert_players_data: { Args: { players: Json }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
