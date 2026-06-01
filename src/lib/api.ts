import { supabase } from './supabase'
import type {
  ApiKeyRow,
  CardRow,
  DeckRow,
  ItineraryDayRow,
  ItineraryItemRow,
  ItineraryRow,
  Json,
  NoteRow,
  NoteLinkRow,
  ShareLinkRow,
} from './database.types'
import type {
  CreateDayInput,
  CreateDeckInput,
  CreateFlashcardInput,
  CreateItemInput,
  CreateItemsBulkInput,
  CreateItineraryInput,
  CreateNoteInput,
  CreateTripBulkInput,
  LinkNotesInput,
  UpdateDayInput,
  UpdateItemInput,
  UpdateItineraryInput,
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

export async function listCards(deckId?: string, tag?: string): Promise<CardRow[]> {
  let q = supabase.from('cards').select('*').order('due', { ascending: true })
  if (deckId) q = q.eq('deck_id', deckId)
  if (tag) q = q.contains('tags', [tag])
  return unwrap(await q)
}

/** Cards due now (the review queue), oldest-due first. Optionally filter by tag. */
export async function listDueCards(deckId?: string, tag?: string, limit = 60): Promise<CardRow[]> {
  let q = supabase
    .from('cards')
    .select('*')
    .lte('due', new Date().toISOString())
    .order('due', { ascending: true })
    .limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  if (tag) q = q.contains('tags', [tag])
  return unwrap(await q)
}

export async function listLinks(): Promise<NoteLinkRow[]> {
  return unwrap(await supabase.from('note_links').select('*'))
}

/** Not-yet-due cards (soonest first) — the "study ahead / cram" queue. */
export async function listAheadCards(deckId?: string, tag?: string, limit = 30): Promise<CardRow[]> {
  let q = supabase
    .from('cards')
    .select('*')
    .gt('due', new Date().toISOString())
    .order('due', { ascending: true })
    .limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  if (tag) q = q.contains('tags', [tag])
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

/** Replace the whole tag set on a flashcard (enables study-by-tag). */
export async function setCardTags(cardId: string, tags: string[]): Promise<CardRow> {
  return unwrap(await supabase.rpc('set_card_tags', { p_user_id: null, p_card_id: cardId, p_tags: tags }))
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

// ── Itineraries (travel trips) ────────────────────────────────────
/** The whole-trip tree returned by get_itinerary (one round-trip, like getGraph). */
export interface ItineraryItem {
  id: string
  day_id: string | null
  title: string
  place: string | null
  lat: number | null
  lng: number | null
  category: string
  start_time: string | null
  end_time: string | null
  end_day_offset: number
  transport_mode: string | null
  transport_detail: string | null
  cost: number | null
  currency: string | null
  booking_url: string | null
  booking_ref: string | null
  notes: string | null
  sort_order: number
}
export interface ItineraryDay {
  id: string
  day_date: string | null
  label: string | null
  sort_order: number
  items: ItineraryItem[]
}
export interface ItineraryTree {
  id: string
  owner_id: string
  my_role: 'owner' | 'editor' | 'viewer'
  title: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  timezone: string | null
  default_currency: string
  cover_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  days: ItineraryDay[]
  unscheduled: ItineraryItem[]
  cost_by_currency: Record<string, number>
}

export async function listItineraries(): Promise<ItineraryRow[]> {
  return unwrap(
    await supabase
      .from('itineraries')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  )
}

export async function getItinerary(id: string): Promise<ItineraryTree> {
  return unwrap(await supabase.rpc('get_itinerary', { p_user_id: null, p_id: id })) as unknown as ItineraryTree
}

export async function createItinerary(input: CreateItineraryInput): Promise<ItineraryRow> {
  return unwrap(
    await supabase.rpc('create_itinerary', {
      p_user_id: null,
      p_title: input.title,
      p_destination: input.destination ?? undefined,
      p_start_date: input.start_date ?? undefined,
      p_end_date: input.end_date ?? undefined,
      p_timezone: input.timezone ?? undefined,
      p_default_currency: input.default_currency ?? undefined,
      p_cover_url: input.cover_url ?? undefined,
      p_notes: input.notes ?? undefined,
      p_created_via: 'ui',
    }),
  )
}

export async function updateItinerary(input: UpdateItineraryInput): Promise<ItineraryRow> {
  return unwrap(
    await supabase.rpc('update_itinerary', {
      p_user_id: null,
      p_itinerary_id: input.itinerary_id,
      p_title: input.title ?? undefined,
      p_destination: input.destination ?? undefined,
      p_start_date: input.start_date ?? undefined,
      p_end_date: input.end_date ?? undefined,
      p_timezone: input.timezone ?? undefined,
      p_default_currency: input.default_currency ?? undefined,
      p_cover_url: input.cover_url ?? undefined,
      p_notes: input.notes ?? undefined,
    }),
  )
}

export async function deleteItinerary(id: string): Promise<void> {
  const res = await supabase.rpc('delete_itinerary', { p_user_id: null, p_itinerary_id: id })
  if (res.error) throw new Error(res.error.message)
}

export async function createDay(input: CreateDayInput): Promise<ItineraryDayRow> {
  return unwrap(
    await supabase.rpc('create_day', {
      p_user_id: null,
      p_itinerary_id: input.itinerary_id,
      p_day_date: input.day_date ?? undefined,
      p_label: input.label ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}

export async function updateDay(input: UpdateDayInput): Promise<ItineraryDayRow> {
  return unwrap(
    await supabase.rpc('update_day', {
      p_user_id: null,
      p_day_id: input.day_id,
      p_day_date: input.day_date ?? undefined,
      p_label: input.label ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}

export async function deleteDay(id: string): Promise<void> {
  const res = await supabase.rpc('delete_day', { p_user_id: null, p_day_id: id })
  if (res.error) throw new Error(res.error.message)
}

export async function reorderDays(itineraryId: string, dayIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_days', {
    p_user_id: null,
    p_itinerary_id: itineraryId,
    p_day_ids: dayIds as unknown as Json,
  })
  if (res.error) throw new Error(res.error.message)
}

export async function createItem(input: CreateItemInput): Promise<ItineraryItemRow> {
  return unwrap(
    await supabase.rpc('create_item', {
      p_user_id: null,
      p_title: input.title,
      p_day_id: input.day_id ?? undefined,
      p_itinerary_id: input.itinerary_id ?? undefined,
      p_place: input.place ?? undefined,
      p_lat: input.lat ?? undefined,
      p_lng: input.lng ?? undefined,
      p_category: input.category ?? undefined,
      p_start_time: input.start_time ?? undefined,
      p_end_time: input.end_time ?? undefined,
      p_end_day_offset: input.end_day_offset ?? undefined,
      p_transport_mode: input.transport_mode ?? undefined,
      p_transport_detail: input.transport_detail ?? undefined,
      p_cost: input.cost ?? undefined,
      p_currency: input.currency ?? undefined,
      p_booking_url: input.booking_url ?? undefined,
      p_booking_ref: input.booking_ref ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}

export async function updateItem(input: UpdateItemInput): Promise<ItineraryItemRow> {
  return unwrap(
    await supabase.rpc('update_item', {
      p_user_id: null,
      p_item_id: input.item_id,
      p_title: input.title ?? undefined,
      p_place: input.place ?? undefined,
      p_lat: input.lat ?? undefined,
      p_lng: input.lng ?? undefined,
      p_category: input.category ?? undefined,
      p_start_time: input.start_time ?? undefined,
      p_end_time: input.end_time ?? undefined,
      p_end_day_offset: input.end_day_offset ?? undefined,
      p_transport_mode: input.transport_mode ?? undefined,
      p_transport_detail: input.transport_detail ?? undefined,
      p_cost: input.cost ?? undefined,
      p_currency: input.currency ?? undefined,
      p_booking_url: input.booking_url ?? undefined,
      p_booking_ref: input.booking_ref ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_expected_updated_at: input.expected_updated_at ?? undefined,
    }),
  )
}

export async function deleteItem(id: string): Promise<void> {
  const res = await supabase.rpc('delete_item', { p_user_id: null, p_item_id: id })
  if (res.error) throw new Error(res.error.message)
}

/** Move an item to another day, or to the unscheduled bucket (dayId = null). */
export async function setItemDay(itemId: string, dayId: string | null): Promise<ItineraryItemRow> {
  return unwrap(
    await supabase.rpc('set_item_day', {
      p_user_id: null,
      p_item_id: itemId,
      p_day_id: dayId as unknown as string,
    }),
  )
}

export async function reorderItems(dayId: string | null, itemIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_items', {
    p_user_id: null,
    p_day_id: dayId as unknown as string,
    p_item_ids: itemIds as unknown as Json,
  })
  if (res.error) throw new Error(res.error.message)
}

export async function createItemsBulk(input: CreateItemsBulkInput): Promise<ItineraryItemRow[]> {
  return unwrap(
    await supabase.rpc('create_items_bulk', {
      p_user_id: null,
      p_day_id: input.day_id,
      p_items: input.items as unknown as Json,
    }),
  )
}

/** Author a whole trip in one call; returns the full tree with generated ids. */
export async function createTripBulk(input: CreateTripBulkInput): Promise<ItineraryTree> {
  return unwrap(
    await supabase.rpc('create_trip_bulk', {
      p_user_id: null,
      p_trip: input as unknown as Json,
      p_created_via: 'ui',
    }),
  ) as unknown as ItineraryTree
}

// ── Public share links ────────────────────────────────────────────
/** A trip as seen through a public share link (owner-free, optionally cost-free). */
export interface SharedTrip {
  id: string
  title: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  timezone: string | null
  default_currency: string
  notes: string | null
  hide_costs: boolean
  days: ItineraryDay[]
  unscheduled: ItineraryItem[]
  cost_by_currency: Record<string, number>
}

export async function listShareLinks(itineraryId: string): Promise<ShareLinkRow[]> {
  return unwrap(await supabase.rpc('list_share_links', { p_user_id: null, p_itinerary_id: itineraryId }))
}

export async function createShareLink(
  itineraryId: string,
  opts: { hideCosts?: boolean; expiresAt?: string | null } = {},
): Promise<ShareLinkRow> {
  return unwrap(
    await supabase.rpc('create_share_link', {
      p_user_id: null,
      p_itinerary_id: itineraryId,
      p_hide_costs: opts.hideCosts ?? false,
      p_expires_at: opts.expiresAt ?? undefined,
    }),
  )
}

export async function revokeShareLink(id: string): Promise<void> {
  const res = await supabase.rpc('revoke_share_link', { p_user_id: null, p_id: id })
  if (res.error) throw new Error(res.error.message)
}

/** Public, anon-callable read of a shared trip by token (null if missing/expired). */
export async function getSharedItinerary(token: string): Promise<SharedTrip | null> {
  return unwrap(await supabase.rpc('get_shared_itinerary', { p_token: token })) as unknown as SharedTrip | null
}

// ── Trip collaborators ────────────────────────────────────────────
export interface TripMember {
  user_id: string
  display_name: string | null
  role: string
}

export async function listMembers(itineraryId: string): Promise<TripMember[]> {
  return unwrap(
    await supabase.rpc('list_members', { p_user_id: null, p_itinerary_id: itineraryId }),
  ) as unknown as TripMember[]
}

export async function addMember(
  itineraryId: string,
  email: string,
  role: 'viewer' | 'editor',
): Promise<void> {
  const res = await supabase.rpc('add_member', {
    p_user_id: null,
    p_itinerary_id: itineraryId,
    p_email: email,
    p_role: role,
  })
  if (res.error) throw new Error(res.error.message)
}

export async function removeMember(itineraryId: string, memberUserId: string): Promise<void> {
  const res = await supabase.rpc('remove_member', {
    p_user_id: null,
    p_itinerary_id: itineraryId,
    p_member_user_id: memberUserId,
  })
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
