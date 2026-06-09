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
  TripBookingRow,
  TripChecklistRow,
} from './database.types'
import type {
  CreateBookingInput,
  CreateChecklistInput,
  CreateDayInput,
  CreateDeckInput,
  CreateFlashcardInput,
  CreateItemInput,
  CreateItemsBulkInput,
  CreateItineraryInput,
  CreateNoteInput,
  CreateTripBulkInput,
  LinkNotesInput,
  UpdateBookingInput,
  UpdateChecklistInput,
  UpdateDayInput,
  UpdateItemInput,
  UpdateItineraryInput,
  UpdateNoteInput,
} from '@shared/schemas'
import type {
  AddReminderInput,
  CreateCaptureInput,
  ResolveCaptureInput,
  CreateTaskInput,
  CreateTaskListInput,
  CreateTasksBulkInput,
  ScheduleTaskInput,
  SetRecurrenceInput,
  TaskStatus,
  UpdateTaskInput,
  UpdateTaskListInput,
} from '@shared/schemas'
import type { CaptureRow, TaskListRow, TaskReminderRow, TaskRow } from './database.types'
import type {
  SetHealthSettingsInput,
  LogHealthInput,
  UpdateHealthLogInput,
  SetJournalEntryInput,
  CreateMedicationInput,
  UpdateMedicationInput,
  HealthLogKind,
} from '@shared/schemas'
import type { HealthSettingsRow, HealthLogRow, JournalEntryRow, MedicationRow, ReviewPrefsRow, DigestPrefsRow } from './database.types'
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  AddPantryItemInput,
  UpdatePantryItemInput,
  AddShoppingItemsInput,
  UpdateShoppingItemInput,
  SetMealPlanInput,
} from '@shared/schemas'
import type { RecipeRow, PantryItemRow, ShoppingItemRow, MealPlanRow } from './database.types'
import type {
  AccountRow,
  BudgetRow,
  CategoryRow,
  LedgerMemberRow,
  LedgerRow,
  RecurringTransactionRow,
  SettlementRow,
  TransactionRow,
} from './database.types'
import type {
  CreateAccountInput,
  CreateCategoryInput,
  CreateLedgerInput,
  CreateSplitExpenseInput,
  CreateTransactionInput,
  CreateTransactionsBulkInput,
  CreateTransferInput,
  RecordSettlementInput,
  SetBudgetInput,
  SetRecurringTransactionInput,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateLedgerInput,
  UpdateTransactionInput,
  SetSubscriptionInput,
} from '@shared/schemas'
import type { SubscriptionRow } from './database.types'

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
  return unwrap(
    await supabase.from('decks').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
  )
}

export async function reorderDecks(deckIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_decks', { p_user_id: null, p_deck_ids: deckIds })
  if (res.error) throw new Error(res.error.message)
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
      p_image_url: input.image_url ?? undefined,
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
  patch: { front?: string; back?: string; deck_id?: string | null; note_id?: string | null; image_url?: string | null },
): Promise<CardRow> {
  return unwrap(
    await supabase.rpc('update_card', {
      p_user_id: null,
      p_card_id: cardId,
      p_front: patch.front ?? undefined,
      p_back: patch.back ?? undefined,
      p_deck_id: patch.deck_id ?? undefined,
      p_note_id: patch.note_id ?? undefined,
      // '' clears the image, a URL sets it, undefined leaves it unchanged
      p_image_url: patch.image_url ?? undefined,
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
  status: 'idea' | 'tentative' | 'planned' | 'done'
  assignees: string[]
}
export interface TripBooking {
  id: string
  type: 'flight' | 'lodging' | 'transport' | 'ticket' | 'car' | 'other'
  title: string
  start_at: string | null
  end_at: string | null
  from_label: string | null
  to_label: string | null
  location: string | null
  confirmation: string | null
  cost: number | null
  currency: string | null
  url: string | null
  notes: string | null
  sort_order: number
}
export interface ChecklistItem {
  id: string
  kind: 'packing' | 'todo'
  text: string
  category: string | null
  assignee: string | null
  done: boolean
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
  travelers: string[]
  budget_total: number | null
  created_at: string
  updated_at: string
  days: ItineraryDay[]
  unscheduled: ItineraryItem[]
  bookings: TripBooking[]
  checklist: ChecklistItem[]
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
  const row = unwrap<ItineraryRow>(
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
  // create_itinerary RPC doesn't take travelers/budget — set them in a follow-up.
  if (input.travelers?.length || input.budget_total != null) {
    return updateItinerary({
      itinerary_id: row.id,
      travelers: input.travelers,
      budget_total: input.budget_total,
    })
  }
  return row
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
      p_travelers: input.travelers ?? undefined,
      p_budget_total: input.budget_total ?? undefined,
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

// ── Trip v2: reservations, checklist, item status/assignees ────────
export async function createBooking(input: CreateBookingInput): Promise<TripBookingRow> {
  return unwrap(
    await supabase.rpc('create_booking', {
      p_user_id: null,
      p_itinerary_id: input.itinerary_id,
      p_type: input.type ?? undefined,
      p_title: input.title,
      p_start_at: input.start_at ?? undefined,
      p_end_at: input.end_at ?? undefined,
      p_from_label: input.from_label ?? undefined,
      p_to_label: input.to_label ?? undefined,
      p_location: input.location ?? undefined,
      p_confirmation: input.confirmation ?? undefined,
      p_cost: input.cost ?? undefined,
      p_currency: input.currency ?? undefined,
      p_url: input.url ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateBooking(input: UpdateBookingInput): Promise<TripBookingRow> {
  return unwrap(
    await supabase.rpc('update_booking', {
      p_user_id: null,
      p_booking_id: input.booking_id,
      p_type: input.type ?? undefined,
      p_title: input.title ?? undefined,
      p_start_at: input.start_at ?? undefined,
      p_end_at: input.end_at ?? undefined,
      p_from_label: input.from_label ?? undefined,
      p_to_label: input.to_label ?? undefined,
      p_location: input.location ?? undefined,
      p_confirmation: input.confirmation ?? undefined,
      p_cost: input.cost ?? undefined,
      p_currency: input.currency ?? undefined,
      p_url: input.url ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteBooking(id: string): Promise<void> {
  const res = await supabase.rpc('delete_booking', { p_user_id: null, p_booking_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function createChecklistItem(input: CreateChecklistInput): Promise<TripChecklistRow> {
  return unwrap(
    await supabase.rpc('create_checklist_item', {
      p_user_id: null,
      p_itinerary_id: input.itinerary_id,
      p_kind: input.kind ?? undefined,
      p_text: input.text,
      p_category: input.category ?? undefined,
      p_assignee: input.assignee ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateChecklistItem(input: UpdateChecklistInput): Promise<TripChecklistRow> {
  return unwrap(
    await supabase.rpc('update_checklist_item', {
      p_user_id: null,
      p_item_id: input.item_id,
      p_text: input.text ?? undefined,
      p_category: input.category ?? undefined,
      p_done: input.done ?? undefined,
      p_assignee: input.assignee ?? undefined,
      p_kind: input.kind ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteChecklistItem(id: string): Promise<void> {
  const res = await supabase.rpc('delete_checklist_item', { p_user_id: null, p_item_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function setItemStatus(itemId: string, status: ItineraryItem['status']): Promise<ItineraryItemRow> {
  return unwrap(await supabase.rpc('set_item_status', { p_user_id: null, p_item_id: itemId, p_status: status }))
}
export async function setItemAssignees(itemId: string, assignees: string[]): Promise<ItineraryItemRow> {
  return unwrap(await supabase.rpc('set_item_assignees', { p_user_id: null, p_item_id: itemId, p_assignees: assignees }))
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
  // Goes through the RPC now — direct UPDATE on api_keys is no longer permitted
  // (the shared write path is enforced; see migration 0011).
  const res = await supabase.rpc('revoke_api_key', { p_user_id: null, p_id: id })
  if (res.error) throw new Error(res.error.message)
}

// ════════════════════ Mnema Tempo (todos / habits / reminders) ════════════════════

/** A task plus its subtasks, reminders, and (for habits) check-in dates. */
export interface TaskTree extends TaskRow {
  subtasks: TaskRow[]
  reminders: TaskReminderRow[]
  checkins: string[]
}

export interface TaskFilters {
  listId?: string
  status?: TaskStatus
  kind?: 'task' | 'habit'
  label?: string
  dueBefore?: string
  scheduledOn?: string
  includeSubtasks?: boolean
  limit?: number
}

// ── Reads ──
export async function listTaskLists(): Promise<TaskListRow[]> {
  return unwrap(await supabase.from('task_lists').select('*').order('sort_order', { ascending: true }))
}

export async function listTasks(filters: TaskFilters = {}): Promise<TaskRow[]> {
  return unwrap(
    await supabase.rpc('list_tasks', {
      p_user_id: null,
      p_list_id: filters.listId ?? undefined,
      p_status: filters.status ?? undefined,
      p_kind: filters.kind ?? undefined,
      p_label: filters.label ?? undefined,
      p_due_before: filters.dueBefore ?? undefined,
      p_scheduled_on: filters.scheduledOn ?? undefined,
      p_include_subtasks: filters.includeSubtasks ?? undefined,
      p_limit: filters.limit ?? undefined,
    }),
  )
}

export async function getTask(id: string): Promise<TaskTree> {
  return unwrap(await supabase.rpc('get_task', { p_user_id: null, p_task_id: id })) as unknown as TaskTree
}

export async function searchTasks(query: string, limit = 50): Promise<TaskRow[]> {
  return unwrap(await supabase.rpc('search_tasks', { p_user_id: null, p_query: query, p_limit: limit }))
}

export async function getHabit(id: string): Promise<TaskTree> {
  return unwrap(await supabase.rpc('get_habit', { p_user_id: null, p_task_id: id })) as unknown as TaskTree
}

export interface StreakInfo {
  current_streak: number
  longest_streak: number
  last_checkin_date: string | null
  calendar: string[]
}
export async function getStreak(id: string): Promise<StreakInfo> {
  return unwrap(await supabase.rpc('get_streak', { p_user_id: null, p_task_id: id })) as unknown as StreakInfo
}

export interface RecurringSuggestion {
  title: string
  count: number
  task_ids: string[]
  avg_gap_days: number | null
  suggested_rule: string
}
export async function suggestRecurringTasks(opts: { lookbackDays?: number; minCount?: number } = {}): Promise<RecurringSuggestion[]> {
  return unwrap(
    await supabase.rpc('suggest_recurring_tasks', {
      p_user_id: null,
      p_lookback_days: opts.lookbackDays ?? undefined,
      p_min_count: opts.minCount ?? undefined,
    }),
  ) as unknown as RecurringSuggestion[]
}

// ── List writes ──
export async function createTaskList(input: CreateTaskListInput): Promise<TaskListRow> {
  return unwrap(
    await supabase.rpc('create_task_list', {
      p_user_id: null,
      p_name: input.name,
      p_kind: input.kind ?? undefined,
      p_color: input.color ?? undefined,
      p_icon: input.icon ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateTaskList(input: UpdateTaskListInput): Promise<TaskListRow> {
  return unwrap(
    await supabase.rpc('update_task_list', {
      p_user_id: null,
      p_list_id: input.list_id,
      p_name: input.name ?? undefined,
      p_kind: input.kind ?? undefined,
      p_color: input.color ?? undefined,
      p_icon: input.icon ?? undefined,
      p_is_archived: input.is_archived ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteTaskList(id: string): Promise<void> {
  const res = await supabase.rpc('delete_task_list', { p_user_id: null, p_list_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function reorderTaskLists(listIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_task_lists', { p_user_id: null, p_list_ids: listIds })
  if (res.error) throw new Error(res.error.message)
}

// ── Task writes ──
export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('create_task', {
      p_user_id: null,
      p_title: input.title,
      p_list_id: input.list_id ?? undefined,
      p_parent_task_id: input.parent_task_id ?? undefined,
      p_description: input.description ?? undefined,
      p_priority: input.priority ?? undefined,
      p_labels: input.labels ?? undefined,
      p_scheduled_date: input.scheduled_date ?? undefined,
      p_scheduled_time: input.scheduled_time ?? undefined,
      p_due_date: input.due_date ?? undefined,
      p_due_time: input.due_time ?? undefined,
      p_duration_min: input.duration_min ?? undefined,
      p_kind: input.kind ?? undefined,
      p_recurrence_rule: input.recurrence_rule ?? undefined,
      p_recurrence_after_completion: input.recurrence_after_completion ?? undefined,
      p_recurrence_anchor: input.recurrence_anchor ?? undefined,
      p_next_occurrence: input.next_occurrence ?? undefined,
      p_tz: input.tz ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
      p_reset_time: input.reset_time ?? undefined,
    }),
  )
}
export async function createTasksBulk(input: CreateTasksBulkInput): Promise<TaskRow[]> {
  return unwrap(await supabase.rpc('create_tasks_bulk', { p_user_id: null, p_tasks: input.tasks as unknown as Json }))
}
export async function updateTask(input: UpdateTaskInput): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('update_task', {
      p_user_id: null,
      p_task_id: input.task_id,
      p_title: input.title ?? undefined,
      p_description: input.description ?? undefined,
      p_list_id: input.list_id ?? undefined,
      p_priority: input.priority ?? undefined,
      p_labels: input.labels ?? undefined,
      p_due_date: input.due_date ?? undefined,
      p_due_time: input.due_time ?? undefined,
      p_status: input.status ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_reset_time: input.reset_time ?? undefined,
    }),
  )
}
export async function completeTask(taskId: string, opts: { completedAt?: string; nextOccurrence?: string } = {}): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('complete_task', {
      p_user_id: null,
      p_task_id: taskId,
      p_completed_at: opts.completedAt ?? undefined,
      p_next_occurrence: opts.nextOccurrence ?? undefined,
    }),
  )
}
export async function uncompleteTask(taskId: string): Promise<TaskRow> {
  return unwrap(await supabase.rpc('uncomplete_task', { p_user_id: null, p_task_id: taskId }))
}
export async function deleteTask(taskId: string): Promise<void> {
  const res = await supabase.rpc('delete_task', { p_user_id: null, p_task_id: taskId })
  if (res.error) throw new Error(res.error.message)
}
export async function moveTask(taskId: string, listId: string | null, parentId: string | null = null): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('move_task', {
      p_user_id: null,
      p_task_id: taskId,
      p_list_id: listId ?? undefined,
      p_parent_task_id: parentId ?? undefined,
    }),
  )
}
export async function reorderTasks(listId: string | null, taskIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_tasks', {
    p_user_id: null,
    p_list_id: listId as unknown as string,
    p_task_ids: taskIds,
  })
  if (res.error) throw new Error(res.error.message)
}
export async function setRecurrence(input: SetRecurrenceInput): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('set_recurrence', {
      p_user_id: null,
      p_task_id: input.task_id,
      p_recurrence_rule: input.recurrence_rule,
      p_recurrence_after_completion: input.recurrence_after_completion ?? undefined,
      p_recurrence_anchor: input.recurrence_anchor ?? undefined,
      p_next_occurrence: input.next_occurrence ?? undefined,
    }),
  )
}
export async function scheduleTask(input: ScheduleTaskInput): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('schedule_task', {
      p_user_id: null,
      p_task_id: input.task_id,
      p_scheduled_date: input.scheduled_date ?? undefined,
      p_scheduled_time: input.scheduled_time ?? undefined,
      p_due_date: input.due_date ?? undefined,
      p_due_time: input.due_time ?? undefined,
      p_duration_min: input.duration_min ?? undefined,
    }),
  )
}
export async function snoozeTask(taskId: string, until: string, untilTime?: string): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('snooze_task', {
      p_user_id: null,
      p_task_id: taskId,
      p_until: until,
      p_until_time: untilTime ?? undefined,
    }),
  )
}
export async function checkIn(taskId: string, date?: string, note?: string): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('check_in', {
      p_user_id: null,
      p_task_id: taskId,
      p_checkin_date: date ?? undefined,
      p_note: note ?? undefined,
    }),
  )
}
export async function uncheckIn(taskId: string, date?: string): Promise<TaskRow> {
  return unwrap(
    await supabase.rpc('uncheck_in', { p_user_id: null, p_task_id: taskId, p_checkin_date: date ?? undefined }),
  )
}
/** A check-in / completion row for the calendar history (habit check-ins AND task completions). */
export interface CheckInRow {
  task_id: string
  checkin_date: string
  title: string
  kind: string
}
export async function listCheckIns(from: string, to: string): Promise<CheckInRow[]> {
  return unwrap(await supabase.rpc('list_check_ins', { p_user_id: null, p_from: from, p_to: to }))
}
export async function addReminder(input: AddReminderInput): Promise<TaskReminderRow> {
  return unwrap(
    await supabase.rpc('add_reminder', {
      p_user_id: null,
      p_task_id: input.task_id,
      p_remind_at: input.remind_at,
      p_offset_min: input.offset_min ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function removeReminder(reminderId: string): Promise<void> {
  const res = await supabase.rpc('remove_reminder', { p_user_id: null, p_reminder_id: reminderId })
  if (res.error) throw new Error(res.error.message)
}
export async function setTaskUrl(taskId: string, url: string): Promise<TaskRow> {
  return unwrap(await supabase.rpc('set_task_url', { p_user_id: null, p_task_id: taskId, p_url: url }))
}

// ── Daily review (end-of-day) ──
export async function getReviewPrefs(): Promise<ReviewPrefsRow | null> {
  return unwrap(await supabase.from('review_prefs').select('*').maybeSingle())
}
export async function setReviewPrefs(isEnabled: boolean): Promise<ReviewPrefsRow> {
  return unwrap(await supabase.rpc('set_review_prefs', { p_user_id: null, p_is_enabled: isEnabled }))
}

// ── Daily to-do digest (每日待辦提醒) ──
export async function getDigestPrefs(): Promise<DigestPrefsRow | null> {
  return unwrap(await supabase.from('digest_prefs').select('*').maybeSingle())
}
export async function setDigestPrefs(input: { isEnabled: boolean; time?: string; tz?: string }): Promise<DigestPrefsRow> {
  return unwrap(
    await supabase.rpc('set_digest_prefs', {
      p_user_id: null,
      p_is_enabled: input.isEnabled,
      p_digest_time: input.time ?? undefined,
      p_tz: input.tz ?? undefined,
    }),
  )
}

// ── FCM native push tokens ──
export async function saveFcmToken(token: string, platform = 'android'): Promise<void> {
  const res = await supabase.rpc('save_fcm_token', { p_user_id: null, p_token: token, p_platform: platform })
  if (res.error) throw new Error(res.error.message)
}
export async function deleteFcmToken(token: string): Promise<void> {
  const res = await supabase.rpc('delete_fcm_token', { p_user_id: null, p_token: token })
  if (res.error) throw new Error(res.error.message)
}

// ── Captures (quick-capture inbox / 暫存區) ──
export type CaptureStatus = 'pending' | 'processed' | 'dismissed'
export async function listCaptures(status: CaptureStatus | 'all' = 'pending'): Promise<CaptureRow[]> {
  const base = supabase.from('captures').select('*').order('created_at', { ascending: false })
  const q = status === 'all' ? base : base.eq('status', status)
  return unwrap(await q)
}
export async function createCapture(input: CreateCaptureInput): Promise<CaptureRow> {
  return unwrap(
    await supabase.rpc('create_capture', {
      p_user_id: null,
      p_raw_text: input.raw_text,
      p_source: input.source ?? 'ui',
    }),
  )
}
export async function resolveCapture(input: ResolveCaptureInput): Promise<CaptureRow> {
  return unwrap(
    await supabase.rpc('resolve_capture', {
      p_user_id: null,
      p_capture_id: input.capture_id,
      p_resolved_kind: input.resolved_kind ?? undefined,
      p_resolved_ref: (input.resolved_ref ?? undefined) as unknown as Json | undefined,
      p_note: input.note ?? undefined,
    }),
  )
}
export async function dismissCapture(captureId: string): Promise<CaptureRow> {
  return unwrap(await supabase.rpc('dismiss_capture', { p_user_id: null, p_capture_id: captureId }))
}
export async function reopenCapture(captureId: string): Promise<CaptureRow> {
  return unwrap(await supabase.rpc('reopen_capture', { p_user_id: null, p_capture_id: captureId }))
}
export async function deleteCapture(captureId: string): Promise<void> {
  const res = await supabase.rpc('delete_capture', { p_user_id: null, p_capture_id: captureId })
  if (res.error) throw new Error(res.error.message)
}

// ════════════════════ Mnema Vitals (health) ════════════════════
export interface HealthLogFilters {
  kind?: HealthLogKind
  from?: string
  to?: string
  limit?: number
}

export async function getHealthSettings(): Promise<HealthSettingsRow | null> {
  return unwrap(await supabase.from('health_settings').select('*').maybeSingle())
}
export async function setHealthSettings(input: SetHealthSettingsInput): Promise<HealthSettingsRow> {
  return unwrap(
    await supabase.rpc('set_health_settings', {
      p_user_id: null,
      p_enabled_modules: input.enabled_modules ?? undefined,
      p_weight_unit: input.weight_unit ?? undefined,
    }),
  )
}

export async function listHealthLogs(filters: HealthLogFilters = {}): Promise<HealthLogRow[]> {
  let q = supabase.from('health_logs').select('*').order('logged_at', { ascending: false })
  if (filters.kind) q = q.eq('kind', filters.kind)
  if (filters.from) q = q.gte('logged_date', filters.from)
  if (filters.to) q = q.lte('logged_date', filters.to)
  q = q.limit(filters.limit ?? 500)
  return unwrap(await q)
}
export async function logHealth(input: LogHealthInput): Promise<HealthLogRow> {
  return unwrap(
    await supabase.rpc('log_health', {
      p_user_id: null,
      p_kind: input.kind,
      p_value: input.value ?? undefined,
      p_value2: input.value2 ?? undefined,
      p_unit: input.unit ?? undefined,
      p_text_value: input.text_value ?? undefined,
      p_meta: (input.meta ?? undefined) as unknown as Json | undefined,
      p_logged_at: input.logged_at ?? undefined,
      p_logged_date: input.logged_date ?? undefined,
      p_note: input.note ?? undefined,
    }),
  )
}
export async function updateHealthLog(input: UpdateHealthLogInput): Promise<HealthLogRow> {
  return unwrap(
    await supabase.rpc('update_health_log', {
      p_user_id: null,
      p_log_id: input.log_id,
      p_value: input.value ?? undefined,
      p_value2: input.value2 ?? undefined,
      p_unit: input.unit ?? undefined,
      p_text_value: input.text_value ?? undefined,
      p_meta: (input.meta ?? undefined) as unknown as Json | undefined,
      p_logged_at: input.logged_at ?? undefined,
      p_logged_date: input.logged_date ?? undefined,
      p_note: input.note ?? undefined,
    }),
  )
}
export async function deleteHealthLog(logId: string): Promise<void> {
  const res = await supabase.rpc('delete_health_log', { p_user_id: null, p_log_id: logId })
  if (res.error) throw new Error(res.error.message)
}

export async function listJournalEntries(from?: string, to?: string): Promise<JournalEntryRow[]> {
  let q = supabase.from('journal_entries').select('*').order('entry_date', { ascending: false })
  if (from) q = q.gte('entry_date', from)
  if (to) q = q.lte('entry_date', to)
  return unwrap(await q.limit(500))
}
export async function getJournalEntry(date: string): Promise<JournalEntryRow | null> {
  return unwrap(await supabase.from('journal_entries').select('*').eq('entry_date', date).maybeSingle())
}
export async function setJournalEntry(input: SetJournalEntryInput): Promise<JournalEntryRow> {
  return unwrap(
    await supabase.rpc('set_journal_entry', {
      p_user_id: null,
      p_entry_date: input.entry_date ?? undefined,
      p_mood: input.mood ?? undefined,
      p_energy: input.energy ?? undefined,
      p_body: input.body ?? undefined,
      p_tags: input.tags ?? undefined,
    }),
  )
}
export async function deleteJournalEntry(entryId: string): Promise<void> {
  const res = await supabase.rpc('delete_journal_entry', { p_user_id: null, p_entry_id: entryId })
  if (res.error) throw new Error(res.error.message)
}

export async function listMedications(activeOnly = false): Promise<MedicationRow[]> {
  let q = supabase.from('medications').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  return unwrap(await q)
}
export async function createMedication(input: CreateMedicationInput): Promise<MedicationRow> {
  return unwrap(
    await supabase.rpc('create_medication', {
      p_user_id: null,
      p_name: input.name,
      p_dosage: input.dosage ?? undefined,
      p_times: input.times ?? undefined,
      p_schedule_rule: input.schedule_rule ?? undefined,
      p_is_active: input.is_active ?? undefined,
      p_notes: input.notes ?? undefined,
    }),
  )
}
export async function updateMedication(input: UpdateMedicationInput): Promise<MedicationRow> {
  return unwrap(
    await supabase.rpc('update_medication', {
      p_user_id: null,
      p_medication_id: input.medication_id,
      p_name: input.name ?? undefined,
      p_dosage: input.dosage ?? undefined,
      p_times: input.times ?? undefined,
      p_schedule_rule: input.schedule_rule ?? undefined,
      p_is_active: input.is_active ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteMedication(medicationId: string): Promise<void> {
  const res = await supabase.rpc('delete_medication', { p_user_id: null, p_medication_id: medicationId })
  if (res.error) throw new Error(res.error.message)
}

// ════════════════════ Mnema Kitchen (recipes / pantry / shopping / meal plan) ════════════════════
export async function listRecipes(query?: string, favoritesOnly = false): Promise<RecipeRow[]> {
  let q = supabase
    .from('recipes')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false })
  if (query) q = q.ilike('title', `%${query}%`)
  if (favoritesOnly) q = q.eq('is_favorite', true)
  return unwrap(await q.limit(500))
}
export async function getRecipe(id: string): Promise<RecipeRow | null> {
  return unwrap(await supabase.from('recipes').select('*').eq('id', id).maybeSingle())
}
export async function createRecipe(input: CreateRecipeInput): Promise<RecipeRow> {
  return unwrap(
    await supabase.rpc('create_recipe', {
      p_user_id: null,
      p_title: input.title,
      p_description: input.description ?? undefined,
      p_instructions: input.instructions ?? undefined,
      p_ingredients: (input.ingredients ?? undefined) as unknown as Json | undefined,
      p_servings: input.servings ?? undefined,
      p_total_minutes: input.total_minutes ?? undefined,
      p_tags: input.tags ?? undefined,
      p_source_url: input.source_url ?? undefined,
      p_image_url: input.image_url ?? undefined,
      p_is_favorite: input.is_favorite ?? undefined,
    }),
  )
}
export async function updateRecipe(input: UpdateRecipeInput): Promise<RecipeRow> {
  return unwrap(
    await supabase.rpc('update_recipe', {
      p_user_id: null,
      p_recipe_id: input.recipe_id,
      p_title: input.title ?? undefined,
      p_description: input.description ?? undefined,
      p_instructions: input.instructions ?? undefined,
      p_ingredients: (input.ingredients ?? undefined) as unknown as Json | undefined,
      p_servings: input.servings ?? undefined,
      p_total_minutes: input.total_minutes ?? undefined,
      p_tags: input.tags ?? undefined,
      p_source_url: input.source_url ?? undefined,
      p_image_url: input.image_url ?? undefined,
      p_is_favorite: input.is_favorite ?? undefined,
    }),
  )
}
export async function deleteRecipe(recipeId: string): Promise<void> {
  const res = await supabase.rpc('delete_recipe', { p_user_id: null, p_recipe_id: recipeId })
  if (res.error) throw new Error(res.error.message)
}

export async function listPantry(): Promise<PantryItemRow[]> {
  return unwrap(await supabase.from('pantry_items').select('*').order('category', { ascending: true }).order('name', { ascending: true }).limit(1000))
}
export async function addPantryItem(input: AddPantryItemInput): Promise<PantryItemRow> {
  return unwrap(
    await supabase.rpc('add_pantry_item', {
      p_user_id: null,
      p_name: input.name,
      p_quantity: input.quantity ?? undefined,
      p_unit: input.unit ?? undefined,
      p_category: input.category ?? undefined,
      p_location: input.location ?? undefined,
      p_expires_on: input.expires_on ?? undefined,
      p_notes: input.notes ?? undefined,
    }),
  )
}
export async function updatePantryItem(input: UpdatePantryItemInput): Promise<PantryItemRow> {
  return unwrap(
    await supabase.rpc('update_pantry_item', {
      p_user_id: null,
      p_item_id: input.item_id,
      p_name: input.name ?? undefined,
      p_quantity: input.quantity ?? undefined,
      p_unit: input.unit ?? undefined,
      p_category: input.category ?? undefined,
      p_location: input.location ?? undefined,
      p_expires_on: input.expires_on ?? undefined,
      p_notes: input.notes ?? undefined,
    }),
  )
}
export async function deletePantryItem(itemId: string): Promise<void> {
  const res = await supabase.rpc('delete_pantry_item', { p_user_id: null, p_item_id: itemId })
  if (res.error) throw new Error(res.error.message)
}

export async function listShopping(): Promise<ShoppingItemRow[]> {
  return unwrap(
    await supabase.from('shopping_items').select('*').order('is_checked', { ascending: true }).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(1000),
  )
}
export async function addShoppingItems(input: AddShoppingItemsInput): Promise<ShoppingItemRow[]> {
  return unwrap(
    await supabase.rpc('add_shopping_items', {
      p_user_id: null,
      p_items: input.items as unknown as Json,
    }),
  )
}
export async function updateShoppingItem(input: UpdateShoppingItemInput): Promise<ShoppingItemRow> {
  return unwrap(
    await supabase.rpc('update_shopping_item', {
      p_user_id: null,
      p_item_id: input.item_id,
      p_name: input.name ?? undefined,
      p_quantity: input.quantity ?? undefined,
      p_category: input.category ?? undefined,
      p_is_checked: input.is_checked ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteShoppingItem(itemId: string): Promise<void> {
  const res = await supabase.rpc('delete_shopping_item', { p_user_id: null, p_item_id: itemId })
  if (res.error) throw new Error(res.error.message)
}
export async function clearCheckedShopping(): Promise<number> {
  return unwrap(await supabase.rpc('clear_checked_shopping', { p_user_id: null }))
}

export async function listMealPlans(from?: string, to?: string): Promise<MealPlanRow[]> {
  let q = supabase.from('meal_plans').select('*').order('plan_date', { ascending: true }).order('slot', { ascending: true })
  if (from) q = q.gte('plan_date', from)
  if (to) q = q.lte('plan_date', to)
  return unwrap(await q.limit(1000))
}
export async function setMealPlan(input: SetMealPlanInput): Promise<MealPlanRow> {
  return unwrap(
    await supabase.rpc('set_meal_plan', {
      p_user_id: null,
      p_plan_id: input.plan_id ?? undefined,
      p_plan_date: input.plan_date ?? undefined,
      p_slot: input.slot ?? undefined,
      p_recipe_id: input.recipe_id ?? undefined,
      p_title: input.title ?? undefined,
      p_note: input.note ?? undefined,
    }),
  )
}
export async function deleteMealPlan(planId: string): Promise<void> {
  const res = await supabase.rpc('delete_meal_plan', { p_user_id: null, p_plan_id: planId })
  if (res.error) throw new Error(res.error.message)
}

// ════════════════════ Mnema Galleon (money) ════════════════════

export interface LedgerAccount {
  id: string
  name: string
  type: string
  currency: string
  opening_balance: number
  icon: string | null
  color: string | null
  is_archived: boolean
  sort_order: number
  balance: number
  txn_count?: number
}
export interface LedgerCategory {
  id: string
  name: string
  kind: 'income' | 'expense'
  parent_id: string | null
  icon: string | null
  color: string | null
  sort_order: number
}
export interface LedgerDetail {
  id: string
  owner_id: string
  name: string
  base_currency: string
  icon: string | null
  color: string | null
  is_archived: boolean
  my_role: string
  accounts: LedgerAccount[]
  categories: LedgerCategory[]
}
export interface LedgerSummary {
  income: number
  expense: number
  by_category: { category_id: string | null; name: string | null; icon: string | null; total: number }[]
}
export interface TxnFilters {
  ledgerId: string
  accountId?: string
  categoryId?: string
  type?: 'income' | 'expense' | 'transfer'
  from?: string
  to?: string
  limit?: number
}

// ── Reads ──
export async function listLedgers(): Promise<LedgerRow[]> {
  return unwrap(await supabase.from('ledgers').select('*').order('sort_order', { ascending: true }))
}
export async function getLedger(id: string): Promise<LedgerDetail> {
  return unwrap(await supabase.rpc('get_ledger', { p_user_id: null, p_ledger_id: id })) as unknown as LedgerDetail
}
export async function listTransactions(f: TxnFilters): Promise<TransactionRow[]> {
  return unwrap(
    await supabase.rpc('list_transactions', {
      p_user_id: null,
      p_ledger_id: f.ledgerId,
      p_account_id: f.accountId ?? undefined,
      p_category_id: f.categoryId ?? undefined,
      p_type: f.type ?? undefined,
      p_from: f.from ?? undefined,
      p_to: f.to ?? undefined,
      p_limit: f.limit ?? undefined,
    }),
  )
}
export async function searchTransactions(ledgerId: string, query: string, limit = 50): Promise<TransactionRow[]> {
  return unwrap(await supabase.rpc('search_transactions', { p_user_id: null, p_ledger_id: ledgerId, p_query: query, p_limit: limit }))
}
export async function getLedgerSummary(ledgerId: string, from: string, to: string): Promise<LedgerSummary> {
  return unwrap(
    await supabase.rpc('get_ledger_summary', { p_user_id: null, p_ledger_id: ledgerId, p_from: from, p_to: to }),
  ) as unknown as LedgerSummary
}

// ── Ledger writes ──
export async function createLedger(input: CreateLedgerInput): Promise<LedgerRow> {
  return unwrap(
    await supabase.rpc('create_ledger', {
      p_user_id: null,
      p_name: input.name,
      p_base_currency: input.base_currency ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateLedger(input: UpdateLedgerInput): Promise<LedgerRow> {
  return unwrap(
    await supabase.rpc('update_ledger', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_name: input.name ?? undefined,
      p_base_currency: input.base_currency ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_is_archived: input.is_archived ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteLedger(id: string): Promise<void> {
  const res = await supabase.rpc('delete_ledger', { p_user_id: null, p_ledger_id: id })
  if (res.error) throw new Error(res.error.message)
}

// ── Account writes ──
export async function createAccount(input: CreateAccountInput): Promise<AccountRow> {
  return unwrap(
    await supabase.rpc('create_account', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_name: input.name,
      p_type: input.type ?? undefined,
      p_currency: input.currency ?? undefined,
      p_opening_balance: input.opening_balance ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateAccount(input: UpdateAccountInput): Promise<AccountRow> {
  return unwrap(
    await supabase.rpc('update_account', {
      p_user_id: null,
      p_account_id: input.account_id,
      p_name: input.name ?? undefined,
      p_type: input.type ?? undefined,
      p_currency: input.currency ?? undefined,
      p_opening_balance: input.opening_balance ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_is_archived: input.is_archived ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteAccount(id: string, reassignTo?: string): Promise<void> {
  const res = await supabase.rpc('delete_account', { p_user_id: null, p_account_id: id, p_reassign_to_account_id: reassignTo ?? undefined })
  if (res.error) throw new Error(res.error.message)
}
export async function reorderAccounts(ledgerId: string, accountIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_accounts', { p_user_id: null, p_ledger_id: ledgerId, p_account_ids: accountIds })
  if (res.error) throw new Error(res.error.message)
}

// ── Category writes ──
export async function createCategory(input: CreateCategoryInput): Promise<CategoryRow> {
  return unwrap(
    await supabase.rpc('create_category', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_name: input.name,
      p_kind: input.kind,
      p_parent_id: input.parent_id ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function updateCategory(input: UpdateCategoryInput): Promise<CategoryRow> {
  return unwrap(
    await supabase.rpc('update_category', {
      p_user_id: null,
      p_category_id: input.category_id,
      p_name: input.name ?? undefined,
      p_kind: input.kind ?? undefined,
      p_parent_id: input.parent_id ?? undefined,
      p_icon: input.icon ?? undefined,
      p_color: input.color ?? undefined,
      p_sort_order: input.sort_order ?? undefined,
    }),
  )
}
export async function deleteCategory(id: string): Promise<void> {
  const res = await supabase.rpc('delete_category', { p_user_id: null, p_category_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function reorderCategories(ledgerId: string, categoryIds: string[]): Promise<void> {
  const res = await supabase.rpc('reorder_categories', { p_user_id: null, p_ledger_id: ledgerId, p_category_ids: categoryIds })
  if (res.error) throw new Error(res.error.message)
}

// ── Transaction writes ──
export async function createTransaction(input: CreateTransactionInput): Promise<TransactionRow> {
  return unwrap(
    await supabase.rpc('create_transaction', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_type: input.type,
      p_amount: input.amount,
      p_account_id: input.account_id ?? undefined,
      p_category_id: input.category_id ?? undefined,
      p_transfer_account_id: input.transfer_account_id ?? undefined,
      p_currency: input.currency ?? undefined,
      p_fx_rate: input.fx_rate ?? undefined,
      p_payee: input.payee ?? undefined,
      p_note: input.note ?? undefined,
      p_txn_date: input.txn_date ?? undefined,
      p_tags: input.tags ?? undefined,
      p_receipt_url: input.receipt_url ?? undefined,
      p_created_via: 'ui',
    }),
  )
}
export async function createTransactionsBulk(input: CreateTransactionsBulkInput): Promise<TransactionRow[]> {
  return unwrap(
    await supabase.rpc('create_transactions_bulk', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_transactions: input.transactions as unknown as Json,
    }),
  )
}
export async function updateTransaction(input: UpdateTransactionInput): Promise<TransactionRow> {
  return unwrap(
    await supabase.rpc('update_transaction', {
      p_user_id: null,
      p_transaction_id: input.transaction_id,
      p_amount: input.amount ?? undefined,
      p_type: input.type ?? undefined,
      p_account_id: input.account_id ?? undefined,
      p_category_id: input.category_id ?? undefined,
      p_transfer_account_id: input.transfer_account_id ?? undefined,
      p_payee: input.payee ?? undefined,
      p_note: input.note ?? undefined,
      p_txn_date: input.txn_date ?? undefined,
      p_tags: input.tags ?? undefined,
      p_receipt_url: input.receipt_url ?? undefined,
    }),
  )
}
export async function deleteTransaction(id: string): Promise<void> {
  const res = await supabase.rpc('delete_transaction', { p_user_id: null, p_transaction_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function createTransfer(input: CreateTransferInput): Promise<TransactionRow> {
  return createTransaction({
    ledger_id: input.ledger_id,
    type: 'transfer',
    amount: input.amount,
    account_id: input.from_account_id,
    transfer_account_id: input.to_account_id,
    note: input.note,
    txn_date: input.txn_date,
  })
}

// ── Budgets / recurring / reports (P2) ──
export interface BudgetStatusItem {
  budget_id: string
  category_id: string | null
  name: string
  icon: string | null
  amount: number
  rollover: boolean
  spent: number
}
export interface MonthlyTrendItem {
  month: string
  income: number
  expense: number
}

export async function getBudgetStatus(ledgerId: string, from: string, to: string): Promise<BudgetStatusItem[]> {
  return unwrap(
    await supabase.rpc('get_budget_status', { p_user_id: null, p_ledger_id: ledgerId, p_from: from, p_to: to }),
  ) as unknown as BudgetStatusItem[]
}
export async function setBudget(input: SetBudgetInput): Promise<BudgetRow> {
  return unwrap(
    await supabase.rpc('set_budget', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      // No SQL default → must pass null explicitly for an overall (category-less) budget.
      p_category_id: (input.category_id ?? null) as unknown as string,
      p_amount: input.amount,
      p_period: input.period ?? undefined,
      p_rollover: input.rollover ?? undefined,
    }),
  )
}
export async function deleteBudget(id: string): Promise<void> {
  const res = await supabase.rpc('delete_budget', { p_user_id: null, p_budget_id: id })
  if (res.error) throw new Error(res.error.message)
}

export async function listRecurring(ledgerId: string): Promise<RecurringTransactionRow[]> {
  return unwrap(
    await supabase.from('recurring_transactions').select('*').eq('ledger_id', ledgerId).order('next_run', { ascending: true }),
  )
}
export async function setRecurringTransaction(input: SetRecurringTransactionInput): Promise<RecurringTransactionRow> {
  return unwrap(
    await supabase.rpc('set_recurring_transaction', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_type: input.type,
      p_amount: input.amount,
      p_recurrence_rule: input.recurrence_rule,
      p_next_run: input.next_run,
      p_account_id: input.account_id ?? undefined,
      p_category_id: input.category_id ?? undefined,
      p_transfer_account_id: input.transfer_account_id ?? undefined,
      p_currency: input.currency ?? undefined,
      p_payee: input.payee ?? undefined,
      p_note: input.note ?? undefined,
      p_recurring_id: input.recurring_id ?? undefined,
      p_is_active: input.is_active ?? undefined,
    }),
  )
}
export async function deleteRecurringTransaction(id: string): Promise<void> {
  const res = await supabase.rpc('delete_recurring_transaction', { p_user_id: null, p_recurring_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function runDueRecurring(ledgerId: string): Promise<number> {
  return unwrap(await supabase.rpc('run_due_recurring', { p_user_id: null, p_ledger_id: ledgerId })) as unknown as number
}
export async function getMonthlyTrend(ledgerId: string, months = 6): Promise<MonthlyTrendItem[]> {
  return unwrap(
    await supabase.rpc('get_monthly_trend', { p_user_id: null, p_ledger_id: ledgerId, p_months: months }),
  ) as unknown as MonthlyTrendItem[]
}

// ── Members + splitting (P3) ──
export interface MemberBalanceItem {
  member_id: string
  display_name: string
  user_id: string | null
  role: string
  balance: number
}

export async function getBalances(ledgerId: string): Promise<MemberBalanceItem[]> {
  return unwrap(await supabase.rpc('get_balances', { p_user_id: null, p_ledger_id: ledgerId })) as unknown as MemberBalanceItem[]
}
export async function addLedgerMember(input: {
  ledger_id: string
  display_name: string
  email?: string
  role?: 'editor' | 'viewer'
}): Promise<LedgerMemberRow> {
  return unwrap(
    await supabase.rpc('add_ledger_member', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_display_name: input.display_name,
      p_email: input.email ?? undefined,
      p_role: input.role ?? undefined,
    }),
  )
}
export async function updateLedgerMember(input: {
  member_id: string
  display_name?: string
  role?: 'editor' | 'viewer'
}): Promise<LedgerMemberRow> {
  return unwrap(
    await supabase.rpc('update_ledger_member', {
      p_user_id: null,
      p_member_id: input.member_id,
      p_display_name: input.display_name ?? undefined,
      p_role: input.role ?? undefined,
    }),
  )
}
export async function removeLedgerMember(memberId: string): Promise<void> {
  const res = await supabase.rpc('remove_ledger_member', { p_user_id: null, p_member_id: memberId })
  if (res.error) throw new Error(res.error.message)
}
export async function createSplitExpense(input: CreateSplitExpenseInput): Promise<TransactionRow> {
  return unwrap(
    await supabase.rpc('create_split_expense', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_amount: input.amount,
      p_splits: input.splits as unknown as Json,
      p_account_id: input.account_id ?? undefined,
      p_category_id: input.category_id ?? undefined,
      p_payee: input.payee ?? undefined,
      p_note: input.note ?? undefined,
      p_txn_date: input.txn_date ?? undefined,
      p_currency: input.currency ?? undefined,
    }),
  )
}
export async function recordSettlement(input: RecordSettlementInput): Promise<SettlementRow> {
  return unwrap(
    await supabase.rpc('record_settlement', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_from_member: input.from_member,
      p_to_member: input.to_member,
      p_amount: input.amount,
      p_note: input.note ?? undefined,
      p_sett_date: input.sett_date ?? undefined,
      p_currency: input.currency ?? undefined,
    }),
  )
}
export async function deleteSettlement(id: string): Promise<void> {
  const res = await supabase.rpc('delete_settlement', { p_user_id: null, p_settlement_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function listSettlements(ledgerId: string): Promise<SettlementRow[]> {
  return unwrap(await supabase.from('settlements').select('*').eq('ledger_id', ledgerId).order('sett_date', { ascending: false }))
}
export async function listSplitTxnIds(ledgerId: string): Promise<string[]> {
  const rows = unwrap(await supabase.from('transaction_splits').select('transaction_id').eq('ledger_id', ledgerId)) as { transaction_id: string }[]
  return [...new Set(rows.map((r) => r.transaction_id))]
}

// ── Galleon: subscriptions ──
export interface UpcomingSubscription {
  id: string
  name: string
  amount: number
  currency: string
  renewal_date: string
  cancel_reminder_days: number
}
export async function listSubscriptions(ledgerId: string): Promise<SubscriptionRow[]> {
  return unwrap(
    await supabase
      .from('subscriptions')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('is_active', { ascending: false })
      .order('renewal_date', { ascending: true }),
  )
}
export async function setSubscription(input: SetSubscriptionInput): Promise<SubscriptionRow> {
  return unwrap(
    await supabase.rpc('set_subscription', {
      p_user_id: null,
      p_ledger_id: input.ledger_id,
      p_name: input.name,
      p_amount: input.amount,
      p_renewal_date: input.renewal_date,
      p_recurrence_rule: input.recurrence_rule ?? undefined,
      p_account_id: input.account_id ?? undefined,
      p_category_id: input.category_id ?? undefined,
      p_currency: input.currency ?? undefined,
      p_cancel_reminder_days: input.cancel_reminder_days ?? undefined,
      p_notes: input.notes ?? undefined,
      p_subscription_id: input.subscription_id ?? undefined,
      p_is_active: input.is_active ?? undefined,
    }),
  )
}
export async function deleteSubscription(id: string): Promise<void> {
  const res = await supabase.rpc('delete_subscription', { p_user_id: null, p_subscription_id: id })
  if (res.error) throw new Error(res.error.message)
}
export async function postDueSubscriptions(ledgerId: string): Promise<number> {
  return unwrap(await supabase.rpc('post_due_subscriptions', { p_user_id: null, p_ledger_id: ledgerId }))
}
export async function getUpcomingSubscriptions(ledgerId: string, daysAhead = 14): Promise<UpcomingSubscription[]> {
  const data = unwrap(await supabase.rpc('get_upcoming_subscriptions', { p_user_id: null, p_ledger_id: ledgerId, p_days_ahead: daysAhead }))
  return (data ?? []) as unknown as UpcomingSubscription[]
}
