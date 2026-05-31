/**
 * Auto-generated from the live Supabase schema (Management API types endpoint),
 * shaped for @supabase/postgrest-js. Regenerate after a migration by re-fetching
 * GET /v1/projects/{ref}/types/typescript with the Supabase PAT (or npm run db:types).
 * p_user_id is widened to string|null for the null-sentinel RPC convention;
 * row aliases are appended below.
 */

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
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          back: string
          created_at: string
          created_via: string
          deck_id: string | null
          difficulty: number | null
          due: string
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number
          note_id: string | null
          reps: number
          scheduled_days: number
          stability: number | null
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          created_via?: string
          deck_id?: string | null
          difficulty?: number | null
          due?: string
          elapsed_days?: number
          front: string
          id?: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          note_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number | null
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          created_via?: string
          deck_id?: string | null
          difficulty?: number | null
          due?: string
          elapsed_days?: number
          front?: string
          id?: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          note_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number | null
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_deck_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_deck_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_deck_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_parent_deck_id_fkey"
            columns: ["parent_deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      note_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          source_note_id: string
          target_note_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: string
          source_note_id: string
          target_note_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          source_note_id?: string
          target_note_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_links_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deck_id?: string | null
          id?: string
          search_tsv?: unknown
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deck_id?: string | null
          id?: string
          search_tsv?: unknown
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          card_id: string
          created_at: string
          difficulty: number | null
          due: string | null
          elapsed_days: number | null
          id: string
          last_elapsed_days: number | null
          learning_steps: number | null
          rating: number
          review: string
          scheduled_days: number | null
          stability: number | null
          state: number
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          difficulty?: number | null
          due?: string | null
          elapsed_days?: number | null
          id?: string
          last_elapsed_days?: number | null
          learning_steps?: number | null
          rating: number
          review?: string
          scheduled_days?: number | null
          stability?: number | null
          state: number
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          difficulty?: number | null
          due?: string | null
          elapsed_days?: number | null
          id?: string
          last_elapsed_days?: number | null
          learning_steps?: number | null
          rating?: number
          review?: string
          scheduled_days?: number | null
          stability?: number | null
          state?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_api_key: {
        Args: { p_name: string; p_scopes?: string[]; p_user_id: string | null }
        Returns: {
          api_key: string
          id: string
          key_prefix: string
        }[]
      }
      create_card: {
        Args: {
          p_back: string
          p_created_via?: string
          p_deck_id?: string
          p_front: string
          p_note_id?: string
          p_user_id: string | null
        }
        Returns: {
          back: string
          created_at: string
          created_via: string
          deck_id: string | null
          difficulty: number | null
          due: string
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number
          note_id: string | null
          reps: number
          scheduled_days: number
          stability: number | null
          state: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_deck: {
        Args: {
          p_description?: string
          p_name: string
          p_parent_deck_id?: string
          p_user_id: string | null
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_deck_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "decks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_flashcards_bulk: {
        Args: {
          p_cards: Json
          p_created_via?: string
          p_deck_id?: string
          p_user_id: string | null
        }
        Returns: {
          back: string
          created_at: string
          created_via: string
          deck_id: string | null
          difficulty: number | null
          due: string
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number
          note_id: string | null
          reps: number
          scheduled_days: number
          stability: number | null
          state: number
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_note: {
        Args: {
          p_body?: string
          p_created_via?: string
          p_deck_id?: string
          p_title: string
          p_user_id: string | null
        }
        Returns: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_card: {
        Args: { p_card_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_deck: {
        Args: { p_deck_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_note: {
        Args: { p_note_id: string; p_user_id: string | null }
        Returns: boolean
      }
      get_graph: { Args: { p_user_id: string | null }; Returns: Json }
      link_notes: {
        Args: {
          p_link_type?: string
          p_source_note_id: string
          p_target_note_id: string
          p_user_id: string | null
          p_weight?: number
        }
        Returns: {
          created_at: string
          id: string
          link_type: string
          source_note_id: string
          target_note_id: string
          user_id: string
          weight: number
        }
        SetofOptions: {
          from: "*"
          to: "note_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_review: {
        Args: {
          p_card: Json
          p_card_id: string
          p_log: Json
          p_user_id: string | null
        }
        Returns: {
          back: string
          created_at: string
          created_via: string
          deck_id: string | null
          difficulty: number | null
          due: string
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number
          note_id: string | null
          reps: number
          scheduled_days: number
          stability: number | null
          state: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_notes: {
        Args: { p_limit?: number; p_query: string; p_user_id: string | null }
        Returns: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_note_deck: {
        Args: { p_deck_id?: string; p_note_id: string; p_user_id: string | null }
        Returns: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_note_tags: {
        Args: { p_note_id: string; p_tags: string[]; p_user_id: string | null }
        Returns: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlink_notes: {
        Args: { p_a: string; p_b: string; p_user_id: string | null }
        Returns: number
      }
      update_card: {
        Args: {
          p_back?: string
          p_card_id: string
          p_deck_id?: string
          p_front?: string
          p_note_id?: string
          p_user_id: string | null
        }
        Returns: {
          back: string
          created_at: string
          created_via: string
          deck_id: string | null
          difficulty: number | null
          due: string
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number
          note_id: string | null
          reps: number
          scheduled_days: number
          stability: number | null
          state: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_deck: {
        Args: {
          p_deck_id: string
          p_description?: string
          p_name?: string
          p_user_id: string | null
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_deck_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "decks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_note: {
        Args: {
          p_body?: string
          p_deck_id?: string
          p_note_id: string
          p_title?: string
          p_user_id: string | null
        }
        Returns: {
          body: string
          created_at: string
          deck_id: string | null
          id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          scopes: string[]
          user_id: string
        }[]
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

// ── Convenience row aliases (stable names used across the app) ──────────────
type PublicTables = Database['public']['Tables']
export type DeckRow = PublicTables['decks']['Row']
export type NoteRow = PublicTables['notes']['Row']
export type CardRow = PublicTables['cards']['Row']
export type NoteLinkRow = PublicTables['note_links']['Row']
export type ApiKeyRow = PublicTables['api_keys']['Row']

