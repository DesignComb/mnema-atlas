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
      accounts: {
        Row: {
          color: string | null
          created_at: string
          created_via: string
          currency: string
          icon: string | null
          id: string
          is_archived: boolean
          ledger_id: string
          name: string
          opening_balance: number
          owner_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_via?: string
          currency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          ledger_id: string
          name: string
          opening_balance?: number
          owner_id: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_via?: string
          currency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          ledger_id?: string
          name?: string
          opening_balance?: number
          owner_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      categories: {
        Row: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          kind: string
          ledger_id: string
          name: string
          owner_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          kind: string
          ledger_id: string
          name: string
          owner_id: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          kind?: string
          ledger_id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          budget_total: number | null
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
          travelers: string[]
          updated_at: string
        }
        Insert: {
          budget_total?: number | null
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
          travelers?: string[]
          updated_at?: string
        }
        Update: {
          budget_total?: number | null
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
          travelers?: string[]
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
          assignees: string[]
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
          status: string
          title: string
          transport_detail: string | null
          transport_mode: string | null
          updated_at: string
        }
        Insert: {
          assignees?: string[]
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
          status?: string
          title: string
          transport_detail?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Update: {
          assignees?: string[]
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
          status?: string
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
      ledger_members: {
        Row: {
          added_by: string | null
          created_at: string
          display_name: string
          id: string
          ledger_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          display_name: string
          id?: string
          ledger_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          display_name?: string
          id?: string
          ledger_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_members_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          base_currency: string
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_currency?: string
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      task_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          id: string
          note: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          id?: string
          note?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          id?: string
          note?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checkins_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_via?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_reminders: {
        Row: {
          created_at: string
          created_via: string
          id: string
          method: string
          offset_min: number | null
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_via?: string
          id?: string
          method?: string
          offset_min?: number | null
          remind_at: string
          sent_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_via?: string
          id?: string
          method?: string
          offset_min?: number | null
          remind_at?: string
          sent_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_via?: string
          current_streak?: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_min?: number | null
          id?: string
          kind?: string
          labels?: string[]
          list_id?: string | null
          longest_streak?: number
          next_occurrence?: string | null
          parent_task_id?: string | null
          priority?: number
          recurrence_after_completion?: boolean
          recurrence_anchor?: string | null
          recurrence_rule?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sort_order?: number
          status?: string
          title: string
          tz?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_via?: string
          current_streak?: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_min?: number | null
          id?: string
          kind?: string
          labels?: string[]
          list_id?: string | null
          longest_streak?: number
          next_occurrence?: string | null
          parent_task_id?: string | null
          priority?: number
          recurrence_after_completion?: boolean
          recurrence_anchor?: string | null
          recurrence_rule?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sort_order?: number
          status?: string
          title?: string
          tz?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string
          fx_rate?: number
          id?: string
          ledger_id: string
          note?: string | null
          owner_id: string
          payee?: string | null
          receipt_url?: string | null
          tags?: string[]
          transfer_account_id?: string | null
          txn_date?: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string
          fx_rate?: number
          id?: string
          ledger_id?: string
          note?: string | null
          owner_id?: string
          payee?: string | null
          receipt_url?: string | null
          tags?: string[]
          transfer_account_id?: string | null
          txn_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_account_id_fkey"
            columns: ["transfer_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_bookings: {
        Row: {
          confirmation: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          end_at: string | null
          from_label: string | null
          id: string
          itinerary_id: string
          location: string | null
          notes: string | null
          owner_id: string
          sort_order: number
          start_at: string | null
          title: string
          to_label: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          confirmation?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string | null
          end_at?: string | null
          from_label?: string | null
          id?: string
          itinerary_id: string
          location?: string | null
          notes?: string | null
          owner_id: string
          sort_order?: number
          start_at?: string | null
          title: string
          to_label?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          confirmation?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          currency?: string | null
          end_at?: string | null
          from_label?: string | null
          id?: string
          itinerary_id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          sort_order?: number
          start_at?: string | null
          title?: string
          to_label?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_bookings_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_checklist: {
        Row: {
          assignee: string | null
          category: string | null
          created_at: string
          created_by: string | null
          created_via: string
          done: boolean
          id: string
          itinerary_id: string
          kind: string
          owner_id: string
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          done?: boolean
          id?: string
          itinerary_id: string
          kind?: string
          owner_id: string
          sort_order?: number
          text: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          done?: boolean
          id?: string
          itinerary_id?: string
          kind?: string
          owner_id?: string
          sort_order?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_checklist_itinerary_id_fkey"
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
      add_reminder: {
        Args: {
          p_created_via?: string
          p_offset_min?: number
          p_remind_at: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          created_at: string
          created_via: string
          id: string
          method: string
          offset_min: number | null
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "task_reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_in: {
        Args: {
          p_checkin_date?: string
          p_note?: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_task: {
        Args: {
          p_completed_at?: string
          p_next_occurrence?: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_account: {
        Args: {
          p_color?: string
          p_created_via?: string
          p_currency?: string
          p_icon?: string
          p_ledger_id: string
          p_name: string
          p_opening_balance?: number
          p_sort_order?: number
          p_type?: string
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          currency: string
          icon: string | null
          id: string
          is_archived: boolean
          ledger_id: string
          name: string
          opening_balance: number
          owner_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "accounts"
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
      create_booking: {
        Args: {
          p_confirmation?: string
          p_cost?: number
          p_created_via?: string
          p_currency?: string
          p_end_at?: string
          p_from_label?: string
          p_itinerary_id: string
          p_location?: string
          p_notes?: string
          p_sort_order?: number
          p_start_at?: string
          p_title: string
          p_to_label?: string
          p_type: string
          p_url?: string
          p_user_id: string | null
        }
        Returns: {
          confirmation: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          end_at: string | null
          from_label: string | null
          id: string
          itinerary_id: string
          location: string | null
          notes: string | null
          owner_id: string
          sort_order: number
          start_at: string | null
          title: string
          to_label: string | null
          type: string
          updated_at: string
          url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trip_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_bookings_bulk: {
        Args: { p_bookings: Json; p_itinerary_id: string; p_user_id: string | null }
        Returns: {
          confirmation: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          end_at: string | null
          from_label: string | null
          id: string
          itinerary_id: string
          location: string | null
          notes: string | null
          owner_id: string
          sort_order: number
          start_at: string | null
          title: string
          to_label: string | null
          type: string
          updated_at: string
          url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "trip_bookings"
          isOneToOne: false
          isSetofReturn: true
        }
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
      create_category: {
        Args: {
          p_color?: string
          p_created_via?: string
          p_icon?: string
          p_kind: string
          p_ledger_id: string
          p_name: string
          p_parent_id?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          kind: string
          ledger_id: string
          name: string
          owner_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_checklist_bulk: {
        Args: { p_items: Json; p_itinerary_id: string; p_user_id: string | null }
        Returns: {
          assignee: string | null
          category: string | null
          created_at: string
          created_by: string | null
          created_via: string
          done: boolean
          id: string
          itinerary_id: string
          kind: string
          owner_id: string
          sort_order: number
          text: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trip_checklist"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_checklist_item: {
        Args: {
          p_assignee?: string
          p_category?: string
          p_created_via?: string
          p_itinerary_id: string
          p_kind: string
          p_sort_order?: number
          p_text: string
          p_user_id: string | null
        }
        Returns: {
          assignee: string | null
          category: string | null
          created_at: string
          created_by: string | null
          created_via: string
          done: boolean
          id: string
          itinerary_id: string
          kind: string
          owner_id: string
          sort_order: number
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trip_checklist"
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
          assignees: string[]
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
          status: string
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
          assignees: string[]
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
          status: string
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
          budget_total: number | null
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
          travelers: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itineraries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_ledger: {
        Args: {
          p_base_currency?: string
          p_color?: string
          p_created_via?: string
          p_icon?: string
          p_name: string
          p_user_id: string | null
        }
        Returns: {
          base_currency: string
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ledgers"
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
      create_task: {
        Args: {
          p_created_via?: string
          p_description?: string
          p_due_date?: string
          p_due_time?: string
          p_duration_min?: number
          p_kind?: string
          p_labels?: string[]
          p_list_id?: string
          p_next_occurrence?: string
          p_parent_task_id?: string
          p_priority?: number
          p_recurrence_after_completion?: boolean
          p_recurrence_anchor?: string
          p_recurrence_rule?: string
          p_scheduled_date?: string
          p_scheduled_time?: string
          p_sort_order?: number
          p_title: string
          p_tz?: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_task_list: {
        Args: {
          p_color?: string
          p_created_via?: string
          p_icon?: string
          p_kind?: string
          p_name: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "task_lists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tasks_bulk: {
        Args: { p_tasks: Json; p_user_id: string | null }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_transaction: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_category_id?: string
          p_created_via?: string
          p_currency?: string
          p_fx_rate?: number
          p_ledger_id: string
          p_note?: string
          p_payee?: string
          p_receipt_url?: string
          p_tags?: string[]
          p_transfer_account_id?: string
          p_txn_date?: string
          p_type: string
          p_user_id: string | null
        }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_transactions_bulk: {
        Args: { p_ledger_id: string; p_transactions: Json; p_user_id: string | null }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_trip_bulk: {
        Args: { p_created_via?: string; p_trip: Json; p_user_id: string | null }
        Returns: Json
      }
      delete_account: {
        Args: { p_account_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_booking: {
        Args: { p_booking_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_card: {
        Args: { p_card_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_category: {
        Args: { p_category_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_checklist_item: {
        Args: { p_item_id: string; p_user_id: string | null }
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
      delete_ledger: {
        Args: { p_ledger_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_note: {
        Args: { p_note_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_push_subscription: {
        Args: { p_endpoint: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_task: {
        Args: { p_task_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_task_list: {
        Args: { p_list_id: string; p_user_id: string | null }
        Returns: boolean
      }
      delete_transaction: {
        Args: { p_transaction_id: string; p_user_id: string | null }
        Returns: boolean
      }
      due_reminders_for_cron: { Args: never; Returns: Json }
      get_graph: { Args: { p_user_id: string | null }; Returns: Json }
      get_habit: {
        Args: { p_task_id: string; p_user_id: string | null }
        Returns: Json
      }
      get_itinerary: {
        Args: { p_id: string; p_user_id: string | null }
        Returns: Json
      }
      get_ledger: {
        Args: { p_ledger_id: string; p_user_id: string | null }
        Returns: Json
      }
      get_ledger_summary: {
        Args: {
          p_from: string
          p_ledger_id: string
          p_to: string
          p_user_id: string | null
        }
        Returns: Json
      }
      get_shared_itinerary: { Args: { p_token: string }; Returns: Json }
      get_streak: {
        Args: { p_task_id: string; p_user_id: string | null }
        Returns: Json
      }
      get_task: {
        Args: { p_task_id: string; p_user_id: string | null }
        Returns: Json
      }
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
      list_tasks: {
        Args: {
          p_due_before?: string
          p_include_subtasks?: boolean
          p_kind?: string
          p_label?: string
          p_limit?: number
          p_list_id?: string
          p_scheduled_on?: string
          p_status?: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_transactions: {
        Args: {
          p_account_id?: string
          p_category_id?: string
          p_from?: string
          p_ledger_id: string
          p_limit?: number
          p_to?: string
          p_type?: string
          p_user_id: string | null
        }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_reminder_delivered: {
        Args: { p_reminder_id: string }
        Returns: boolean
      }
      move_task: {
        Args: {
          p_list_id?: string
          p_parent_task_id?: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prune_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
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
      remove_reminder: {
        Args: { p_reminder_id: string; p_user_id: string | null }
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
      reorder_task_lists: {
        Args: { p_list_ids: string[]; p_user_id: string | null }
        Returns: boolean
      }
      reorder_tasks: {
        Args: { p_list_id: string; p_task_ids: string[]; p_user_id: string | null }
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
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
          p_user_id: string | null
        }
        Returns: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_task: {
        Args: {
          p_due_date?: string
          p_due_time?: string
          p_duration_min?: number
          p_scheduled_date?: string
          p_scheduled_time?: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
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
      search_tasks: {
        Args: { p_limit?: number; p_query: string; p_user_id: string | null }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_transactions: {
        Args: {
          p_ledger_id: string
          p_limit?: number
          p_query: string
          p_user_id: string | null
        }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
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
      set_item_assignees: {
        Args: { p_assignees: string[]; p_item_id: string; p_user_id: string | null }
        Returns: {
          assignees: string[]
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
          status: string
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
      set_item_day: {
        Args: { p_day_id: string; p_item_id: string; p_user_id: string | null }
        Returns: {
          assignees: string[]
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
          status: string
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
          assignees: string[]
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
          status: string
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
      set_item_status: {
        Args: { p_item_id: string; p_status: string; p_user_id: string | null }
        Returns: {
          assignees: string[]
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
          status: string
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
      set_recurrence: {
        Args: {
          p_next_occurrence?: string
          p_recurrence_after_completion?: boolean
          p_recurrence_anchor?: string
          p_recurrence_rule: string
          p_task_id: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snooze_task: {
        Args: {
          p_task_id: string
          p_until: string
          p_until_time?: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_recurring_tasks: {
        Args: {
          p_lookback_days?: number
          p_min_count?: number
          p_user_id: string | null
        }
        Returns: Json
      }
      uncheck_in: {
        Args: { p_checkin_date?: string; p_task_id: string; p_user_id: string | null }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      uncomplete_task: {
        Args: { p_task_id: string; p_user_id: string | null }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlink_notes: {
        Args: { p_a: string; p_b: string; p_user_id: string | null }
        Returns: number
      }
      update_account: {
        Args: {
          p_account_id: string
          p_color?: string
          p_currency?: string
          p_icon?: string
          p_is_archived?: boolean
          p_name?: string
          p_opening_balance?: number
          p_sort_order?: number
          p_type?: string
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          currency: string
          icon: string | null
          id: string
          is_archived: boolean
          ledger_id: string
          name: string
          opening_balance: number
          owner_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_booking: {
        Args: {
          p_booking_id: string
          p_confirmation?: string
          p_cost?: number
          p_currency?: string
          p_end_at?: string
          p_from_label?: string
          p_location?: string
          p_notes?: string
          p_sort_order?: number
          p_start_at?: string
          p_title?: string
          p_to_label?: string
          p_type?: string
          p_url?: string
          p_user_id: string | null
        }
        Returns: {
          confirmation: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string | null
          end_at: string | null
          from_label: string | null
          id: string
          itinerary_id: string
          location: string | null
          notes: string | null
          owner_id: string
          sort_order: number
          start_at: string | null
          title: string
          to_label: string | null
          type: string
          updated_at: string
          url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trip_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
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
      update_category: {
        Args: {
          p_category_id: string
          p_color?: string
          p_icon?: string
          p_kind?: string
          p_name?: string
          p_parent_id?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          kind: string
          ledger_id: string
          name: string
          owner_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_checklist_item: {
        Args: {
          p_assignee?: string
          p_category?: string
          p_done?: boolean
          p_item_id: string
          p_kind?: string
          p_sort_order?: number
          p_text?: string
          p_user_id: string | null
        }
        Returns: {
          assignee: string | null
          category: string | null
          created_at: string
          created_by: string | null
          created_via: string
          done: boolean
          id: string
          itinerary_id: string
          kind: string
          owner_id: string
          sort_order: number
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trip_checklist"
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
          assignees: string[]
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
          status: string
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
          p_budget_total?: number
          p_cover_url?: string
          p_default_currency?: string
          p_destination?: string
          p_end_date?: string
          p_itinerary_id: string
          p_notes?: string
          p_start_date?: string
          p_timezone?: string
          p_title?: string
          p_travelers?: string[]
          p_user_id: string | null
        }
        Returns: {
          budget_total: number | null
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
          travelers: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "itineraries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_ledger: {
        Args: {
          p_base_currency?: string
          p_color?: string
          p_icon?: string
          p_is_archived?: boolean
          p_ledger_id: string
          p_name?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          base_currency: string
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ledgers"
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
      update_task: {
        Args: {
          p_description?: string
          p_due_date?: string
          p_due_time?: string
          p_labels?: string[]
          p_list_id?: string
          p_priority?: number
          p_sort_order?: number
          p_status?: string
          p_task_id: string
          p_title?: string
          p_user_id: string | null
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_via: string
          current_streak: number
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_min: number | null
          id: string
          kind: string
          labels: string[]
          list_id: string | null
          longest_streak: number
          next_occurrence: string | null
          parent_task_id: string | null
          priority: number
          recurrence_after_completion: boolean
          recurrence_anchor: string | null
          recurrence_rule: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          tz: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_task_list: {
        Args: {
          p_color?: string
          p_icon?: string
          p_is_archived?: boolean
          p_kind?: string
          p_list_id: string
          p_name?: string
          p_sort_order?: number
          p_user_id: string | null
        }
        Returns: {
          color: string | null
          created_at: string
          created_via: string
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "task_lists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_transaction: {
        Args: {
          p_account_id?: string
          p_amount?: number
          p_category_id?: string
          p_note?: string
          p_payee?: string
          p_receipt_url?: string
          p_tags?: string[]
          p_transaction_id: string
          p_transfer_account_id?: string
          p_txn_date?: string
          p_type?: string
          p_user_id: string | null
        }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          currency: string
          fx_rate: number
          id: string
          ledger_id: string
          note: string | null
          owner_id: string
          payee: string | null
          receipt_url: string | null
          tags: string[]
          transfer_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
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

// -- Convenience row aliases (stable names used across the app) --
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
export type TripBookingRow = PublicTables['trip_bookings']['Row']
export type TripChecklistRow = PublicTables['trip_checklist']['Row']
// Tempo
export type TaskListRow = PublicTables['task_lists']['Row']
export type TaskRow = PublicTables['tasks']['Row']
export type TaskCheckinRow = PublicTables['task_checkins']['Row']
export type TaskReminderRow = PublicTables['task_reminders']['Row']
export type PushSubscriptionRow = PublicTables['push_subscriptions']['Row']
// Galleon (money)
export type LedgerRow = PublicTables['ledgers']['Row']
export type LedgerMemberRow = PublicTables['ledger_members']['Row']
export type AccountRow = PublicTables['accounts']['Row']
export type CategoryRow = PublicTables['categories']['Row']
export type TransactionRow = PublicTables['transactions']['Row']
