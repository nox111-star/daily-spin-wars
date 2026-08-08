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
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          team: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          team?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
          created_at: string
          emergency_count: number
          emergency_date: string | null
          last_ticket_at: string
          messages_sent: number
          pending_quiz: number | null
          quiz_answered: number
          quiz_correct: number
          team: string | null
          team_week: string | null
          tickets: number
          total_points: number
          user_id: string
          week_points: number
          week_ref: string | null
          wheel_extra_date: string | null
          wheel_free_date: string | null
          wheel_spins: number
        }
        Insert: {
          created_at?: string
          emergency_count?: number
          emergency_date?: string | null
          last_ticket_at?: string
          messages_sent?: number
          pending_quiz?: number | null
          quiz_answered?: number
          quiz_correct?: number
          team?: string | null
          team_week?: string | null
          tickets?: number
          total_points?: number
          user_id: string
          week_points?: number
          week_ref?: string | null
          wheel_extra_date?: string | null
          wheel_free_date?: string | null
          wheel_spins?: number
        }
        Update: {
          created_at?: string
          emergency_count?: number
          emergency_date?: string | null
          last_ticket_at?: string
          messages_sent?: number
          pending_quiz?: number | null
          quiz_answered?: number
          quiz_correct?: number
          team?: string | null
          team_week?: string | null
          tickets?: number
          total_points?: number
          user_id?: string
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
          title: string
          username: string
        }
        Insert: {
          avatar?: string
          created_at?: string
          credits?: number
          frame?: string
          id: string
          title?: string
          username: string
        }
        Update: {
          avatar?: string
          created_at?: string
          credits?: number
          frame?: string
          id?: string
          title?: string
          username?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          correct: number
          id: number
          options: Json
          question: string
          quip: string
        }
        Insert: {
          correct: number
          id?: number
          options: Json
          question: string
          quip: string
        }
        Update: {
          correct?: number
          id?: number
          options?: Json
          question?: string
          quip?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          id: string
          kind: string
          name: string
          price: number
          sort: number
          value: string
        }
        Insert: {
          id: string
          kind: string
          name: string
          price: number
          sort?: number
          value: string
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          price?: number
          sort?: number
          value?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          prize_champion: string
          prize_team: string
          settled: boolean
          team_a: string
          team_b: string
          week_start: string
        }
        Insert: {
          prize_champion: string
          prize_team: string
          settled?: boolean
          team_a: string
          team_b: string
          week_start: string
        }
        Update: {
          prize_champion?: string
          prize_team?: string
          settled?: boolean
          team_a?: string
          team_b?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      answer_quiz: { Args: { p_choice: number; p_id: number }; Returns: Json }
      bootstrap_player: { Args: { p_username: string }; Returns: undefined }
      buy_item: { Args: { p_id: string; p_with_ad: boolean }; Returns: Json }
      choose_team: { Args: { p_team: string }; Returns: Json }
      claim_mission: { Args: { p_id: string }; Returns: Json }
      current_week_start: { Args: never; Returns: string }
      draw_quiz: { Args: never; Returns: Json }
      emergency_tickets: { Args: { p_mode: string }; Returns: Json }
      ensure_week: {
        Args: never
        Returns: {
          prize_champion: string
          prize_team: string
          settled: boolean
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
      leaderboard: { Args: never; Returns: Json }
      list_missions: { Args: never; Returns: Json }
      send_message: { Args: { p_content: string }; Returns: Json }
      spin_morning_wheel: { Args: { p_extra: boolean }; Returns: Json }
      spin_team_wheel: { Args: never; Returns: Json }
      switch_team_after_ad: { Args: never; Returns: Json }
      sync_player: {
        Args: { uid: string }
        Returns: {
          created_at: string
          emergency_count: number
          emergency_date: string | null
          last_ticket_at: string
          messages_sent: number
          pending_quiz: number | null
          quiz_answered: number
          quiz_correct: number
          team: string | null
          team_week: string | null
          tickets: number
          total_points: number
          user_id: string
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
  public: {
    Enums: {},
  },
} as const
