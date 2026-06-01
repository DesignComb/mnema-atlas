import { z } from 'zod'

/**
 * Single source of truth for write-tool inputs.
 * Imported by BOTH the React app (form validation) and the Cloudflare Worker
 * (MCP tool args + REST body validation), so UI / MCP / REST cannot drift.
 *
 * Each schema maps 1:1 to a Postgres SECURITY DEFINER RPC in 0001_init.sql.
 */

export const linkType = z.enum(['reference', 'related', 'parent', 'child', 'elaborates'])
export type LinkType = z.infer<typeof linkType>

const uuid = z.string().uuid()
const title = z.string().trim().min(1, 'Title is required').max(300)

export const createNoteInput = z.object({
  title,
  body: z.string().max(100_000).default(''),
  deck_id: uuid.optional(),
})
export type CreateNoteInput = z.infer<typeof createNoteInput>

export const updateNoteInput = z.object({
  note_id: uuid,
  title: title.optional(),
  body: z.string().max(100_000).optional(),
  deck_id: uuid.optional(),
})
export type UpdateNoteInput = z.infer<typeof updateNoteInput>

export const getNoteInput = z.object({ note_id: uuid })

export const searchNotesInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100).default(20),
})
export type SearchNotesInput = z.infer<typeof searchNotesInput>

export const createDeckInput = z.object({
  name: z.string().trim().min(1).max(120),
  parent_deck_id: uuid.optional(),
  description: z.string().max(2_000).optional(),
})
export type CreateDeckInput = z.infer<typeof createDeckInput>

const flashcardFace = z.string().trim().min(1).max(8_000)

export const createFlashcardInput = z.object({
  front: flashcardFace,
  back: flashcardFace,
  note_id: uuid.optional(),
  deck_id: uuid.optional(),
})
export type CreateFlashcardInput = z.infer<typeof createFlashcardInput>

export const createFlashcardsBulkInput = z.object({
  cards: z
    .array(
      z.object({
        front: flashcardFace,
        back: flashcardFace,
        note_id: uuid.optional(),
        deck_id: uuid.optional(),
      }),
    )
    .min(1)
    .max(200),
  deck_id: uuid.optional(),
})
export type CreateFlashcardsBulkInput = z.infer<typeof createFlashcardsBulkInput>

export const linkNotesInput = z.object({
  source_note_id: uuid,
  target_note_id: uuid,
  link_type: linkType.default('reference'),
  weight: z.number().min(0).max(10).default(1),
})
export type LinkNotesInput = z.infer<typeof linkNotesInput>

// ── Travel itineraries ────────────────────────────────────────────
export const itineraryCategory = z.enum(['food', 'transport', 'sight', 'lodging', 'other'])
export type ItineraryCategory = z.infer<typeof itineraryCategory>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const clockTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM')
const currency = z.string().trim().min(1).max(8)
const placeUrl = z.string().trim().url().max(2_000)

export const createItineraryInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  destination: z.string().trim().max(300).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  timezone: z.string().trim().max(64).optional(),
  default_currency: currency.optional(),
  cover_url: placeUrl.optional(),
  notes: z.string().max(20_000).optional(),
})
export type CreateItineraryInput = z.infer<typeof createItineraryInput>

export const updateItineraryInput = z.object({
  itinerary_id: uuid,
  title: z.string().trim().min(1).max(300).optional(),
  destination: z.string().trim().max(300).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  timezone: z.string().trim().max(64).optional(),
  default_currency: currency.optional(),
  cover_url: placeUrl.optional(),
  notes: z.string().max(20_000).optional(),
})
export type UpdateItineraryInput = z.infer<typeof updateItineraryInput>

export const createDayInput = z.object({
  itinerary_id: uuid,
  day_date: isoDate.optional(),
  label: z.string().trim().max(200).optional(),
  sort_order: z.number().int().optional(),
})
export type CreateDayInput = z.infer<typeof createDayInput>

export const updateDayInput = z.object({
  day_id: uuid,
  day_date: isoDate.optional(),
  label: z.string().trim().max(200).optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateDayInput = z.infer<typeof updateDayInput>

// Shared activity fields, reused by create/bulk/whole-trip schemas.
const itemFields = {
  title: z.string().trim().min(1, 'Title is required').max(300),
  place: z.string().trim().max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  category: itineraryCategory.default('other'),
  start_time: clockTime.optional(),
  end_time: clockTime.optional(),
  end_day_offset: z.number().int().min(0).max(30).optional(),
  transport_mode: z.string().trim().max(60).optional(),
  transport_detail: z.string().trim().max(500).optional(),
  cost: z.number().min(0).max(1e12).optional(),
  currency: currency.optional(),
  booking_url: placeUrl.optional(),
  booking_ref: z.string().trim().max(200).optional(),
  notes: z.string().max(5_000).optional(),
  sort_order: z.number().int().optional(),
}

export const createItemInput = z
  .object({ day_id: uuid.optional(), itinerary_id: uuid.optional(), ...itemFields })
  .refine((v) => Boolean(v.day_id || v.itinerary_id), { message: 'day_id or itinerary_id is required' })
export type CreateItemInput = z.infer<typeof createItemInput>

export const updateItemInput = z.object({
  item_id: uuid,
  title: z.string().trim().min(1).max(300).optional(),
  place: z.string().trim().max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  category: itineraryCategory.optional(),
  start_time: clockTime.optional(),
  end_time: clockTime.optional(),
  end_day_offset: z.number().int().min(0).max(30).optional(),
  transport_mode: z.string().trim().max(60).optional(),
  transport_detail: z.string().trim().max(500).optional(),
  cost: z.number().min(0).max(1e12).optional(),
  currency: currency.optional(),
  booking_url: placeUrl.optional(),
  booking_ref: z.string().trim().max(200).optional(),
  notes: z.string().max(5_000).optional(),
  sort_order: z.number().int().optional(),
  expected_updated_at: z.string().optional(),
})
export type UpdateItemInput = z.infer<typeof updateItemInput>

export const createItemsBulkInput = z.object({
  day_id: uuid,
  items: z.array(z.object(itemFields)).min(1).max(200),
})
export type CreateItemsBulkInput = z.infer<typeof createItemsBulkInput>

/**
 * Whole-trip authoring (nested) — the AI's one-call path (→ create_trip_bulk's
 * jsonb param). Plain shapes (no refine) so it serialises straight to JSON.
 */
export const createTripBulkInput = z.object({
  title: z.string().trim().min(1).max(300),
  destination: z.string().trim().max(300).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  timezone: z.string().trim().max(64).optional(),
  default_currency: currency.optional(),
  notes: z.string().max(20_000).optional(),
  days: z
    .array(
      z.object({
        day_date: isoDate.optional(),
        label: z.string().trim().max(200).optional(),
        sort_order: z.number().int().optional(),
        items: z.array(z.object(itemFields)).max(200).default([]),
      }),
    )
    .max(60)
    .default([]),
})
export type CreateTripBulkInput = z.infer<typeof createTripBulkInput>

// Small itinerary tool inputs (ids + ordering) — used by the worker AI tools.
export const getItineraryInput = z.object({ itinerary_id: uuid })
export const deleteItineraryInput = z.object({ itinerary_id: uuid })
export const deleteDayInput = z.object({ day_id: uuid })
export const deleteItemInput = z.object({ item_id: uuid })
export const reorderDaysInput = z.object({ itinerary_id: uuid, day_ids: z.array(uuid).max(200) })
export const reorderItemsInput = z.object({ day_id: uuid.optional(), item_ids: z.array(uuid).max(500) })
export const setItemLocationInput = z.object({
  item_id: uuid,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
})
export const setItemDayInput = z.object({ item_id: uuid, day_id: uuid.nullable() })
export const createShareLinkInput = z.object({
  itinerary_id: uuid,
  hide_costs: z.boolean().optional(),
  expires_at: z.string().optional(),
})
export const revokeShareLinkInput = z.object({ share_link_id: uuid })
export const listShareLinksInput = z.object({ itinerary_id: uuid })

/**
 * Paste-import payload — what a tool-less conversational AI (ChatGPT/Gemini)
 * emits inside a ```mnema fenced block for the in-app Quick Import. Cards link
 * to notes by TITLE (the AI has no UUIDs); the importer resolves the join.
 */
export const importPayload = z
  .object({
    deck: z.string().trim().min(1).max(120).optional(),
    notes: z
      .array(z.object({ title, body: z.string().max(100_000).default('') }))
      .max(200)
      .default([]),
    cards: z
      .array(z.object({ front: flashcardFace, back: flashcardFace, note: z.string().optional() }))
      .max(200)
      .default([]),
  })
  .refine((p) => p.notes.length > 0 || p.cards.length > 0, {
    message: 'Provide at least one note or card',
  })
export type ImportPayload = z.infer<typeof importPayload>

/** Human-readable descriptions reused as MCP tool descriptions. */
export const toolDescriptions = {
  create_note: 'Create a study note (markdown body). Returns the new note id.',
  update_note: 'Update an existing note’s title and/or body.',
  get_note: 'Fetch one note by id.',
  search_notes: 'Full-text search the user’s notes by keyword.',
  create_deck: 'Create a deck (folder) to organise notes and flashcards.',
  list_decks: 'List the user’s decks.',
  create_flashcard: 'Create one spaced-repetition flashcard (front/back). Schedulable immediately.',
  create_flashcards_bulk: 'Create many flashcards in one call.',
  link_notes: 'Create a typed link between two notes (feeds the knowledge graph).',
  // Travel itineraries
  list_itineraries: 'List the user’s travel trips (itineraries).',
  get_itinerary: 'Fetch one trip as a tree: days, activities, and per-currency cost totals.',
  create_itinerary: 'Create a travel trip. Returns the new trip id.',
  update_itinerary: 'Update a trip’s title, destination, dates, timezone, currency, or notes.',
  delete_itinerary: 'Delete a trip and all its days and activities.',
  create_day: 'Add a day to a trip. Returns the new day id.',
  update_day: 'Update a day’s date, label, or order.',
  delete_day: 'Remove a day from a trip (its activities fall back to Unscheduled).',
  reorder_days: 'Set the order of a trip’s days by passing the day ids in the desired order.',
  create_item:
    'Add one activity to a day (pass day_id) or to the unscheduled bucket (pass itinerary_id). Returns the new activity id.',
  create_items_bulk: 'Add many activities to one day in a single call.',
  create_trip_bulk:
    'Author a whole trip (days + activities) in one call. Returns the full tree with generated ids.',
  update_item: 'Update an activity’s fields (only the fields you pass change).',
  delete_item: 'Delete an activity.',
  set_item_location: 'Set or clear an activity’s map coordinates (pass null to clear).',
  set_item_day: 'Move an activity to another day, or to Unscheduled (day_id = null).',
  reorder_items: 'Set the order of activities within a day by passing the item ids in the desired order.',
  list_share_links: 'List a trip’s public share links.',
  create_share_link:
    'Create a public read-only share link for a trip. Optionally hide costs. Returns a token; the link is /s/<token>.',
  revoke_share_link: 'Revoke a public share link so it can no longer be viewed.',
} as const
