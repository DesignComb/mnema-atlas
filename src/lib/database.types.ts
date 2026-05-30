/**
 * Hand-authored to match supabase/migrations/0001_init.sql.
 * Regenerate from the live DB any time with:  npm run db:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export interface ProfileRow {
  id: string
  display_name: string | null
  created_at: string
}

export interface DeckRow extends Timestamps {
  id: string
  user_id: string
  parent_deck_id: string | null
  name: string
  description: string | null
}

export interface NoteRow extends Timestamps {
  id: string
  user_id: string
  deck_id: string | null
  title: string
  body: string
  search_tsv: unknown
}

export interface CardRow extends Timestamps {
  id: string
  user_id: string
  note_id: string | null
  deck_id: string | null
  front: string
  back: string
  state: number
  due: string
  stability: number | null
  difficulty: number | null
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: string | null
  created_via: 'ui' | 'rest' | 'mcp'
}

export interface NoteLinkRow {
  id: string
  user_id: string
  source_note_id: string
  target_note_id: string
  link_type: 'reference' | 'related' | 'parent' | 'child' | 'elaborates'
  weight: number
  created_at: string
}

export interface TagRow {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
}

export interface NoteTagRow {
  note_id: string
  tag_id: string
  user_id: string
}

export interface ReviewLogRow {
  id: string
  user_id: string
  card_id: string
  rating: number
  state: number
  due: string | null
  stability: number | null
  difficulty: number | null
  elapsed_days: number | null
  last_elapsed_days: number | null
  scheduled_days: number | null
  learning_steps: number | null
  review: string
  created_at: string
}

export interface ApiKeyRow {
  id: string
  user_id: string
  name: string
  key_hash: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>
      decks: Table<DeckRow>
      notes: Table<NoteRow>
      cards: Table<CardRow>
      note_links: Table<NoteLinkRow>
      tags: Table<TagRow>
      note_tags: Table<NoteTagRow>
      review_logs: Table<ReviewLogRow>
      api_keys: Table<ApiKeyRow>
    }
    Views: Record<string, never>
    Functions: {
      create_deck: {
        Args: { p_user_id: string | null; p_name: string; p_parent_deck_id?: string | null; p_description?: string | null }
        Returns: DeckRow
      }
      create_note: {
        Args: { p_user_id: string | null; p_title: string; p_body?: string; p_deck_id?: string | null; p_created_via?: string }
        Returns: NoteRow
      }
      update_note: {
        Args: { p_user_id: string | null; p_note_id: string; p_title?: string | null; p_body?: string | null; p_deck_id?: string | null }
        Returns: NoteRow
      }
      create_card: {
        Args: { p_user_id: string | null; p_front: string; p_back: string; p_note_id?: string | null; p_deck_id?: string | null; p_created_via?: string }
        Returns: CardRow
      }
      create_flashcards_bulk: {
        Args: { p_user_id: string | null; p_cards: Json; p_deck_id?: string | null; p_created_via?: string }
        Returns: CardRow[]
      }
      link_notes: {
        Args: { p_user_id: string | null; p_source_note_id: string; p_target_note_id: string; p_link_type?: string; p_weight?: number }
        Returns: NoteLinkRow
      }
      record_review: {
        Args: { p_user_id: string | null; p_card_id: string; p_card: Json; p_log: Json }
        Returns: CardRow
      }
      search_notes: {
        Args: { p_user_id: string | null; p_query: string; p_limit?: number }
        Returns: NoteRow[]
      }
      get_graph: {
        Args: { p_user_id: string | null }
        Returns: Json
      }
      create_api_key: {
        Args: { p_user_id: string | null; p_name: string; p_scopes?: string[] }
        Returns: { id: string; api_key: string; key_prefix: string }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
