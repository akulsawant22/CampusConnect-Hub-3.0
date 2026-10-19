export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string;
          checked_in_by: string | null;
          event_id: string;
          id: string;
          registration_id: string;
          user_id: string;
        };
        Insert: {
          checked_in_at?: string;
          checked_in_by?: string | null;
          event_id: string;
          id?: string;
          registration_id: string;
          user_id: string;
        };
        Update: {
          checked_in_at?: string;
          checked_in_by?: string | null;
          event_id?: string;
          id?: string;
          registration_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_checked_in_by_fkey";
            columns: ["checked_in_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          event_id: string;
          id: string;
          issued_at: string;
          issued_by: string | null;
          registration_id: string;
          serial: string;
          user_id: string;
        };
        Insert: {
          event_id: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          registration_id: string;
          serial?: string;
          user_id: string;
        };
        Update: {
          event_id?: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          registration_id?: string;
          serial?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_staff: {
        Row: {
          assigned_by: string | null;
          can_scan: boolean;
          can_view_attendance: boolean;
          can_view_registrations: boolean;
          created_at: string;
          event_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          can_scan?: boolean;
          can_view_attendance?: boolean;
          can_view_registrations?: boolean;
          created_at?: string;
          event_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          assigned_by?: string | null;
          can_scan?: boolean;
          can_view_attendance?: boolean;
          can_view_registrations?: boolean;
          created_at?: string;
          event_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_staff_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_staff_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          capacity: number;
          category: string;
          cover_url: string | null;
          created_at: string;
          description: string;
          ends_at: string;
          id: string;
          organizer_id: string;
          published_at: string | null;
          registration_deadline: string;
          starts_at: string;
          status: Database["public"]["Enums"]["event_status"];
          title: string;
          updated_at: string;
          venue: string;
        };
        Insert: {
          capacity: number;
          category?: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          ends_at: string;
          id?: string;
          organizer_id: string;
          published_at?: string | null;
          registration_deadline: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          title: string;
          updated_at?: string;
          venue?: string;
        };
        Update: {
          capacity?: number;
          category?: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string;
          id?: string;
          organizer_id?: string;
          published_at?: string | null;
          registration_deadline?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          title?: string;
          updated_at?: string;
          venue?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          event_id: string;
          id: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          rating: number;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          rating?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string;
          id: string;
          student_number: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string;
          id: string;
          student_number?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          student_number?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          event_id: string;
          id: string;
          status: Database["public"]["Enums"]["registration_status"];
          user_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          status?: Database["public"]["Enums"]["registration_status"];
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          status?: Database["public"]["Enums"]["registration_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          created_at: string;
          registration_id: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          registration_id: string;
          token?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          registration_id?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_volunteer: {
        Args: {
          _can_scan: boolean;
          _can_view_attendance: boolean;
          _can_view_registrations: boolean;
          _event_id: string;
          _user_id: string;
        };
        Returns: string;
      };
      can_manage_event: { Args: { _event_id: string }; Returns: boolean };
      can_view_profile: { Args: { _profile_id: string }; Returns: boolean };
      cancel_registration: {
        Args: { _registration_id: string };
        Returns: undefined;
      };
      check_in_ticket: {
        Args: { _event_id: string; _token: string };
        Returns: Json;
      };
      cover_event_id: { Args: { _name: string }; Returns: string };
      event_stats: { Args: { _event_id: string }; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      issue_certificates: { Args: { _event_id: string }; Returns: number };
      log_audit: {
        Args: {
          _action: string;
          _entity: string;
          _entity_id: string;
          _meta?: Json;
        };
        Returns: undefined;
      };
      register_for_event: { Args: { _event_id: string }; Returns: string };
      remove_volunteer: {
        Args: { _event_id: string; _user_id: string };
        Returns: undefined;
      };
      set_user_role: {
        Args: {
          _grant: boolean;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: undefined;
      };
      staff_perm: {
        Args: { _event_id: string; _perm: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "organizer" | "student";
      event_status: "draft" | "published" | "cancelled" | "completed";
      registration_status: "registered" | "cancelled";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "organizer", "student"],
      event_status: ["draft", "published", "cancelled", "completed"],
      registration_status: ["registered", "cancelled"],
    },
  },
} as const;
