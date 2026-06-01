import { z } from 'zod'
import {
  createDayInput,
  createDeckInput,
  createFlashcardInput,
  createFlashcardsBulkInput,
  createItemInput,
  createItemsBulkInput,
  createItineraryInput,
  createNoteInput,
  createShareLinkInput,
  createTripBulkInput,
  deleteCardInput,
  deleteDayInput,
  deleteDeckInput,
  deleteItemInput,
  deleteItineraryInput,
  deleteNoteInput,
  getItineraryInput,
  getNoteInput,
  linkNotesInput,
  listCardsToolInput,
  listNotesToolInput,
  listShareLinksInput,
  reorderDaysInput,
  reorderItemsInput,
  revokeShareLinkInput,
  searchNotesInput,
  setCardTagsInput,
  setItemDayInput,
  setItemLocationInput,
  setNoteDeckInput,
  setNoteTagsInput,
  toolDescriptions,
  unlinkNotesInput,
  updateCardInput,
  updateDayInput,
  updateDeckInput,
  updateItemInput,
  updateItineraryInput,
  updateNoteInput,
} from '../../shared/schemas'
import { callRpc, ownedSelect, serviceClient } from './db'
import type { ToolContext } from './env'

export interface ToolResult {
  summary: string
  data: unknown
}

export interface ToolDef {
  name: string
  description: string
  schema: z.ZodTypeAny
  readOnly: boolean
  /** Scope a key must carry to call this tool. Undefined ⇒ any valid key (add-only). */
  requiresScope?: 'edit'
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>
}

const noArgs = z.object({})

/**
 * One registry, consumed by BOTH the MCP server and the REST routes. Every entry
 * calls a shared SECURITY DEFINER RPC (or an owner-scoped read) — no tool ever
 * touches a table directly, so AI-added content is identical to UI-added content.
 */
export const tools: ToolDef[] = [
  {
    name: 'create_note',
    description: toolDescriptions.create_note,
    schema: createNoteInput,
    readOnly: false,
    run: async (ctx, a) => {
      const note = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_note', {
        p_title: a.title,
        p_body: a.body ?? '',
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created note “${note.title}” (${note.id})`, data: note }
    },
  },
  {
    name: 'update_note',
    description: toolDescriptions.update_note,
    schema: updateNoteInput,
    readOnly: false,
    requiresScope: 'edit', // mutates existing content — add-only keys may not call this
    run: async (ctx, a) => {
      const note = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'update_note', {
        p_note_id: a.note_id,
        p_title: a.title ?? null,
        p_body: a.body ?? null,
        p_deck_id: a.deck_id ?? null,
      })
      return { summary: `Updated note “${note.title}”`, data: note }
    },
  },
  {
    name: 'get_note',
    description: toolDescriptions.get_note,
    schema: getNoteInput,
    readOnly: true,
    run: async (ctx, a) => {
      const { data, error } = await serviceClient(ctx.env)
        .from('notes')
        .select('id, title, body, deck_id, updated_at')
        .eq('user_id', ctx.userId)
        .eq('id', a.note_id as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('note not found')
      return { summary: `Note “${(data as { title: string }).title}”`, data }
    },
  },
  {
    name: 'search_notes',
    description: toolDescriptions.search_notes,
    schema: searchNotesInput,
    readOnly: true,
    run: async (ctx, a) => {
      const notes = await callRpc<unknown[]>(ctx.env, ctx.userId, 'search_notes', {
        p_query: a.query,
        p_limit: a.limit ?? 20,
      })
      return { summary: `${notes.length} note(s) matched`, data: notes }
    },
  },
  {
    name: 'create_deck',
    description: toolDescriptions.create_deck,
    schema: createDeckInput,
    readOnly: false,
    run: async (ctx, a) => {
      const deck = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_deck', {
        p_name: a.name,
        p_parent_deck_id: a.parent_deck_id ?? null,
        p_description: a.description ?? null,
      })
      return { summary: `Created deck “${deck.name}” (${deck.id})`, data: deck }
    },
  },
  {
    name: 'list_decks',
    description: toolDescriptions.list_decks,
    schema: noArgs,
    readOnly: true,
    run: async (ctx) => {
      const decks = await ownedSelect(ctx.env, ctx.userId, 'decks', 'id, name, description, parent_deck_id')
      return { summary: `${decks.length} deck(s)`, data: decks }
    },
  },
  {
    name: 'create_flashcard',
    description: toolDescriptions.create_flashcard,
    schema: createFlashcardInput,
    readOnly: false,
    run: async (ctx, a) => {
      const card = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_card', {
        p_front: a.front,
        p_back: a.back,
        p_note_id: a.note_id ?? null,
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created flashcard (${card.id}) — due now`, data: card }
    },
  },
  {
    name: 'create_flashcards_bulk',
    description: toolDescriptions.create_flashcards_bulk,
    schema: createFlashcardsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const cards = await callRpc<unknown[]>(ctx.env, ctx.userId, 'create_flashcards_bulk', {
        p_cards: a.cards,
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created ${cards.length} flashcards`, data: cards }
    },
  },
  {
    name: 'link_notes',
    description: toolDescriptions.link_notes,
    schema: linkNotesInput,
    readOnly: false,
    run: async (ctx, a) => {
      const link = await callRpc(ctx.env, ctx.userId, 'link_notes', {
        p_source_note_id: a.source_note_id,
        p_target_note_id: a.target_note_id,
        p_link_type: a.link_type ?? 'reference',
        p_weight: a.weight ?? 1,
      })
      return { summary: `Linked notes (${a.link_type ?? 'reference'})`, data: link }
    },
  },

  // ──────────────────── Notes / cards / decks management ────────────────────
  {
    name: 'list_notes',
    description: toolDescriptions.list_notes,
    schema: listNotesToolInput,
    readOnly: true,
    run: async (ctx, a) => {
      let q = serviceClient(ctx.env)
        .from('notes')
        .select('id, title, deck_id, updated_at')
        .eq('user_id', ctx.userId)
        .order('updated_at', { ascending: false })
        .limit((a.limit as number) ?? 50)
      if (a.deck_id) q = q.eq('deck_id', a.deck_id as string)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown[]
      return { summary: `${rows.length} note(s)`, data: rows }
    },
  },
  {
    name: 'list_cards',
    description: toolDescriptions.list_cards,
    schema: listCardsToolInput,
    readOnly: true,
    run: async (ctx, a) => {
      let q = serviceClient(ctx.env)
        .from('cards')
        .select('id, front, back, deck_id, note_id, tags, state, due')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit((a.limit as number) ?? 50)
      if (a.deck_id) q = q.eq('deck_id', a.deck_id as string)
      if (a.tag) q = q.contains('tags', [a.tag as string])
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown[]
      return { summary: `${rows.length} card(s)`, data: rows }
    },
  },
  {
    name: 'update_card',
    description: toolDescriptions.update_card,
    schema: updateCardInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const card = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'update_card', {
        p_card_id: a.card_id,
        p_front: a.front ?? null,
        p_back: a.back ?? null,
        p_deck_id: a.deck_id ?? null,
        p_note_id: a.note_id ?? null,
      })
      return { summary: `Updated flashcard (${card.id})`, data: card }
    },
  },
  {
    name: 'delete_card',
    description: toolDescriptions.delete_card,
    schema: deleteCardInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_card', { p_card_id: a.card_id })
      return { summary: 'Flashcard deleted', data: { ok: true } }
    },
  },
  {
    name: 'delete_note',
    description: toolDescriptions.delete_note,
    schema: deleteNoteInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_note', { p_note_id: a.note_id })
      return { summary: 'Note deleted', data: { ok: true } }
    },
  },
  {
    name: 'update_deck',
    description: toolDescriptions.update_deck,
    schema: updateDeckInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const deck = await callRpc<{ name: string }>(ctx.env, ctx.userId, 'update_deck', {
        p_deck_id: a.deck_id,
        p_name: a.name ?? null,
        p_description: a.description ?? null,
      })
      return { summary: `Updated deck “${deck.name}”`, data: deck }
    },
  },
  {
    name: 'delete_deck',
    description: toolDescriptions.delete_deck,
    schema: deleteDeckInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_deck', { p_deck_id: a.deck_id })
      return { summary: 'Deck deleted (notes & cards kept)', data: { ok: true } }
    },
  },
  {
    name: 'set_note_deck',
    description: toolDescriptions.set_note_deck,
    schema: setNoteDeckInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const note = await callRpc(ctx.env, ctx.userId, 'set_note_deck', {
        p_note_id: a.note_id,
        p_deck_id: a.deck_id ?? null,
      })
      return { summary: 'Note moved', data: note }
    },
  },
  {
    name: 'set_note_tags',
    description: toolDescriptions.set_note_tags,
    schema: setNoteTagsInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const note = await callRpc(ctx.env, ctx.userId, 'set_note_tags', {
        p_note_id: a.note_id,
        p_tags: a.tags,
      })
      return { summary: 'Note tags updated', data: note }
    },
  },
  {
    name: 'set_card_tags',
    description: toolDescriptions.set_card_tags,
    schema: setCardTagsInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const card = await callRpc(ctx.env, ctx.userId, 'set_card_tags', {
        p_card_id: a.card_id,
        p_tags: a.tags,
      })
      return { summary: 'Card tags updated', data: card }
    },
  },
  {
    name: 'unlink_notes',
    description: toolDescriptions.unlink_notes,
    schema: unlinkNotesInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'unlink_notes', { p_a: a.note_id_a, p_b: a.note_id_b })
      return { summary: 'Notes unlinked', data: { ok: true } }
    },
  },

  // ─────────────────────────── Travel itineraries ───────────────────────────
  {
    name: 'list_itineraries',
    description: toolDescriptions.list_itineraries,
    schema: noArgs,
    readOnly: true,
    run: async (ctx) => {
      const { data, error } = await serviceClient(ctx.env)
        .from('itineraries')
        .select('id, title, destination, start_date, end_date, default_currency, timezone, updated_at')
        .eq('owner_id', ctx.userId)
        .order('start_date', { ascending: false, nullsFirst: false })
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown[]
      return { summary: `${rows.length} trip(s)`, data: rows }
    },
  },
  {
    name: 'get_itinerary',
    description: toolDescriptions.get_itinerary,
    schema: getItineraryInput,
    readOnly: true,
    run: async (ctx, a) => {
      const tree = await callRpc<{ title: string }>(ctx.env, ctx.userId, 'get_itinerary', { p_id: a.itinerary_id })
      return { summary: `Trip “${tree.title}”`, data: tree }
    },
  },
  {
    name: 'create_itinerary',
    description: toolDescriptions.create_itinerary,
    schema: createItineraryInput,
    readOnly: false,
    run: async (ctx, a) => {
      const trip = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_itinerary', {
        p_title: a.title,
        p_destination: a.destination ?? null,
        p_start_date: a.start_date ?? null,
        p_end_date: a.end_date ?? null,
        p_timezone: a.timezone ?? null,
        p_default_currency: a.default_currency ?? null,
        p_cover_url: a.cover_url ?? null,
        p_notes: a.notes ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created trip “${trip.title}” (${trip.id})`, data: trip }
    },
  },
  {
    name: 'create_trip_bulk',
    description: toolDescriptions.create_trip_bulk,
    schema: createTripBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const tree = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_trip_bulk', {
        p_trip: a,
        p_created_via: ctx.via,
      })
      return { summary: `Created trip “${tree.title}” (${tree.id}) with days and activities`, data: tree }
    },
  },
  {
    name: 'update_itinerary',
    description: toolDescriptions.update_itinerary,
    schema: updateItineraryInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const trip = await callRpc<{ title: string }>(ctx.env, ctx.userId, 'update_itinerary', {
        p_itinerary_id: a.itinerary_id,
        p_title: a.title ?? null,
        p_destination: a.destination ?? null,
        p_start_date: a.start_date ?? null,
        p_end_date: a.end_date ?? null,
        p_timezone: a.timezone ?? null,
        p_default_currency: a.default_currency ?? null,
        p_cover_url: a.cover_url ?? null,
        p_notes: a.notes ?? null,
      })
      return { summary: `Updated trip “${trip.title}”`, data: trip }
    },
  },
  {
    name: 'delete_itinerary',
    description: toolDescriptions.delete_itinerary,
    schema: deleteItineraryInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_itinerary', { p_itinerary_id: a.itinerary_id })
      return { summary: 'Trip deleted', data: { ok: true } }
    },
  },
  {
    name: 'create_day',
    description: toolDescriptions.create_day,
    schema: createDayInput,
    readOnly: false,
    run: async (ctx, a) => {
      const day = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_day', {
        p_itinerary_id: a.itinerary_id,
        p_day_date: a.day_date ?? null,
        p_label: a.label ?? null,
        p_sort_order: a.sort_order ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Added day (${day.id})`, data: day }
    },
  },
  {
    name: 'update_day',
    description: toolDescriptions.update_day,
    schema: updateDayInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const day = await callRpc(ctx.env, ctx.userId, 'update_day', {
        p_day_id: a.day_id,
        p_day_date: a.day_date ?? null,
        p_label: a.label ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Day updated', data: day }
    },
  },
  {
    name: 'delete_day',
    description: toolDescriptions.delete_day,
    schema: deleteDayInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_day', { p_day_id: a.day_id })
      return { summary: 'Day removed', data: { ok: true } }
    },
  },
  {
    name: 'reorder_days',
    description: toolDescriptions.reorder_days,
    schema: reorderDaysInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'reorder_days', { p_itinerary_id: a.itinerary_id, p_day_ids: a.day_ids })
      return { summary: 'Days reordered', data: { ok: true } }
    },
  },
  {
    name: 'create_item',
    description: toolDescriptions.create_item,
    schema: createItemInput,
    readOnly: false,
    run: async (ctx, a) => {
      const item = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_item', {
        p_title: a.title,
        p_day_id: a.day_id ?? null,
        p_itinerary_id: a.itinerary_id ?? null,
        p_place: a.place ?? null,
        p_lat: a.lat ?? null,
        p_lng: a.lng ?? null,
        p_category: a.category ?? null,
        p_start_time: a.start_time ?? null,
        p_end_time: a.end_time ?? null,
        p_end_day_offset: a.end_day_offset ?? null,
        p_transport_mode: a.transport_mode ?? null,
        p_transport_detail: a.transport_detail ?? null,
        p_cost: a.cost ?? null,
        p_currency: a.currency ?? null,
        p_booking_url: a.booking_url ?? null,
        p_booking_ref: a.booking_ref ?? null,
        p_notes: a.notes ?? null,
        p_sort_order: a.sort_order ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Added activity “${item.title}” (${item.id})`, data: item }
    },
  },
  {
    name: 'create_items_bulk',
    description: toolDescriptions.create_items_bulk,
    schema: createItemsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const items = await callRpc<unknown[]>(ctx.env, ctx.userId, 'create_items_bulk', {
        p_day_id: a.day_id,
        p_items: a.items,
      })
      return { summary: `Added ${items.length} activities`, data: items }
    },
  },
  {
    name: 'update_item',
    description: toolDescriptions.update_item,
    schema: updateItemInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const item = await callRpc<{ title: string }>(ctx.env, ctx.userId, 'update_item', {
        p_item_id: a.item_id,
        p_title: a.title ?? null,
        p_place: a.place ?? null,
        p_lat: a.lat ?? null,
        p_lng: a.lng ?? null,
        p_category: a.category ?? null,
        p_start_time: a.start_time ?? null,
        p_end_time: a.end_time ?? null,
        p_end_day_offset: a.end_day_offset ?? null,
        p_transport_mode: a.transport_mode ?? null,
        p_transport_detail: a.transport_detail ?? null,
        p_cost: a.cost ?? null,
        p_currency: a.currency ?? null,
        p_booking_url: a.booking_url ?? null,
        p_booking_ref: a.booking_ref ?? null,
        p_notes: a.notes ?? null,
        p_sort_order: a.sort_order ?? null,
        p_expected_updated_at: a.expected_updated_at ?? null,
      })
      return { summary: `Updated activity “${item.title}”`, data: item }
    },
  },
  {
    name: 'delete_item',
    description: toolDescriptions.delete_item,
    schema: deleteItemInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_item', { p_item_id: a.item_id })
      return { summary: 'Activity deleted', data: { ok: true } }
    },
  },
  {
    name: 'set_item_location',
    description: toolDescriptions.set_item_location,
    schema: setItemLocationInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const item = await callRpc(ctx.env, ctx.userId, 'set_item_location', {
        p_item_id: a.item_id,
        p_lat: a.lat,
        p_lng: a.lng,
      })
      return { summary: 'Location set', data: item }
    },
  },
  {
    name: 'set_item_day',
    description: toolDescriptions.set_item_day,
    schema: setItemDayInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const item = await callRpc(ctx.env, ctx.userId, 'set_item_day', {
        p_item_id: a.item_id,
        p_day_id: a.day_id,
      })
      return { summary: 'Activity moved', data: item }
    },
  },
  {
    name: 'reorder_items',
    description: toolDescriptions.reorder_items,
    schema: reorderItemsInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'reorder_items', { p_day_id: a.day_id ?? null, p_item_ids: a.item_ids })
      return { summary: 'Activities reordered', data: { ok: true } }
    },
  },
  {
    name: 'list_share_links',
    description: toolDescriptions.list_share_links,
    schema: listShareLinksInput,
    readOnly: true,
    run: async (ctx, a) => {
      const links = await callRpc<unknown[]>(ctx.env, ctx.userId, 'list_share_links', {
        p_itinerary_id: a.itinerary_id,
      })
      return { summary: `${links.length} share link(s)`, data: links }
    },
  },
  {
    name: 'create_share_link',
    description: toolDescriptions.create_share_link,
    schema: createShareLinkInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const link = await callRpc<{ token: string }>(ctx.env, ctx.userId, 'create_share_link', {
        p_itinerary_id: a.itinerary_id,
        p_hide_costs: a.hide_costs ?? false,
        p_expires_at: a.expires_at ?? null,
      })
      return { summary: `Created share link (/s/${link.token})`, data: link }
    },
  },
  {
    name: 'revoke_share_link',
    description: toolDescriptions.revoke_share_link,
    schema: revokeShareLinkInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'revoke_share_link', { p_id: a.share_link_id })
      return { summary: 'Share link revoked', data: { ok: true } }
    },
  },
]

export const toolByName = new Map(tools.map((t) => [t.name, t]))

/**
 * Add-only keys lack the 'edit' scope, so they can create + read but never call
 * a mutating tool. Returns true if a key with `scopes` may run `tool`.
 */
export function toolAllowed(tool: ToolDef, scopes: string[]): boolean {
  return tool.requiresScope ? scopes.includes(tool.requiresScope) : true
}
