export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      uber_week_plans: {
        Row: { owner_id: string; week_start: string; weekly_target: string; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      uber_week_plan_days: {
        Row: { owner_id: string; week_start: string; date: string; is_working: boolean; work_weight: "light" | "normal" | "heavy"; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      uber_day_records: {
        Row: { owner_id: string; date: string; gross_earnings: string; business_miles: string; trips: number; status: "working" | "completed" | "missed"; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      uber_sessions: {
        Row: { owner_id: string; date: string; status: "active" | "paused" | "completed"; last_resumed_at: string; active_seconds: number; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_uber_week_plan: { Args: { p_week_start: string; p_weekly_target: number; p_working_days: boolean[] }; Returns: Database["public"]["Tables"]["uber_week_plans"]["Row"] };
      set_uber_weekly_target: { Args: { p_week_start: string; p_weekly_target: number }; Returns: Database["public"]["Tables"]["uber_week_plans"]["Row"] };
      set_uber_week_plan_day: { Args: { p_week_start: string; p_date: string; p_is_working: boolean }; Returns: Database["public"]["Tables"]["uber_week_plan_days"]["Row"] };
      set_uber_week_plan_day_weight: { Args: { p_week_start: string; p_date: string; p_is_working: boolean; p_work_weight: "light" | "normal" | "heavy" }; Returns: Database["public"]["Tables"]["uber_week_plan_days"]["Row"] };
      set_uber_week_plan_weights: { Args: { p_week_start: string; p_weights: Array<"light" | "normal" | "heavy" | null> }; Returns: Database["public"]["Tables"]["uber_week_plan_days"]["Row"][] };
      upsert_uber_day_record: { Args: { p_date: string; p_gross_earnings: number; p_business_miles: number; p_trips: number; p_status: "working" | "completed" }; Returns: Database["public"]["Tables"]["uber_day_records"]["Row"] };
      mark_uber_day_missed: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_day_records"]["Row"] };
      get_uber_session: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_sessions"]["Row"][] };
      start_uber_session: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_sessions"]["Row"] };
      pause_uber_session: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_sessions"]["Row"] };
      resume_uber_session: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_sessions"]["Row"] };
      end_uber_session: { Args: { p_date: string }; Returns: Database["public"]["Tables"]["uber_sessions"]["Row"] };
    };
    Enums: { uber_day_status: "working" | "completed" | "missed"; uber_plan_day_weight: "light" | "normal" | "heavy"; uber_session_status: "active" | "paused" | "completed" };
    CompositeTypes: Record<string, never>;
  };
}
