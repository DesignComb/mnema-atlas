import { supabase } from './supabase'
import type { ApiKeyRow, CardRow, DeckRow, NoteRow, NoteLinkRow } from './database.types'
import type {
  CreateDeckInput,
  CreateFlashcardInput,
  CreateNoteInput,
  LinkNotesInput,
  UpdateNoteInput,
} from '@shared/schemas'

/**
 * Thin typed wrappers over the shared SECURITY DEFINER RPCs and RLS-protected
 * reads. The UI never inserts into tables directly — every write goes through
 * an RPC here, the exact same path the MCP/REST server uses.
 *
 * p_user_id is omitted (null) on purpose: for an authenticated browser caller
 * the RPC defaults the owner to auth.uid(). Passing it would be redundant.
 */

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ── Reads (RLS-scoped) ────────────────────────────────────────────
export async function listDecks(): Promise<DeckRow[]> {
  return unwrap(await supabase.from('decks').select('*').order('name', { ascending: true }))
}

export async function listNotes(deckId?: string): Promise<NoteRow[]> {
  let q = supabase.from('notes').select('*').order('updated_at', { ascending: false })
  if (deckId) q = q.eq('deck_id', deckId)
  return unwrap(await q)
}

export async function getNote(noteId: string): Promise<NoteRow | null> {
  const res = await supabase.from('notes').select('*').eq('id', noteId).maybeSingle()
  return unwrap(res)
}

export async function listCards(deckId?: string): Promise<CardRow[]> {
  let q = supabase.from('cards').select('*').order('due', { ascending: true })
  if (deckId) q = q.eq('deck_id', deckId)
  return unwrap(await q)
}

/** Cards due now (the review queue), oldest-due first. */
export async function listDueCards(deckId?: string, limit = 60): Promise<CardRow[]> {
  let q = supabase
    .from('cards')
    .select('*')
    .lte('due', new Date().toISOString())
    .order('due', { ascending: true })
    .limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  return unwrap(await q)
}

export async function listLinks(): Promise<NoteLinkRow[]> {
  return unwrap(await supabase.from('note_links').select('*'))
}

/** Flashcards generated from / linked to a given note (provenance backlink). */
export async function listCardsByNote(noteId: string): Promise<CardRow[]> {
  return unwrap(
    await supabase.from('cards').select('*').eq('note_id', noteId).order('created_at', { ascending: true }),
  )
}

export interface GraphData {
  nodes: { id: string; title: string; deck_id: string | null }[]
  edges: { source: string; target: string; type: string; weight: number }[]
}

export async function getGraph(): Promise<GraphData> {
  const data = unwrap(await supabase.rpc('get_graph', { p_user_id: null }))
  return data as unknown as GraphData
}

export async function searchNotes(query: string, limit = 20): Promise<NoteRow[]> {
  return unwrap(await supabase.rpc('search_notes', { p_user_id: null, p_query: query, p_limit: limit }))
}

// ── Writes (shared RPCs) ──────────────────────────────────────────
export async function createDeck(input: CreateDeckInput): Promise<DeckRow> {
  return unwrap(
    await supabase.rpc('create_deck', {
      p_user_id: null,
      p_name: input.name,
      p_parent_deck_id: input.parent_deck_id ?? null,
      p_description: input.description ?? null,
    }),
  )
}

export async function createNote(input: CreateNoteInput): Promise<NoteRow> {
  return unwrap(
    await supabase.rpc('create_note', {
      p_user_id: null,
      p_title: input.title,
      p_body: input.body ?? '',
      p_deck_id: input.deck_id ?? null,
      p_created_via: 'ui',
    }),
  )
}

export async function updateNote(input: UpdateNoteInput): Promise<NoteRow> {
  return unwrap(
    await supabase.rpc('update_note', {
      p_user_id: null,
      p_note_id: input.note_id,
      p_title: input.title ?? null,
      p_body: input.body ?? null,
      p_deck_id: input.deck_id ?? null,
    }),
  )
}

export async function createCard(input: CreateFlashcardInput): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('create_card', {
      p_user_id: null,
      p_front: input.front,
      p_back: input.back,
      p_note_id: input.note_id ?? null,
      p_deck_id: input.deck_id ?? null,
      p_created_via: 'ui',
    }),
  )
}

/** Bulk-create flashcards in one round-trip (used by the AI paste-import). */
export interface BulkCardInput {
  front: string
  back: string
  note_id?: string | null
  deck_id?: string | null
}
export async function createFlashcardsBulk(
  cards: BulkCardInput[],
  deckId?: string | null,
): Promise<CardRow[]> {
  return unwrap(
    await supabase.rpc('create_flashcards_bulk', {
      p_user_id: null,
      p_cards: cards,
      p_deck_id: deckId ?? null,
      p_created_via: 'ui',
    }),
  )
}

export async function linkNotes(input: LinkNotesInput): Promise<NoteLinkRow> {
  return unwrap(
    await supabase.rpc('link_notes', {
      p_user_id: null,
      p_source_note_id: input.source_note_id,
      p_target_note_id: input.target_note_id,
      p_link_type: input.link_type,
      p_weight: input.weight,
    }),
  )
}

export async function recordReview(
  cardId: string,
  card: unknown,
  log: unknown,
): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('record_review', {
      p_user_id: null,
      p_card_id: cardId,
      p_card: card as never,
      p_log: log as never,
    }),
  )
}

export async function updateCard(
  cardId: string,
  patch: { front?: string; back?: string; deck_id?: string | null; note_id?: string | null },
): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('update_card', {
      p_user_id: null,
      p_card_id: cardId,
      p_front: patch.front ?? null,
      p_back: patch.back ?? null,
      p_deck_id: patch.deck_id ?? null,
      p_note_id: patch.note_id ?? null,
    }),
  )
}

export async function deleteCard(cardId: string): Promise<void> {
  const res = await supabase.rpc('delete_card', { p_user_id: null, p_card_id: cardId })
  if (res.error) throw new Error(res.error.message)
}
export async function deleteNote(noteId: string): Promise<void> {
  const res = await supabase.rpc('delete_note', { p_user_id: null, p_note_id: noteId })
  if (res.error) throw new Error(res.error.message)
}
export async function deleteDeck(deckId: string): Promise<void> {
  const res = await supabase.rpc('delete_deck', { p_user_id: null, p_deck_id: deckId })
  if (res.error) throw new Error(res.error.message)
}

export interface CreatedApiKey {
  id: string
  api_key: string
  key_prefix: string
}

export async function createApiKey(name: string, scopes: string[] = ['create']): Promise<CreatedApiKey> {
  const rows = unwrap(
    await supabase.rpc('create_api_key', { p_user_id: null, p_name: name, p_scopes: scopes }),
  )
  return rows[0]
}

export type ApiKeySummary = Pick<
  ApiKeyRow,
  'id' | 'name' | 'key_prefix' | 'scopes' | 'last_used_at' | 'created_at' | 'revoked_at'
>

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  return unwrap(
    await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, created_at, revoked_at')
      .order('created_at', { ascending: false }),
  )
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (res.error) throw new Error(res.error.message)
}
