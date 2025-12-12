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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      baselines: {
        Row: {
          created_at: string
          green_zone_max: number
          id: string
          name: string
          statistical_params: Json
          team_id: string | null
          user_id: string | null
          yellow_zone_max: number
        }
        Insert: {
          created_at?: string
          green_zone_max: number
          id?: string
          name: string
          statistical_params: Json
          team_id?: string | null
          user_id?: string | null
          yellow_zone_max: number
        }
        Update: {
          created_at?: string
          green_zone_max?: number
          id?: string
          name?: string
          statistical_params?: Json
          team_id?: string | null
          user_id?: string | null
          yellow_zone_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "baselines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_progress: {
        Row: {
          created_at: string
          current_heuristic: string | null
          current_phase: string
          evaluation_id: string
          id: string
          message: string | null
          progress_percent: number
          tests_completed: number | null
          tests_total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_heuristic?: string | null
          current_phase?: string
          evaluation_id: string
          id?: string
          message?: string | null
          progress_percent?: number
          tests_completed?: number | null
          tests_total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_heuristic?: string | null
          current_phase?: string
          evaluation_id?: string
          id?: string
          message?: string | null
          progress_percent?: number
          tests_completed?: number | null
          tests_total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_progress_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_settings: {
        Row: {
          alert_emails: string[] | null
          alert_threshold: string | null
          confidence_interval: number | null
          created_at: string
          id: string
          keep_temperature_constant: boolean | null
          protected_attributes: string[] | null
          report_emails: string[] | null
          sample_size: number | null
          schedule_day: number | null
          schedule_frequency: string | null
          schedule_time: string | null
          selected_heuristics: string[] | null
          team_id: string
          temperature: number | null
          test_suites: string[] | null
          updated_at: string
        }
        Insert: {
          alert_emails?: string[] | null
          alert_threshold?: string | null
          confidence_interval?: number | null
          created_at?: string
          id?: string
          keep_temperature_constant?: boolean | null
          protected_attributes?: string[] | null
          report_emails?: string[] | null
          sample_size?: number | null
          schedule_day?: number | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          selected_heuristics?: string[] | null
          team_id: string
          temperature?: number | null
          test_suites?: string[] | null
          updated_at?: string
        }
        Update: {
          alert_emails?: string[] | null
          alert_threshold?: string | null
          confidence_interval?: number | null
          created_at?: string
          id?: string
          keep_temperature_constant?: boolean | null
          protected_attributes?: string[] | null
          report_emails?: string[] | null
          sample_size?: number | null
          schedule_day?: number | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          selected_heuristics?: string[] | null
          team_id?: string
          temperature?: number | null
          test_suites?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          ai_system_name: string
          completed_at: string | null
          created_at: string
          heuristic_types: Json
          id: string
          iteration_count: number
          overall_score: number | null
          status: Database["public"]["Enums"]["evaluation_status"]
          team_id: string | null
          user_id: string | null
          zone_status: Database["public"]["Enums"]["zone_status"] | null
        }
        Insert: {
          ai_system_name: string
          completed_at?: string | null
          created_at?: string
          heuristic_types: Json
          id?: string
          iteration_count: number
          overall_score?: number | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          team_id?: string | null
          user_id?: string | null
          zone_status?: Database["public"]["Enums"]["zone_status"] | null
        }
        Update: {
          ai_system_name?: string
          completed_at?: string | null
          created_at?: string
          heuristic_types?: Json
          id?: string
          iteration_count?: number
          overall_score?: number | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          team_id?: string | null
          user_id?: string | null
          zone_status?: Database["public"]["Enums"]["zone_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      heuristic_findings: {
        Row: {
          confidence_level: number
          created_at: string
          detection_count: number
          evaluation_id: string
          example_instances: Json
          heuristic_type: Database["public"]["Enums"]["heuristic_type"]
          id: string
          pattern_description: string
          severity: Database["public"]["Enums"]["severity_level"]
          severity_score: number
        }
        Insert: {
          confidence_level: number
          created_at?: string
          detection_count: number
          evaluation_id: string
          example_instances: Json
          heuristic_type: Database["public"]["Enums"]["heuristic_type"]
          id?: string
          pattern_description: string
          severity: Database["public"]["Enums"]["severity_level"]
          severity_score: number
        }
        Update: {
          confidence_level?: number
          created_at?: string
          detection_count?: number
          evaluation_id?: string
          example_instances?: Json
          heuristic_type?: Database["public"]["Enums"]["heuristic_type"]
          id?: string
          pattern_description?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          severity_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "heuristic_findings_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_configurations: {
        Row: {
          api_key_encrypted: string | null
          base_url: string | null
          created_at: string
          display_name: string
          environment: string | null
          id: string
          is_connected: boolean | null
          last_tested_at: string | null
          model_name: string
          model_version: string | null
          provider: string
          schedule_frequency: string | null
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          base_url?: string | null
          created_at?: string
          display_name: string
          environment?: string | null
          id?: string
          is_connected?: boolean | null
          last_tested_at?: string | null
          model_name: string
          model_version?: string | null
          provider: string
          schedule_frequency?: string | null
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          base_url?: string | null
          created_at?: string
          display_name?: string
          environment?: string | null
          id?: string
          is_connected?: boolean | null
          last_tested_at?: string | null
          model_name?: string
          model_version?: string | null
          provider?: string
          schedule_frequency?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_configurations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email_verified_at: string | null
          full_name: string | null
          id: string
          job_title: string | null
          onboarding_completed: boolean | null
          team_id: string | null
          tos_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          onboarding_completed?: boolean | null
          team_id?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          onboarding_completed?: boolean | null
          team_id?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          action_title: string
          created_at: string
          estimated_impact: Database["public"]["Enums"]["impact_level"]
          evaluation_id: string
          heuristic_type: string
          id: string
          implementation_difficulty: Database["public"]["Enums"]["difficulty_level"]
          priority: number
          simplified_description: string
          technical_description: string
        }
        Insert: {
          action_title: string
          created_at?: string
          estimated_impact: Database["public"]["Enums"]["impact_level"]
          evaluation_id: string
          heuristic_type: string
          id?: string
          implementation_difficulty: Database["public"]["Enums"]["difficulty_level"]
          priority: number
          simplified_description: string
          technical_description: string
        }
        Update: {
          action_title?: string
          created_at?: string
          estimated_impact?: Database["public"]["Enums"]["impact_level"]
          evaluation_id?: string
          heuristic_type?: string
          id?: string
          implementation_difficulty?: Database["public"]["Enums"]["difficulty_level"]
          priority?: number
          simplified_description?: string
          technical_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          billing_contact_name: string | null
          billing_email: string | null
          company_size: string | null
          created_at: string
          dpa_accepted_at: string | null
          dpa_version: string | null
          headquarters_country: string | null
          headquarters_state: string | null
          id: string
          industry: string[] | null
          name: string
          updated_at: string
        }
        Insert: {
          billing_contact_name?: string | null
          billing_email?: string | null
          company_size?: string | null
          created_at?: string
          dpa_accepted_at?: string | null
          dpa_version?: string | null
          headquarters_country?: string | null
          headquarters_state?: string | null
          id?: string
          industry?: string[] | null
          name: string
          updated_at?: string
        }
        Update: {
          billing_contact_name?: string | null
          billing_email?: string | null
          company_size?: string | null
          created_at?: string
          dpa_accepted_at?: string | null
          dpa_version?: string | null
          headquarters_country?: string | null
          headquarters_state?: string | null
          id?: string
          industry?: string[] | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      llm_configurations_safe: {
        Row: {
          base_url: string | null
          created_at: string | null
          display_name: string | null
          environment: string | null
          id: string | null
          is_connected: boolean | null
          last_tested_at: string | null
          model_name: string | null
          model_version: string | null
          provider: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          base_url?: string | null
          created_at?: string | null
          display_name?: string | null
          environment?: string | null
          id?: string | null
          is_connected?: boolean | null
          last_tested_at?: string | null
          model_name?: string | null
          model_version?: string | null
          provider?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          base_url?: string | null
          created_at?: string | null
          display_name?: string | null
          environment?: string | null
          id?: string | null
          is_connected?: boolean | null
          last_tested_at?: string | null
          model_name?: string | null
          model_version?: string | null
          provider?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_configurations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "evaluator" | "viewer"
      difficulty_level: "easy" | "moderate" | "complex"
      evaluation_status: "pending" | "running" | "completed" | "failed"
      heuristic_type:
        | "anchoring"
        | "loss_aversion"
        | "sunk_cost"
        | "confirmation_bias"
        | "availability_heuristic"
      impact_level: "low" | "medium" | "high"
      severity_level: "low" | "medium" | "high" | "critical"
      zone_status: "green" | "yellow" | "red"
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
      app_role: ["owner", "admin", "evaluator", "viewer"],
      difficulty_level: ["easy", "moderate", "complex"],
      evaluation_status: ["pending", "running", "completed", "failed"],
      heuristic_type: [
        "anchoring",
        "loss_aversion",
        "sunk_cost",
        "confirmation_bias",
        "availability_heuristic",
      ],
      impact_level: ["low", "medium", "high"],
      severity_level: ["low", "medium", "high", "critical"],
      zone_status: ["green", "yellow", "red"],
    },
  },
} as const
