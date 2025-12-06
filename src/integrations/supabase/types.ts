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
          yellow_zone_max: number
        }
        Insert: {
          created_at?: string
          green_zone_max: number
          id?: string
          name: string
          statistical_params: Json
          yellow_zone_max: number
        }
        Update: {
          created_at?: string
          green_zone_max?: number
          id?: string
          name?: string
          statistical_params?: Json
          yellow_zone_max?: number
        }
        Relationships: []
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
          zone_status?: Database["public"]["Enums"]["zone_status"] | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
