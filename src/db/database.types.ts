export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      allocations: {
        Row: {
          amount_pence: number;
          category_id: string;
          id: string;
          period_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          category_id: string;
          id?: string;
          period_id: string;
          user_id?: string;
        };
        Update: {
          amount_pence?: number;
          category_id?: string;
          id?: string;
          period_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "allocations_period_id_user_id_fkey";
            columns: ["period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      budget_periods: {
        Row: {
          end_date: string;
          id: string;
          income_pence: number;
          reviewed_at: string | null;
          savings_pence: number;
          start_date: string;
          unassigned_carry_pence: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          end_date: string;
          id?: string;
          income_pence: number;
          reviewed_at?: string | null;
          savings_pence: number;
          start_date: string;
          unassigned_carry_pence?: number;
          user_id?: string;
        };
        Update: {
          end_date?: string;
          id?: string;
          income_pence?: number;
          reviewed_at?: string | null;
          savings_pence?: number;
          start_date?: string;
          unassigned_carry_pence?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      carry_adjustments: {
        Row: {
          amount_pence: number;
          created_at: string;
          fund_id: string | null;
          id: string;
          period_id: string;
          reason: string;
          source_period_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          created_at?: string;
          fund_id?: string | null;
          id?: string;
          period_id: string;
          reason: string;
          source_period_id?: string | null;
          user_id?: string;
        };
        Update: {
          amount_pence?: number;
          created_at?: string;
          fund_id?: string | null;
          id?: string;
          period_id?: string;
          reason?: string;
          source_period_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carry_adjustments_fund_id_user_id_fkey";
            columns: ["fund_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "funds";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "carry_adjustments_period_id_user_id_fkey";
            columns: ["period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "carry_adjustments_source_period_id_user_id_fkey";
            columns: ["source_period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      categories: {
        Row: {
          colour: string | null;
          icon: string | null;
          id: string;
          kind: string;
          name: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          colour?: string | null;
          icon?: string | null;
          id?: string;
          kind: string;
          name: string;
          user_id?: string;
        };
        Update: {
          colour?: string | null;
          icon?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      fund_movements: {
        Row: {
          amount_pence: number;
          date: string;
          fund_id: string;
          id: string;
          kind: string;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          date: string;
          fund_id: string;
          id?: string;
          kind: string;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          amount_pence?: number;
          date?: string;
          fund_id?: string;
          id?: string;
          kind?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fund_movements_fund_id_user_id_fkey";
            columns: ["fund_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "funds";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      funds: {
        Row: {
          id: string;
          name: string;
          opening_pence: number;
          target_date: string | null;
          target_pence: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          opening_pence?: number;
          target_date?: string | null;
          target_pence?: number | null;
          user_id?: string;
        };
        Update: {
          id?: string;
          name?: string;
          opening_pence?: number;
          target_date?: string | null;
          target_pence?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          created_at: string;
          filename: string;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          filename: string;
          id?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          filename?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      leftover_movements: {
        Row: {
          amount_pence: number;
          carried_to_period_id: string | null;
          destination: string;
          fund_id: string | null;
          id: string;
          kind: string;
          nudge_dismissed_at: string | null;
          period_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          carried_to_period_id?: string | null;
          destination: string;
          fund_id?: string | null;
          id?: string;
          kind?: string;
          nudge_dismissed_at?: string | null;
          period_id: string;
          user_id?: string;
        };
        Update: {
          amount_pence?: number;
          carried_to_period_id?: string | null;
          destination?: string;
          fund_id?: string | null;
          id?: string;
          kind?: string;
          nudge_dismissed_at?: string | null;
          period_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leftover_movements_carried_to_fkey";
            columns: ["carried_to_period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "leftover_movements_fund_id_user_id_fkey";
            columns: ["fund_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "funds";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "leftover_movements_period_id_user_id_fkey";
            columns: ["period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          budget_start_day: number;
          currency: string;
          timezone: string;
          timezone_detected: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          budget_start_day: number;
          currency?: string;
          timezone?: string;
          timezone_detected?: boolean;
          user_id?: string;
        };
        Update: {
          budget_start_day?: number;
          currency?: string;
          timezone?: string;
          timezone_detected?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_dismissals: {
        Row: {
          name_key: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          name_key: string;
          user_id?: string;
        };
        Update: {
          name_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_prices: {
        Row: {
          amount_pence: number;
          effective_from: string;
          id: string;
          rule_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          effective_from: string;
          id?: string;
          rule_id: string;
          user_id?: string;
        };
        Update: {
          amount_pence?: number;
          effective_from?: string;
          id?: string;
          rule_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_prices_rule_id_user_id_fkey";
            columns: ["rule_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "recurring_rules";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      recurring_rules: {
        Row: {
          anchor_date: string;
          category_id: string;
          end_date: string | null;
          frequency: string;
          fund_id: string | null;
          generated_through: string | null;
          id: string;
          name: string;
          paused_until: string | null;
          skipped_dates: string[];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          anchor_date: string;
          category_id: string;
          end_date?: string | null;
          frequency: string;
          fund_id?: string | null;
          generated_through?: string | null;
          id?: string;
          name: string;
          paused_until?: string | null;
          skipped_dates?: string[];
          user_id?: string;
        };
        Update: {
          anchor_date?: string;
          category_id?: string;
          end_date?: string | null;
          frequency?: string;
          fund_id?: string | null;
          generated_through?: string | null;
          id?: string;
          name?: string;
          paused_until?: string | null;
          skipped_dates?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "recurring_rules_fund_id_user_id_fkey";
            columns: ["fund_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "funds";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      savings_prompts: {
        Row: {
          period_id: string;
          split: NonNullable<Json>;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          period_id: string;
          split?: NonNullable<Json>;
          status: string;
          user_id?: string;
        };
        Update: {
          period_id?: string;
          split?: NonNullable<Json>;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_prompts_period_id_user_id_fkey";
            columns: ["period_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_label: string | null;
          amount_pence: number;
          category_id: string;
          date: string;
          external_id: string | null;
          fund_id: string | null;
          id: string;
          import_batch_id: string | null;
          name: string;
          notes: string | null;
          recurring_rule_id: string | null;
          source: string;
          trip_id: string | null;
          trip_override: boolean;
          unchecked: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_label?: string | null;
          amount_pence: number;
          category_id: string;
          date: string;
          external_id?: string | null;
          fund_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          name: string;
          notes?: string | null;
          recurring_rule_id?: string | null;
          source?: string;
          trip_id?: string | null;
          trip_override?: boolean;
          unchecked?: boolean;
          user_id?: string;
        };
        Update: {
          account_label?: string | null;
          amount_pence?: number;
          category_id?: string;
          date?: string;
          external_id?: string | null;
          fund_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          name?: string;
          notes?: string | null;
          recurring_rule_id?: string | null;
          source?: string;
          trip_id?: string | null;
          trip_override?: boolean;
          unchecked?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "transactions_fund_id_user_id_fkey";
            columns: ["fund_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "funds";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "transactions_import_batch_id_user_id_fkey";
            columns: ["import_batch_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_user_id_fkey";
            columns: ["recurring_rule_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "recurring_rules";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "transactions_trip_id_user_id_fkey";
            columns: ["trip_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      trips: {
        Row: {
          end_date: string;
          id: string;
          name: string;
          place: string | null;
          start_date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          end_date: string;
          id?: string;
          name: string;
          place?: string | null;
          start_date: string;
          user_id?: string;
        };
        Update: {
          end_date?: string;
          id?: string;
          name?: string;
          place?: string | null;
          start_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_recurring_price: {
        Args: { p_amount_pence: number; p_checked_id?: string; p_from: string; p_rule_id: string; p_updates: Json };
        Returns: undefined;
      };
      complete_onboarding: {
        Args: {
          p_categories: Json;
          p_end: string;
          p_funds: Json;
          p_income_pence: number;
          p_savings_pence: number;
          p_start: string;
          p_start_day: number;
        };
        Returns: string;
      };
      confirm_savings_split: { Args: { p_date: string; p_period_id: string; p_split: Json }; Returns: undefined };
      create_recurring_rule: {
        Args: {
          p_amount_pence: number;
          p_anchor_date: string;
          p_category_id: string;
          p_frequency: string;
          p_fund_id?: string;
          p_link_ids?: string[];
          p_name: string;
        };
        Returns: string;
      };
      delete_category: { Args: { p_category_id: string; p_period_id: string }; Returns: undefined };
      import_expenses: { Args: { p_filename: string; p_rows: Json; p_today: string }; Returns: Json };
      move_between_funds: {
        Args: { p_amount_pence: number; p_date: string; p_from_id: string; p_note?: string; p_to_id: string };
        Returns: undefined;
      };
      raise_allocation: {
        Args: { p_amount_pence: number; p_category_id: string; p_next_end: string; p_period_id: string };
        Returns: undefined;
      };
      record_leftover: {
        Args: {
          p_amount_pence: number;
          p_destination?: string;
          p_fund_id?: string;
          p_new_fund_name?: string;
          p_period_id: string;
          p_today: string;
        };
        Returns: undefined;
      };
      remove_from_budget: {
        Args: { p_category_id: string; p_next_end: string; p_period_id: string; p_scope: string };
        Returns: undefined;
      };
      renew_period: {
        Args: { p_end: string; p_start: string };
        Returns: {
          end_date: string;
          id: string;
          income_pence: number;
          reviewed_at: string | null;
          savings_pence: number;
          start_date: string;
          unassigned_carry_pence: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "budget_periods";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_budget: {
        Args: {
          p_categories: Json;
          p_income_pence: number;
          p_next_end: string;
          p_period_id: string;
          p_savings_pence: number;
          p_scope: string;
        };
        Returns: undefined;
      };
      save_expense: {
        Args: {
          p_account_label?: string;
          p_amount_pence: number;
          p_amount_scope?: string;
          p_category_id?: string;
          p_date: string;
          p_fund_id?: string;
          p_id?: string;
          p_name: string;
          p_new_category_kind?: string;
          p_new_category_name?: string;
          p_notes?: string;
          p_price_updates?: Json;
          p_repeat?: string;
          p_trip?: string;
        };
        Returns: string;
      };
      undo_import: { Args: { p_batch_id: string }; Returns: number };
      withdraw_from_fund: {
        Args: { p_amount_pence: number; p_date: string; p_fund_id: string; p_note?: string; p_to_period_id?: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
