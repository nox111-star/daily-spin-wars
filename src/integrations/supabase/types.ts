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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ad_tokens: {
        Row: {
          consumed: boolean
          created_at: string
          id: string
          purpose: string
          user_id: string
          verified: boolean
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          id?: string
          purpose: string
          user_id: string
          verified?: boolean
        }
        Update: {
          consumed?: boolean
          created_at?: string
          id?: string
          purpose?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          detail: Json | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json | null
          id?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json | null
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      auto_jobs: {
        Row: {
          created_at: string
          enabled: boolean
          job: string
          last_run_date: string | null
          last_run_detail: Json | null
          payload: Json
          run_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          job: string
          last_run_date?: string | null
          last_run_detail?: Json | null
          payload?: Json
          run_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          job?: string
          last_run_date?: string | null
          last_run_detail?: Json | null
          payload?: Json
          run_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          clear_chat: boolean
          created_at: string
          enabled: boolean
          id: boolean
          last_run_date: string | null
          last_run_detail: Json | null
          refresh_wheel: boolean
          run_at: string
          season_end_dow: number
          updated_at: string
          wheel_template: Json
        }
        Insert: {
          clear_chat?: boolean
          created_at?: string
          enabled?: boolean
          id?: boolean
          last_run_date?: string | null
          last_run_detail?: Json | null
          refresh_wheel?: boolean
          run_at?: string
          season_end_dow?: number
          updated_at?: string
          wheel_template?: Json
        }
        Update: {
          clear_chat?: boolean
          created_at?: string
          enabled?: boolean
          id?: boolean
          last_run_date?: string | null
          last_run_detail?: Json | null
          refresh_wheel?: boolean
          run_at?: string
          season_end_dow?: number
          updated_at?: string
          wheel_template?: Json
        }
        Relationships: []
      }
      chat_presets: {
        Row: {
          active: boolean
          id: string
          kind: string
          label: string
          sort: number
        }
        Insert: {
          active?: boolean
          id: string
          kind: string
          label: string
          sort?: number
        }
        Update: {
          active?: boolean
          id?: string
          kind?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      collection: {
        Row: {
          created_at: string
          id: string
          item_name: string
          item_type: string
          item_value: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          item_type: string
          item_value: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          item_type?: string
          item_value?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      cosmetic_styles: {
        Row: {
          active: boolean
          created_at: string
          kind: string
          name: string
          style: Json
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          kind?: string
          name: string
          style?: Json
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          kind?: string
          name?: string
          style?: Json
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      game_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          preset_id: string | null
          team: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          preset_id?: string | null
          team?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          preset_id?: string | null
          team?: string | null
          user_id?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          description: string
          id: string
          metric: string
          reward_name: string
          reward_type: string
          reward_value: string
          sort: number
          target: number
          title: string
        }
        Insert: {
          description: string
          id: string
          metric: string
          reward_name: string
          reward_type: string
          reward_value: string
          sort?: number
          target: number
          title: string
        }
        Update: {
          description?: string
          id?: string
          metric?: string
          reward_name?: string
          reward_type?: string
          reward_value?: string
          sort?: number
          target?: number
          title?: string
        }
        Relationships: []
      }
      player_state: {
        Row: {
          base_left: number
          bonus_left: number
          created_at: string
          day_results: Json
          emergency_count: number
          emergency_date: string | null
          last_ticket_at: string
          messages_sent: number
          pending_difficulty: string | null
          pending_quiz: number | null
          pending_started_at: string | null
          quiz_answered: number
          quiz_correct: number
          quiz_index: number
          streak_count: number
          streak_date: string | null
          streak_missed: number
          streak_prev: number
          streak_rewards: number
          team: string | null
          team_locked: boolean
          team_proposal: string | null
          team_week: string | null
          ticket_date: string | null
          tickets: number
          total_points: number
          user_id: string
          videos_used: number
          week_points: number
          week_ref: string | null
          wheel_extra_date: string | null
          wheel_free_date: string | null
          wheel_spins: number
        }
        Insert: {
          base_left?: number
          bonus_left?: number
          created_at?: string
          day_results?: Json
          emergency_count?: number
          emergency_date?: string | null
          last_ticket_at?: string
          messages_sent?: number
          pending_difficulty?: string | null
          pending_quiz?: number | null
          pending_started_at?: string | null
          quiz_answered?: number
          quiz_correct?: number
          quiz_index?: number
          streak_count?: number
          streak_date?: string | null
          streak_missed?: number
          streak_prev?: number
          streak_rewards?: number
          team?: string | null
          team_locked?: boolean
          team_proposal?: string | null
          team_week?: string | null
          ticket_date?: string | null
          tickets?: number
          total_points?: number
          user_id: string
          videos_used?: number
          week_points?: number
          week_ref?: string | null
          wheel_extra_date?: string | null
          wheel_free_date?: string | null
          wheel_spins?: number
        }
        Update: {
          base_left?: number
          bonus_left?: number
          created_at?: string
          day_results?: Json
          emergency_count?: number
          emergency_date?: string | null
          last_ticket_at?: string
          messages_sent?: number
          pending_difficulty?: string | null
          pending_quiz?: number | null
          pending_started_at?: string | null
          quiz_answered?: number
          quiz_correct?: number
          quiz_index?: number
          streak_count?: number
          streak_date?: string | null
          streak_missed?: number
          streak_prev?: number
          streak_rewards?: number
          team?: string | null
          team_locked?: boolean
          team_proposal?: string | null
          team_week?: string | null
          ticket_date?: string | null
          tickets?: number
          total_points?: number
          user_id?: string
          videos_used?: number
          week_points?: number
          week_ref?: string | null
          wheel_extra_date?: string | null
          wheel_free_date?: string | null
          wheel_spins?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          created_at: string
          credits: number
          frame: string
          id: string
          last_seen: string
          title: string
          username: string
        }
        Insert: {
          avatar?: string
          created_at?: string
          credits?: number
          frame?: string
          id: string
          last_seen?: string
          title?: string
          username: string
        }
        Update: {
          avatar?: string
          created_at?: string
          credits?: number
          frame?: string
          id?: string
          last_seen?: string
          title?: string
          username?: string
        }
        Relationships: []
      }
      quiz_history: {
        Row: {
          quiz_id: number
          seen_at: string
          user_id: string
        }
        Insert: {
          quiz_id: number
          seen_at?: string
          user_id: string
        }
        Update: {
          quiz_id?: number
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          active: boolean
          correct: number
          credits: number | null
          difficulty: string
          id: number
          options: Json
          points: number | null
          question: string
          quip: string
        }
        Insert: {
          active?: boolean
          correct: number
          credits?: number | null
          difficulty?: string
          id?: number
          options: Json
          points?: number | null
          question: string
          quip: string
        }
        Update: {
          active?: boolean
          correct?: number
          credits?: number | null
          difficulty?: string
          id?: number
          options?: Json
          points?: number | null
          question?: string
          quip?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          active: boolean
          id: string
          kind: string
          name: string
          price: number
          sort: number
          unlock_mode: string
          value: string
          video_price: number
        }
        Insert: {
          active?: boolean
          id: string
          kind: string
          name: string
          price: number
          sort?: number
          unlock_mode?: string
          value: string
          video_price?: number
        }
        Update: {
          active?: boolean
          id?: string
          kind?: string
          name?: string
          price?: number
          sort?: number
          unlock_mode?: string
          value?: string
          video_price?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          champion_frame: string
          ends_at: string | null
          prize_champion: string
          prize_team: string
          settled: boolean
          starts_at: string | null
          streak_reward: Json
          team_a: string
          team_b: string
          week_start: string
        }
        Insert: {
          champion_frame?: string
          ends_at?: string | null
          prize_champion: string
          prize_team: string
          settled?: boolean
          starts_at?: string | null
          streak_reward?: Json
          team_a: string
          team_b: string
          week_start: string
        }
        Update: {
          champion_frame?: string
          ends_at?: string | null
          prize_champion?: string
          prize_team?: string
          settled?: boolean
          starts_at?: string | null
          streak_reward?: Json
          team_a?: string
          team_b?: string
          week_start?: string
        }
        Relationships: []
      }
      wheel_days: {
        Row: {
          created_at: string
          day: string
          prizes: Json
        }
        Insert: {
          created_at?: string
          day: string
          prizes: Json
        }
        Update: {
          created_at?: string
          day?: string
          prizes?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team: { Args: never; Returns: Json }
      admin_bulk_quiz: { Args: { p_items: Json }; Returns: Json }
      admin_clear_chat: { Args: { p_hours: number }; Returns: Json }
      admin_delete_cosmetic_style: { Args: { p_value: string }; Returns: Json }
      admin_delete_quiz: { Args: { p_id: number }; Returns: Json }
      admin_delete_shop_item: { Args: { p_id: string }; Returns: Json }
      admin_get_automation: { Args: never; Returns: Json }
      admin_list_jobs: { Args: never; Returns: Json }
      admin_list_quizzes: { Args: never; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      admin_run_automation: { Args: never; Returns: Json }
      admin_run_job: { Args: { p_job: string }; Returns: Json }
      admin_run_rollover: { Args: never; Returns: Json }
      admin_set_automation: {
        Args: {
          p_clear_chat: boolean
          p_enabled: boolean
          p_refresh_wheel: boolean
          p_run_at: string
          p_season_end_dow: number
          p_wheel_template: Json
        }
        Returns: Json
      }
      admin_set_config: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_set_job: {
        Args: {
          p_enabled: boolean
          p_job: string
          p_payload: Json
          p_run_at: string
        }
        Returns: Json
      }
      admin_set_week:
        | {
            Args: {
              p_ends_at: string
              p_prize_champion: string
              p_prize_team: string
              p_starts_at: string
              p_team_a: string
              p_team_b: string
              p_week_start: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_champion_frame?: string
              p_ends_at: string
              p_prize_champion: string
              p_prize_team: string
              p_starts_at: string
              p_team_a: string
              p_team_b: string
              p_week_start: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_champion_frame?: string
              p_ends_at: string
              p_prize_champion: string
              p_prize_team: string
              p_starts_at: string
              p_streak_reward?: Json
              p_team_a: string
              p_team_b: string
              p_week_start: string
            }
            Returns: Json
          }
      admin_set_wheel_day: {
        Args: { p_day: string; p_prizes: Json }
        Returns: Json
      }
      admin_settle_week: { Args: { p_week: string }; Returns: Json }
      admin_upsert_cosmetic_style: {
        Args: {
          p_active: boolean
          p_kind: string
          p_name: string
          p_style: Json
          p_value: string
        }
        Returns: Json
      }
      admin_upsert_preset: {
        Args: {
          p_active: boolean
          p_id: string
          p_kind: string
          p_label: string
          p_sort: number
        }
        Returns: Json
      }
      admin_upsert_shop_item:
        | {
            Args: {
              p_active: boolean
              p_id: string
              p_kind: string
              p_name: string
              p_price: number
              p_sort: number
              p_value: string
              p_video_price: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_active: boolean
              p_id: string
              p_kind: string
              p_name: string
              p_price: number
              p_sort: number
              p_unlock_mode?: string
              p_value: string
              p_video_price: number
            }
            Returns: Json
          }
      answer_quiz: { Args: { p_choice: number; p_id: number }; Returns: Json }
      audit: {
        Args: { p_action: string; p_detail: Json; uid: string }
        Returns: undefined
      }
      bootstrap_player: { Args: { p_username: string }; Returns: undefined }
      buy_item: { Args: { p_id: string; p_tokens: string[] }; Returns: Json }
      can_join: { Args: { p_team: string; ws: string }; Returns: boolean }
      choose_team: { Args: { p_team: string }; Returns: Json }
      claim_ad_ticket: { Args: { p_token: string }; Returns: Json }
      claim_mission: { Args: { p_id: string }; Returns: Json }
      consume_ad_token: {
        Args: { p_purpose: string; p_token: string; uid: string }
        Returns: undefined
      }
      current_week_start: { Args: never; Returns: string }
      draw_quiz: { Args: never; Returns: Json }
      ensure_proposal: {
        Args: { uid: string }
        Returns: {
          base_left: number
          bonus_left: number
          created_at: string
          day_results: Json
          emergency_count: number
          emergency_date: string | null
          last_ticket_at: string
          messages_sent: number
          pending_difficulty: string | null
          pending_quiz: number | null
          pending_started_at: string | null
          quiz_answered: number
          quiz_correct: number
          quiz_index: number
          streak_count: number
          streak_date: string | null
          streak_missed: number
          streak_prev: number
          streak_rewards: number
          team: string | null
          team_locked: boolean
          team_proposal: string | null
          team_week: string | null
          ticket_date: string | null
          tickets: number
          total_points: number
          user_id: string
          videos_used: number
          week_points: number
          week_ref: string | null
          wheel_extra_date: string | null
          wheel_free_date: string | null
          wheel_spins: number
        }
        SetofOptions: {
          from: "*"
          to: "player_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_week: {
        Args: never
        Returns: {
          champion_frame: string
          ends_at: string | null
          prize_champion: string
          prize_team: string
          settled: boolean
          starts_at: string | null
          streak_reward: Json
          team_a: string
          team_b: string
          week_start: string
        }
        SetofOptions: {
          from: "*"
          to: "weeks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_wheel_schedule: { Args: never; Returns: undefined }
      equip_item: { Args: { p_type: string; p_value: string }; Returns: Json }
      get_state: { Args: never; Returns: Json }
      grant_item: {
        Args: {
          iname: string
          isource: string
          itype: string
          ivalue: string
          uid: string
        }
        Returns: undefined
      }
      grant_reward: {
        Args: { p_reward: Json; p_source: string; uid: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      issue_ad_token: { Args: { p_purpose: string }; Returns: string }
      leaderboard: { Args: never; Returns: Json }
      list_missions: { Args: never; Returns: Json }
      rate_guard: {
        Args: {
          p_action: string
          p_max: number
          p_seconds: number
          uid: string
        }
        Returns: undefined
      }
      require_admin: { Args: never; Returns: string }
      restore_streak: { Args: { p_tokens: string[] }; Returns: Json }
      run_automation: { Args: { p_force?: boolean }; Returns: Json }
      run_job: { Args: { p_force?: boolean; p_job: string }; Returns: Json }
      run_jobs: { Args: never; Returns: Json }
      run_rollover: { Args: never; Returns: Json }
      send_message: { Args: { p_preset: string }; Returns: Json }
      settle_week: { Args: { p_week: string }; Returns: Json }
      spin_morning_wheel: {
        Args: { p_extra: boolean; p_token: string }
        Returns: Json
      }
      swap_team: { Args: { p_token: string }; Returns: Json }
      sync_player: {
        Args: { uid: string }
        Returns: {
          base_left: number
          bonus_left: number
          created_at: string
          day_results: Json
          emergency_count: number
          emergency_date: string | null
          last_ticket_at: string
          messages_sent: number
          pending_difficulty: string | null
          pending_quiz: number | null
          pending_started_at: string | null
          quiz_answered: number
          quiz_correct: number
          quiz_index: number
          streak_count: number
          streak_date: string | null
          streak_missed: number
          streak_prev: number
          streak_rewards: number
          team: string | null
          team_locked: boolean
          team_proposal: string | null
          team_week: string | null
          ticket_date: string | null
          tickets: number
          total_points: number
          user_id: string
          videos_used: number
          week_points: number
          week_ref: string | null
          wheel_extra_date: string | null
          wheel_free_date: string | null
          wheel_spins: number
        }
        SetofOptions: {
          from: "*"
          to: "player_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      team_counts: {
        Args: { ws: string }
        Returns: {
          a: number
          b: number
        }[]
      }
      team_leaderboard: { Args: never; Returns: Json }
      touch_streak: { Args: { uid: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
