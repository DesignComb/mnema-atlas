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
          tags: string[]
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
          tags?: string[]
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
          tags?: string[]
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
      itineraries: {
        Row: {
          cover_url: string | null
          created_at: string
          created_via: string
          default_currency: string
          destination: string | null
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          start_date: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_via?: string
          default_currency?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          start_date?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_via?: string
          default_currency?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          start_date?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      itinerary_days: {
        Row: {
          created_at: string
          created_via: string
          day_date: string | null
          id: string
          itinerary_id: string
          label: string | null
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_via?: string
          day_date?: string | null
          id?: string
          itinerary_id: string
          label?: string | null
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_via?: string
          day_date?: string | null
          id?: string
          itinerary_id?: string
          label?: string | null
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        Insert: {
          booking_ref?: string | null
          booking_url?: string | null
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string | null
          day_id?: string | null
          end_day_offset?: number
          end_time?: string | null
          id?: string
          itinerary_id: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_id: string
          place?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
          transport_detail?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Update: {
          booking_ref?: string | null
          booking_url?: string | null
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string | null
          day_id?: string | null
          end_day_offset?: number
          end_time?: string | null
          id?: string
          itinerary_id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_id?: string
          place?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
          transport_detail?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_members: {
        Row: {
          added_by: string | null
          created_at: string
          itinerary_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          itinerary_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          itinerary_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_members_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
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
      share_links: {
        Row: {
          can_edit: boolean
          created_at: string
          expires_at: string | null
          hide_costs: boolean
          id: string
          itinerary_id: string
          owner_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          expires_at?: string | null
          hide_costs?: boolean
          id?: string
          itinerary_id: string
          owner_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          expires_at?: string | null
          hide_costs?: boolean
          id?: string
          itinerary_id?: string
          owner_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_member: {
        Args: {
          p_email: string
          p_itinerary_id: string
          p_role: string
          p_user_id: string | null
        }
        Returns: {
          added_by: string | null
          created_at: string
          itinerary_id: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          tags: string[]
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
      create_day: {
        Args: {
          p_created_via?: string
          p_day_date?: string
          p_itinerary_id: string
          p_label?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          created_at: string
          created_via: string
          day_date: string | null
          id: string
          itinerary_id: string
          label: string | null
          owner_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_days"
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
          tags: string[]
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
      create_item: {
        Args: {
          p_booking_ref?: string
          p_booking_url?: string
          p_category?: string
          p_cost?: number
          p_created_via?: string
          p_currency?: string
          p_day_id?: string
          p_end_day_offset?: number
          p_end_time?: string
          p_itinerary_id?: string
          p_lat?: number
          p_lng?: number
          p_notes?: string
          p_place?: string
          p_sort_order?: number
          p_start_time?: string
          p_title: string
          p_transport_detail?: string
          p_transport_mode?: string
          p_user_id: string | null
        }
        Returns: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_items_bulk: {
        Args: { p_day_id: string; p_items: Json; p_user_id: string | null }
        Returns: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "itinerary_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_itinerary: {
        Args: {
          p_cover_url?: string
          p_created_via?: string
          p_default_currency?: string
          p_destination?: string
          p_end_date?: string
          p_notes?: string
          p_start_date?: string
          p_timezone?: string
          p_title: string
          p_user_id: string | null
        }
        Returns: {
          cover_url: string | null
          created_at: string
          created_via: string
          default_currency: string
          destination: string | null
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          start_date: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itineraries"
          isOneToOne: true
          isSetofReturn: false
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
      create_share_link: {
        Args: {
          p_expires_at?: string
          p_hide_costs?: boolean
          p_itinerary_id: string
          p_user_id: string | null
        }
        Returns: {
          can_edit: boolean
          created_at: string
          expires_at: string | null
          hide_costs: boolean
          id: string
          itinerary_id: string
          owner_id: string
          revoked_at: string | null
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "share_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_trip_bulk: {
        Args: { p_created_via?: string; p_trip: Json; p_user_id: string | null }
        Returns: Json
      }
      delete_card: {
        Args: { p_card_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_day: {
        Args: { p_day_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_deck: {
        Args: { p_deck_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_item: {
        Args: { p_item_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_itinerary: {
        Args: { p_itinerary_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_note: {
        Args: { p_note_id: string; p_user_id: string | null }
        Returns: boolean
      }
      get_graph: { Args: { p_user_id: string | null }; Returns: Json }
      get_itinerary: {
        Args: { p_id: string; p_user_id: string | null }
        Returns: Json
      }
      get_shared_itinerary: { Args: { p_token: string }; Returns: Json }
      itinerary_item_json: {
        Args: { i: Database["public"]["Tables"]["itinerary_items"]["Row"] }
        Returns: Json
      }
      itinerary_item_public_json: {
        Args: {
          i: Database["public"]["Tables"]["itinerary_items"]["Row"]
          p_hide_costs: boolean
        }
        Returns: Json
      }
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
      list_members: {
        Args: { p_itinerary_id: string; p_user_id: string | null }
        Returns: {
          display_name: string
          role: string
          user_id: string
        }[]
      }
      list_share_links: {
        Args: { p_itinerary_id: string; p_user_id: string | null }
        Returns: {
          can_edit: boolean
          created_at: string
          expires_at: string | null
          hide_costs: boolean
          id: string
          itinerary_id: string
          owner_id: string
          revoked_at: string | null
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "share_links"
          isOneToOne: false
          isSetofReturn: true
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
          tags: string[]
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
      remove_member: {
        Args: {
          p_itinerary_id: string
          p_member_user_id: string
          p_user_id: string | null
        }
        Returns: boolean
      }
      reorder_days: {
        Args: { p_day_ids: Json; p_itinerary_id: string; p_user_id: string | null }
        Returns: boolean
      }
      reorder_items: {
        Args: { p_day_id: string; p_item_ids: Json; p_user_id: string | null }
        Returns: boolean
      }
      revoke_api_key: {
        Args: { p_id: string; p_user_id: string | null }
        Returns: boolean
      }
      revoke_share_link: {
        Args: { p_id: string; p_user_id: string | null }
        Returns: boolean
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
      set_card_tags: {
        Args: { p_card_id: string; p_tags: string[]; p_user_id: string | null }
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
          tags: string[]
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
      set_item_day: {
        Args: { p_day_id: string; p_item_id: string; p_user_id: string | null }
        Returns: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_item_location: {
        Args: {
          p_item_id: string
          p_lat: number
          p_lng: number
          p_user_id: string | null
        }
        Returns: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_items"
          isOneToOne: true
          isSetofReturn: false
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
          tags: string[]
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
      update_day: {
        Args: {
          p_day_date?: string
          p_day_id: string
          p_label?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          created_at: string
          created_via: string
          day_date: string | null
          id: string
          itinerary_id: string
          label: string | null
          owner_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_days"
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
      update_item: {
        Args: {
          p_booking_ref?: string
          p_booking_url?: string
          p_category?: string
          p_cost?: number
          p_currency?: string
          p_end_day_offset?: number
          p_end_time?: string
          p_expected_updated_at?: string
          p_item_id: string
          p_lat?: number
          p_lng?: number
          p_notes?: string
          p_place?: string
          p_sort_order?: number
          p_start_time?: string
          p_title?: string
          p_transport_detail?: string
          p_transport_mode?: string
          p_user_id: string | null
        }
        Returns: {
          booking_ref: string | null
          booking_url: string | null
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          day_id: string | null
          end_day_offset: number
          end_time: string | null
          id: string
          itinerary_id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          place: string | null
          sort_order: number
          start_time: string | null
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_itinerary: {
        Args: {
          p_cover_url?: string
          p_default_currency?: string
          p_destination?: string
          p_end_date?: string
          p_itinerary_id: string
          p_notes?: string
          p_start_date?: string
          p_timezone?: string
          p_title?: string
          p_user_id: string | null
        }
        Returns: {
          cover_url: string | null
          created_at: string
          created_via: string
          default_currency: string
          destination: string | null
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          start_date: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itineraries"
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
export type ItineraryRow = PublicTables['itineraries']['Row']
export type ItineraryDayRow = PublicTables['itinerary_days']['Row']
export type ItineraryItemRow = PublicTables['itinerary_items']['Row']
export type ShareLinkRow = PublicTables['share_links']['Row']
export type ItineraryMemberRow = PublicTables['itinerary_members']['Row']
