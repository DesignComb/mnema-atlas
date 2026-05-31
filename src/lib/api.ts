import { supabase } from './supabase'
import type { ApiKeyRow, CardRow, DeckRow, Json, NoteRow, NoteLinkRow } from './database.types'
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

/** Not-yet-due cards (soonest first) — the "study ahead / cram" queue. */
export async function listAheadCards(deckId?: string, limit = 30): Promise<CardRow[]> {
  let q = supabase
    .from('cards')
    .select('*')
    .gt('due', new Date().toISOString())
    .order('due', { ascending: true })
    .limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  return unwrap(await q)
}

/** Flashcards generated from / linked to a given note (provenance backlink). */
export async function listCardsByNote(noteId: string): Promise<CardRow[]> {
  return unwrap(
    await supabase.from('cards').select('*').eq('note_id', noteId).order('created_at', { ascending: true }),
  )
}

export interface GraphData {
  nodes: { id: string; title: string; deck_id: string | null; tags: string[] }[]
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
      p_parent_deck_id: input.parent_deck_id ?? undefined,
      p_description: input.description ?? undefined,
    }),
  )
}

export async function createNote(input: CreateNoteInput): Promise<NoteRow> {
  return unwrap(
    await supabase.rpc('create_note', {
      p_user_id: null,
      p_title: input.title,
      p_body: input.body ?? '',
      p_deck_id: input.deck_id ?? undefined,
      p_created_via: 'ui',
    }),
  )
}

export async function updateNote(input: UpdateNoteInput): Promise<NoteRow> {
  return unwrap(
    await supabase.rpc('update_note', {
      p_user_id: null,
      p_note_id: input.note_id,
      p_title: input.title ?? undefined,
      p_body: input.body ?? undefined,
      p_deck_id: input.deck_id ?? undefined,
    }),
  )
}

/** Rename / re-describe a deck (null = leave unchanged). */
export async function updateDeck(
  deckId: string,
  patch: { name?: string; description?: string | null },
): Promise<DeckRow> {
  return unwrap(
    await supabase.rpc('update_deck', {
      p_user_id: null,
      p_deck_id: deckId,
      p_name: patch.name ?? undefined,
      p_description: patch.description ?? undefined,
    }),
  )
}

/** Move a note to another deck — or out of all decks (deckId = null). */
export async function setNoteDeck(noteId: string, deckId: string | null): Promise<NoteRow> {
  return unwrap(
    await supabase.rpc('set_note_deck', { p_user_id: null, p_note_id: noteId, p_deck_id: deckId ?? undefined }),
  )
}

/** Replace the whole tag set on a note (drives graph colour / clustering). */
export async function setNoteTags(noteId: string, tags: string[]): Promise<NoteRow> {
  return unwrap(await supabase.rpc('set_note_tags', { p_user_id: null, p_note_id: noteId, p_tags: tags }))
}

export async function createCard(input: CreateFlashcardInput): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('create_card', {
      p_user_id: null,
      p_front: input.front,
      p_back: input.back,
      p_note_id: input.note_id ?? undefined,
      p_deck_id: input.deck_id ?? undefined,
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
      p_cards: cards as unknown as Json,
      p_deck_id: deckId ?? undefined,
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

/** Remove the association(s) between two notes (either direction). */
export async function unlinkNotes(a: string, b: string): Promise<number> {
  return unwrap(await supabase.rpc('unlink_notes', { p_user_id: null, p_a: a, p_b: b }))
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
      p_card: card as Json,
      p_log: log as Json,
    }),
  )
}

/**
 * record_review with retry — the review queue advances optimistically, so a
 * transient network blip must not silently lose a grade. Retries a few times
 * with backoff; throws only if every attempt fails (caller surfaces that).
 */
export async function recordReviewSafe(
  cardId: string,
  card: unknown,
  log: unknown,
  retries = 3,
): Promise<CardRow> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await recordReview(cardId, card, log)
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to save review')
}

export async function updateCard(
  cardId: string,
  patch: { front?: string; back?: string; deck_id?: string | null; note_id?: string | null },
): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('update_card', {
      p_user_id: null,
      p_card_id: cardId,
      p_front: patch.front ?? undefined,
      p_back: patch.back ?? undefined,
      p_deck_id: patch.deck_id ?? undefined,
      p_note_id: patch.note_id ?? undefined,
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
