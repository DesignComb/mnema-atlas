import { z } from 'zod'
import {
  createDayInput,
  createDeckInput,
  createFlashcardInput,
  createFlashcardsBulkInput,
  createItemInput,
  createBookingInput,
  createBookingsBulkInput,
  createChecklistBulkInput,
  createChecklistInput,
  createItemsBulkInput,
  createItineraryInput,
  createNoteInput,
  createShareLinkInput,
  createTripBulkInput,
  deleteBookingInput,
  deleteCardInput,
  deleteChecklistInput,
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
  setItemAssigneesInput,
  setItemDayInput,
  setItemLocationInput,
  setItemStatusInput,
  setNoteDeckInput,
  setNoteTagsInput,
  toolDescriptions,
  unlinkNotesInput,
  updateBookingInput,
  updateCardInput,
  updateChecklistInput,
  updateDayInput,
  updateDeckInput,
  updateItemInput,
  updateItineraryInput,
  updateNoteInput,
  // Mnema Tempo
  addReminderInput,
  checkInInput,
  completeTaskInput,
  createTaskInput,
  createTaskListInput,
  createTasksBulkInput,
  deleteTaskInput,
  deleteTaskListInput,
  getHabitInput,
  getStreakInput,
  getTaskInput,
  listTasksInput,
  moveTaskInput,
  removeReminderInput,
  reorderTaskListsInput,
  reorderTasksInput,
  scheduleTaskInput,
  searchTasksInput,
  setRecurrenceInput,
  snoozeTaskInput,
  suggestRecurringTasksInput,
  uncheckInInput,
  uncompleteTaskInput,
  updateTaskInput,
  updateTaskListInput,
  // Mnema Galleon
  createAccountInput,
  addLedgerMemberInput,
  createCategoryInput,
  createLedgerInput,
  createSplitExpenseInput,
  createTransactionInput,
  createTransactionsBulkInput,
  createTransferInput,
  deleteAccountInput,
  deleteBudgetInput,
  deleteCategoryInput,
  deleteLedgerInput,
  deleteRecurringTransactionInput,
  deleteSettlementInput,
  deleteTransactionInput,
  getBalancesInput,
  getBudgetStatusInput,
  getLedgerInput,
  getLedgerSummaryInput,
  getMonthlyTrendInput,
  getTransactionInput,
  listLedgerMembersInput,
  listRecurringInput,
  listSettlementsInput,
  listSplitTxnIdsInput,
  listTransactionsInput,
  recordSettlementInput,
  removeLedgerMemberInput,
  searchTransactionsInput,
  setBudgetInput,
  setRecurringTransactionInput,
  setTransactionSplitsInput,
  suggestSettlementInput,
  updateAccountInput,
  updateCategoryInput,
  updateLedgerInput,
  updateLedgerMemberInput,
  updateTransactionInput,
} from '../../shared/schemas'
import { settleUp, type MemberBalance } from '../../shared/settle'
import { callRpc, ownedSelect, serviceClient } from './db'
import { computeOccurrence, todayISO } from './recurrence'
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
      if (Array.isArray(a.tags) && a.tags.length) {
        await callRpc(ctx.env, ctx.userId, 'set_note_tags', { p_note_id: note.id, p_tags: a.tags })
      }
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
      if (a.tags !== undefined) {
        await callRpc(ctx.env, ctx.userId, 'set_note_tags', { p_note_id: a.note_id, p_tags: a.tags ?? [] })
      }
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
      if (Array.isArray(a.tags) && a.tags.length) {
        await callRpc(ctx.env, ctx.userId, 'set_card_tags', { p_card_id: card.id, p_tags: a.tags })
      }
      return { summary: `Created flashcard (${card.id}) — due now`, data: card }
    },
  },
  {
    name: 'create_flashcards_bulk',
    description: toolDescriptions.create_flashcards_bulk,
    schema: createFlashcardsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const cards = await callRpc<Array<{ id: string }>>(ctx.env, ctx.userId, 'create_flashcards_bulk', {
        p_cards: a.cards,
        p_deck_id: a.deck_id ?? null,
        p_created_via: ctx.via,
      })
      // Apply per-card tags (bulk RPC returns rows in input order).
      const inputs = (a.cards as Array<{ tags?: string[] }>) ?? []
      for (let i = 0; i < cards.length; i++) {
        const tags = inputs[i]?.tags
        if (Array.isArray(tags) && tags.length) {
          await callRpc(ctx.env, ctx.userId, 'set_card_tags', { p_card_id: cards[i].id, p_tags: tags })
        }
      }
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
      if (a.tags !== undefined) {
        await callRpc(ctx.env, ctx.userId, 'set_card_tags', { p_card_id: a.card_id, p_tags: a.tags ?? [] })
      }
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
        p_travelers: a.travelers ?? null,
        p_budget_total: a.budget_total ?? null,
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
    name: 'set_item_status',
    description: toolDescriptions.set_item_status,
    schema: setItemStatusInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const item = await callRpc(ctx.env, ctx.userId, 'set_item_status', { p_item_id: a.item_id, p_status: a.status })
      return { summary: `Activity marked ${a.status}`, data: item }
    },
  },
  {
    name: 'set_item_assignees',
    description: toolDescriptions.set_item_assignees,
    schema: setItemAssigneesInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const item = await callRpc(ctx.env, ctx.userId, 'set_item_assignees', {
        p_item_id: a.item_id,
        p_assignees: a.assignees,
      })
      return { summary: 'Activity assignees set', data: item }
    },
  },
  {
    name: 'create_booking',
    description: toolDescriptions.create_booking,
    schema: createBookingInput,
    readOnly: false,
    run: async (ctx, a) => {
      const b = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_booking', {
        p_itinerary_id: a.itinerary_id,
        p_type: a.type ?? null,
        p_title: a.title,
        p_start_at: a.start_at ?? null,
        p_end_at: a.end_at ?? null,
        p_from_label: a.from_label ?? null,
        p_to_label: a.to_label ?? null,
        p_location: a.location ?? null,
        p_confirmation: a.confirmation ?? null,
        p_cost: a.cost ?? null,
        p_currency: a.currency ?? null,
        p_url: a.url ?? null,
        p_notes: a.notes ?? null,
        p_sort_order: a.sort_order ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Added reservation “${b.title}” (${b.id})`, data: b }
    },
  },
  {
    name: 'create_bookings_bulk',
    description: toolDescriptions.create_bookings_bulk,
    schema: createBookingsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const rows = await callRpc<unknown[]>(ctx.env, ctx.userId, 'create_bookings_bulk', {
        p_itinerary_id: a.itinerary_id,
        p_bookings: a.bookings,
      })
      return { summary: `Added ${rows.length} reservations`, data: rows }
    },
  },
  {
    name: 'update_booking',
    description: toolDescriptions.update_booking,
    schema: updateBookingInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const b = await callRpc(ctx.env, ctx.userId, 'update_booking', {
        p_booking_id: a.booking_id,
        p_type: a.type ?? null,
        p_title: a.title ?? null,
        p_start_at: a.start_at ?? null,
        p_end_at: a.end_at ?? null,
        p_from_label: a.from_label ?? null,
        p_to_label: a.to_label ?? null,
        p_location: a.location ?? null,
        p_confirmation: a.confirmation ?? null,
        p_cost: a.cost ?? null,
        p_currency: a.currency ?? null,
        p_url: a.url ?? null,
        p_notes: a.notes ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Reservation updated', data: b }
    },
  },
  {
    name: 'delete_booking',
    description: toolDescriptions.delete_booking,
    schema: deleteBookingInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_booking', { p_booking_id: a.booking_id })
      return { summary: 'Reservation deleted', data: { ok: true } }
    },
  },
  {
    name: 'create_checklist_item',
    description: toolDescriptions.create_checklist_item,
    schema: createChecklistInput,
    readOnly: false,
    run: async (ctx, a) => {
      const c = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_checklist_item', {
        p_itinerary_id: a.itinerary_id,
        p_kind: a.kind ?? null,
        p_text: a.text,
        p_category: a.category ?? null,
        p_assignee: a.assignee ?? null,
        p_sort_order: a.sort_order ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Added ${a.kind ?? 'todo'} item (${c.id})`, data: c }
    },
  },
  {
    name: 'create_checklist_bulk',
    description: toolDescriptions.create_checklist_bulk,
    schema: createChecklistBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const rows = await callRpc<unknown[]>(ctx.env, ctx.userId, 'create_checklist_bulk', {
        p_itinerary_id: a.itinerary_id,
        p_items: a.items,
      })
      return { summary: `Added ${rows.length} checklist items`, data: rows }
    },
  },
  {
    name: 'update_checklist_item',
    description: toolDescriptions.update_checklist_item,
    schema: updateChecklistInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const c = await callRpc(ctx.env, ctx.userId, 'update_checklist_item', {
        p_item_id: a.item_id,
        p_text: a.text ?? null,
        p_category: a.category ?? null,
        p_done: a.done ?? null,
        p_assignee: a.assignee ?? null,
        p_kind: a.kind ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Checklist item updated', data: c }
    },
  },
  {
    name: 'delete_checklist_item',
    description: toolDescriptions.delete_checklist_item,
    schema: deleteChecklistInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_checklist_item', { p_item_id: a.item_id })
      return { summary: 'Checklist item deleted', data: { ok: true } }
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

  // ── Mnema Tempo: lists ──
  {
    name: 'create_task_list',
    description: toolDescriptions.create_task_list,
    schema: createTaskListInput,
    readOnly: false,
    run: async (ctx, a) => {
      const list = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_task_list', {
        p_name: a.name,
        p_kind: a.kind ?? 'list',
        p_color: a.color ?? null,
        p_icon: a.icon ?? null,
        p_sort_order: a.sort_order ?? 0,
        p_created_via: ctx.via,
      })
      return { summary: `Created list “${list.name}” (${list.id})`, data: list }
    },
  },
  {
    name: 'update_task_list',
    description: toolDescriptions.update_task_list,
    schema: updateTaskListInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const list = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'update_task_list', {
        p_list_id: a.list_id,
        p_name: a.name ?? null,
        p_kind: a.kind ?? null,
        p_color: a.color ?? null,
        p_icon: a.icon ?? null,
        p_is_archived: a.is_archived ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: `Updated list “${list.name}”`, data: list }
    },
  },
  {
    name: 'delete_task_list',
    description: toolDescriptions.delete_task_list,
    schema: deleteTaskListInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_task_list', { p_list_id: a.list_id })
      return { summary: 'List deleted', data: { ok: true } }
    },
  },
  {
    name: 'reorder_task_lists',
    description: toolDescriptions.reorder_task_lists,
    schema: reorderTaskListsInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'reorder_task_lists', { p_list_ids: a.list_ids })
      return { summary: 'Lists reordered', data: { ok: true } }
    },
  },
  {
    name: 'list_task_lists',
    description: toolDescriptions.list_task_lists,
    schema: noArgs,
    readOnly: true,
    run: async (ctx) => {
      const lists = await ownedSelect(ctx.env, ctx.userId, 'task_lists', 'id, name, kind, color, icon, sort_order, is_archived')
      return { summary: `${lists.length} list(s)`, data: lists }
    },
  },

  // ── Mnema Tempo: tasks ──
  {
    name: 'create_task',
    description: toolDescriptions.create_task,
    schema: createTaskInput,
    readOnly: false,
    run: async (ctx, a) => {
      const rule = (a.recurrence_rule as string | undefined) ?? null
      let nextOcc = (a.next_occurrence as string | undefined) ?? null
      if (rule && !nextOcc) {
        const anchor =
          (a.recurrence_anchor as string) || (a.scheduled_date as string) || (a.due_date as string) || todayISO()
        nextOcc = computeOccurrence(rule, anchor, true)
      }
      const task = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'create_task', {
        p_title: a.title,
        p_list_id: a.list_id ?? null,
        p_parent_task_id: a.parent_task_id ?? null,
        p_description: a.description ?? null,
        p_priority: a.priority ?? 0,
        p_labels: a.labels ?? [],
        p_scheduled_date: a.scheduled_date ?? null,
        p_scheduled_time: a.scheduled_time ?? null,
        p_due_date: a.due_date ?? null,
        p_due_time: a.due_time ?? null,
        p_duration_min: a.duration_min ?? null,
        p_kind: a.kind ?? 'task',
        p_recurrence_rule: rule,
        p_recurrence_after_completion: a.recurrence_after_completion ?? false,
        p_recurrence_anchor: a.recurrence_anchor ?? null,
        p_next_occurrence: nextOcc,
        p_tz: a.tz ?? null,
        p_sort_order: a.sort_order ?? 0,
        p_created_via: ctx.via,
      })
      return { summary: `Created task “${task.title}” (${task.id})`, data: task }
    },
  },
  {
    name: 'create_tasks_bulk',
    description: toolDescriptions.create_tasks_bulk,
    schema: createTasksBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const tasks = await callRpc<Array<{ id: string }>>(ctx.env, ctx.userId, 'create_tasks_bulk', { p_tasks: a.tasks })
      return { summary: `Created ${tasks.length} task(s)`, data: tasks }
    },
  },
  {
    name: 'update_task',
    description: toolDescriptions.update_task,
    schema: updateTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc<{ id: string; title: string }>(ctx.env, ctx.userId, 'update_task', {
        p_task_id: a.task_id,
        p_title: a.title ?? null,
        p_description: a.description ?? null,
        p_list_id: a.list_id ?? null,
        p_priority: a.priority ?? null,
        p_labels: a.labels ?? null,
        p_due_date: a.due_date ?? null,
        p_due_time: a.due_time ?? null,
        p_status: a.status ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: `Updated task “${task.title}”`, data: task }
    },
  },
  {
    name: 'complete_task',
    description: toolDescriptions.complete_task,
    schema: completeTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      // Compute the precise next occurrence (full RRULE) unless the caller supplied one.
      let nextOcc = (a.next_occurrence as string | undefined) ?? null
      if (!nextOcc) {
        const { data } = await serviceClient(ctx.env)
          .from('tasks')
          .select('recurrence_rule, recurrence_after_completion, next_occurrence, due_date, scheduled_date, kind')
          .eq('user_id', ctx.userId)
          .eq('id', a.task_id as string)
          .maybeSingle()
        const tk = data as {
          recurrence_rule: string | null
          recurrence_after_completion: boolean
          next_occurrence: string | null
          due_date: string | null
          scheduled_date: string | null
          kind: string
        } | null
        if (tk?.recurrence_rule && tk.kind !== 'habit') {
          const base = tk.recurrence_after_completion
            ? todayISO()
            : tk.next_occurrence || tk.due_date || tk.scheduled_date || todayISO()
          nextOcc = computeOccurrence(tk.recurrence_rule, base, false)
        }
      }
      const task = await callRpc<{ id: string; status: string; next_occurrence: string | null }>(
        ctx.env,
        ctx.userId,
        'complete_task',
        {
          p_task_id: a.task_id,
          p_completed_at: a.completed_at ?? undefined,
          p_next_occurrence: nextOcc ?? undefined,
        },
      )
      return { summary: task.next_occurrence ? `Completed; next on ${task.next_occurrence}` : 'Task completed', data: task }
    },
  },
  {
    name: 'uncomplete_task',
    description: toolDescriptions.uncomplete_task,
    schema: uncompleteTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'uncomplete_task', { p_task_id: a.task_id })
      return { summary: 'Task reopened', data: task }
    },
  },
  {
    name: 'delete_task',
    description: toolDescriptions.delete_task,
    schema: deleteTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_task', { p_task_id: a.task_id })
      return { summary: 'Task deleted', data: { ok: true } }
    },
  },
  {
    name: 'move_task',
    description: toolDescriptions.move_task,
    schema: moveTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'move_task', {
        p_task_id: a.task_id,
        p_list_id: a.list_id ?? null,
        p_parent_task_id: a.parent_task_id ?? null,
      })
      return { summary: 'Task moved', data: task }
    },
  },
  {
    name: 'reorder_tasks',
    description: toolDescriptions.reorder_tasks,
    schema: reorderTasksInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'reorder_tasks', { p_list_id: a.list_id ?? null, p_task_ids: a.task_ids })
      return { summary: 'Tasks reordered', data: { ok: true } }
    },
  },
  {
    name: 'set_recurrence',
    description: toolDescriptions.set_recurrence,
    schema: setRecurrenceInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      let nextOcc = (a.next_occurrence as string | undefined) ?? null
      if (!nextOcc) {
        const anchor = (a.recurrence_anchor as string) || todayISO()
        nextOcc = computeOccurrence(a.recurrence_rule as string, anchor, true)
      }
      const task = await callRpc(ctx.env, ctx.userId, 'set_recurrence', {
        p_task_id: a.task_id,
        p_recurrence_rule: a.recurrence_rule,
        p_recurrence_after_completion: a.recurrence_after_completion ?? false,
        p_recurrence_anchor: a.recurrence_anchor ?? null,
        p_next_occurrence: nextOcc,
      })
      return { summary: 'Recurrence set', data: task }
    },
  },
  {
    name: 'schedule_task',
    description: toolDescriptions.schedule_task,
    schema: scheduleTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'schedule_task', {
        p_task_id: a.task_id,
        p_scheduled_date: a.scheduled_date ?? null,
        p_scheduled_time: a.scheduled_time ?? null,
        p_due_date: a.due_date ?? null,
        p_due_time: a.due_time ?? null,
        p_duration_min: a.duration_min ?? null,
      })
      return { summary: 'Task scheduled', data: task }
    },
  },
  {
    name: 'snooze_task',
    description: toolDescriptions.snooze_task,
    schema: snoozeTaskInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'snooze_task', {
        p_task_id: a.task_id,
        p_until: a.until,
        p_until_time: a.until_time ?? undefined,
      })
      return { summary: `Snoozed to ${a.until}`, data: task }
    },
  },

  // ── Mnema Tempo: habits ──
  {
    name: 'check_in',
    description: toolDescriptions.check_in,
    schema: checkInInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc<{ current_streak: number }>(ctx.env, ctx.userId, 'check_in', {
        p_task_id: a.task_id,
        p_checkin_date: a.checkin_date ?? undefined,
        p_note: a.note ?? null,
      })
      return { summary: `Checked in — streak ${task.current_streak}`, data: task }
    },
  },
  {
    name: 'uncheck_in',
    description: toolDescriptions.uncheck_in,
    schema: uncheckInInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'uncheck_in', {
        p_task_id: a.task_id,
        p_checkin_date: a.checkin_date ?? undefined,
      })
      return { summary: 'Check-in removed', data: task }
    },
  },

  // ── Mnema Tempo: reminders ──
  {
    name: 'add_reminder',
    description: toolDescriptions.add_reminder,
    schema: addReminderInput,
    readOnly: false,
    run: async (ctx, a) => {
      const r = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'add_reminder', {
        p_task_id: a.task_id,
        p_remind_at: a.remind_at,
        p_offset_min: a.offset_min ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Reminder set (${r.id})`, data: r }
    },
  },
  {
    name: 'remove_reminder',
    description: toolDescriptions.remove_reminder,
    schema: removeReminderInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'remove_reminder', { p_reminder_id: a.reminder_id })
      return { summary: 'Reminder removed', data: { ok: true } }
    },
  },

  // ── Mnema Tempo: reads ──
  {
    name: 'get_task',
    description: toolDescriptions.get_task,
    schema: getTaskInput,
    readOnly: true,
    run: async (ctx, a) => {
      const task = await callRpc(ctx.env, ctx.userId, 'get_task', { p_task_id: a.task_id })
      return { summary: 'Task', data: task }
    },
  },
  {
    name: 'list_tasks',
    description: toolDescriptions.list_tasks,
    schema: listTasksInput,
    readOnly: true,
    run: async (ctx, a) => {
      const tasks = await callRpc<unknown[]>(ctx.env, ctx.userId, 'list_tasks', {
        p_list_id: a.list_id ?? null,
        p_status: a.status ?? undefined,
        p_kind: a.kind ?? null,
        p_label: a.label ?? null,
        p_due_before: a.due_before ?? null,
        p_scheduled_on: a.scheduled_on ?? null,
        p_include_subtasks: a.include_subtasks ?? false,
        p_limit: a.limit ?? 100,
      })
      return { summary: `${tasks.length} task(s)`, data: tasks }
    },
  },
  {
    name: 'search_tasks',
    description: toolDescriptions.search_tasks,
    schema: searchTasksInput,
    readOnly: true,
    run: async (ctx, a) => {
      const tasks = await callRpc<unknown[]>(ctx.env, ctx.userId, 'search_tasks', {
        p_query: a.query,
        p_limit: a.limit ?? 50,
      })
      return { summary: `${tasks.length} task(s) matched`, data: tasks }
    },
  },
  {
    name: 'get_habit',
    description: toolDescriptions.get_habit,
    schema: getHabitInput,
    readOnly: true,
    run: async (ctx, a) => {
      const habit = await callRpc(ctx.env, ctx.userId, 'get_habit', { p_task_id: a.task_id })
      return { summary: 'Habit', data: habit }
    },
  },
  {
    name: 'get_streak',
    description: toolDescriptions.get_streak,
    schema: getStreakInput,
    readOnly: true,
    run: async (ctx, a) => {
      const streak = await callRpc(ctx.env, ctx.userId, 'get_streak', { p_task_id: a.task_id })
      return { summary: 'Streak', data: streak }
    },
  },
  {
    name: 'suggest_recurring_tasks',
    description: toolDescriptions.suggest_recurring_tasks,
    schema: suggestRecurringTasksInput,
    readOnly: true,
    run: async (ctx, a) => {
      const clusters = await callRpc<unknown[]>(ctx.env, ctx.userId, 'suggest_recurring_tasks', {
        p_lookback_days: a.lookback_days ?? 90,
        p_min_count: a.min_count ?? 3,
      })
      return { summary: `${clusters.length} suggestion(s)`, data: clusters }
    },
  },

  // ── Mnema Galleon: ledgers ──
  {
    name: 'create_ledger',
    description: toolDescriptions.create_ledger,
    schema: createLedgerInput,
    readOnly: false,
    run: async (ctx, a) => {
      const l = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_ledger', {
        p_name: a.name,
        p_base_currency: a.base_currency ?? null,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Created ledger “${l.name}” (${l.id})`, data: l }
    },
  },
  {
    name: 'update_ledger',
    description: toolDescriptions.update_ledger,
    schema: updateLedgerInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const l = await callRpc(ctx.env, ctx.userId, 'update_ledger', {
        p_ledger_id: a.ledger_id,
        p_name: a.name ?? null,
        p_base_currency: a.base_currency ?? null,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_is_archived: a.is_archived ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Ledger updated', data: l }
    },
  },
  {
    name: 'delete_ledger',
    description: toolDescriptions.delete_ledger,
    schema: deleteLedgerInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_ledger', { p_ledger_id: a.ledger_id })
      return { summary: 'Ledger deleted', data: { ok: true } }
    },
  },
  {
    name: 'list_ledgers',
    description: toolDescriptions.list_ledgers,
    schema: noArgs,
    readOnly: true,
    run: async (ctx) => {
      const { data, error } = await serviceClient(ctx.env)
        .from('ledgers')
        .select('id, name, base_currency, icon, color, is_archived')
        .eq('owner_id', ctx.userId)
        .order('sort_order')
      if (error) throw new Error(error.message)
      return { summary: `${(data ?? []).length} ledger(s)`, data }
    },
  },
  {
    name: 'get_ledger',
    description: toolDescriptions.get_ledger,
    schema: getLedgerInput,
    readOnly: true,
    run: async (ctx, a) => {
      const l = await callRpc(ctx.env, ctx.userId, 'get_ledger', { p_ledger_id: a.ledger_id })
      return { summary: 'Ledger', data: l }
    },
  },

  // ── Mnema Galleon: accounts ──
  {
    name: 'create_account',
    description: toolDescriptions.create_account,
    schema: createAccountInput,
    readOnly: false,
    run: async (ctx, a) => {
      const acc = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_account', {
        p_ledger_id: a.ledger_id,
        p_name: a.name,
        p_type: a.type ?? 'cash',
        p_currency: a.currency ?? null,
        p_opening_balance: a.opening_balance ?? 0,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_sort_order: a.sort_order ?? 0,
        p_created_via: ctx.via,
      })
      return { summary: `Created account “${acc.name}” (${acc.id})`, data: acc }
    },
  },
  {
    name: 'update_account',
    description: toolDescriptions.update_account,
    schema: updateAccountInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const acc = await callRpc(ctx.env, ctx.userId, 'update_account', {
        p_account_id: a.account_id,
        p_name: a.name ?? null,
        p_type: a.type ?? null,
        p_currency: a.currency ?? null,
        p_opening_balance: a.opening_balance ?? null,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_is_archived: a.is_archived ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Account updated', data: acc }
    },
  },
  {
    name: 'delete_account',
    description: toolDescriptions.delete_account,
    schema: deleteAccountInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_account', {
        p_account_id: a.account_id,
        p_reassign_to_account_id: a.reassign_to_account_id ?? null,
      })
      return { summary: 'Account deleted', data: { ok: true } }
    },
  },

  // ── Mnema Galleon: categories ──
  {
    name: 'create_category',
    description: toolDescriptions.create_category,
    schema: createCategoryInput,
    readOnly: false,
    run: async (ctx, a) => {
      const c = await callRpc<{ id: string; name: string }>(ctx.env, ctx.userId, 'create_category', {
        p_ledger_id: a.ledger_id,
        p_name: a.name,
        p_kind: a.kind,
        p_parent_id: a.parent_id ?? null,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_sort_order: a.sort_order ?? 0,
        p_created_via: ctx.via,
      })
      return { summary: `Created category “${c.name}”`, data: c }
    },
  },
  {
    name: 'update_category',
    description: toolDescriptions.update_category,
    schema: updateCategoryInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const c = await callRpc(ctx.env, ctx.userId, 'update_category', {
        p_category_id: a.category_id,
        p_name: a.name ?? null,
        p_kind: a.kind ?? null,
        p_parent_id: a.parent_id ?? null,
        p_icon: a.icon ?? null,
        p_color: a.color ?? null,
        p_sort_order: a.sort_order ?? null,
      })
      return { summary: 'Category updated', data: c }
    },
  },
  {
    name: 'delete_category',
    description: toolDescriptions.delete_category,
    schema: deleteCategoryInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_category', { p_category_id: a.category_id })
      return { summary: 'Category deleted', data: { ok: true } }
    },
  },

  // ── Mnema Galleon: transactions ──
  {
    name: 'create_transaction',
    description: toolDescriptions.create_transaction,
    schema: createTransactionInput,
    readOnly: false,
    run: async (ctx, a) => {
      const tx = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_transaction', {
        p_ledger_id: a.ledger_id,
        p_type: a.type,
        p_amount: a.amount,
        p_account_id: a.account_id ?? null,
        p_category_id: a.category_id ?? null,
        p_transfer_account_id: a.transfer_account_id ?? null,
        p_currency: a.currency ?? null,
        p_fx_rate: a.fx_rate ?? 1,
        p_payee: a.payee ?? null,
        p_note: a.note ?? null,
        p_txn_date: a.txn_date ?? null,
        p_tags: a.tags ?? [],
        p_receipt_url: a.receipt_url ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Logged ${a.type} ${a.amount} (${tx.id})`, data: tx }
    },
  },
  {
    name: 'create_transactions_bulk',
    description: toolDescriptions.create_transactions_bulk,
    schema: createTransactionsBulkInput,
    readOnly: false,
    run: async (ctx, a) => {
      const rows = await callRpc<Array<{ id: string }>>(ctx.env, ctx.userId, 'create_transactions_bulk', {
        p_ledger_id: a.ledger_id,
        p_transactions: a.transactions,
      })
      return { summary: `Logged ${rows.length} transaction(s)`, data: rows }
    },
  },
  {
    name: 'create_transfer',
    description: toolDescriptions.create_transfer,
    schema: createTransferInput,
    readOnly: false,
    run: async (ctx, a) => {
      const tx = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'create_transaction', {
        p_ledger_id: a.ledger_id,
        p_type: 'transfer',
        p_amount: a.amount,
        p_account_id: a.from_account_id,
        p_transfer_account_id: a.to_account_id,
        p_note: a.note ?? null,
        p_txn_date: a.txn_date ?? null,
        p_created_via: ctx.via,
      })
      return { summary: `Transferred ${a.amount}`, data: tx }
    },
  },
  {
    name: 'update_transaction',
    description: toolDescriptions.update_transaction,
    schema: updateTransactionInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const tx = await callRpc(ctx.env, ctx.userId, 'update_transaction', {
        p_transaction_id: a.transaction_id,
        p_amount: a.amount ?? null,
        p_type: a.type ?? null,
        p_account_id: a.account_id ?? null,
        p_category_id: a.category_id ?? null,
        p_transfer_account_id: a.transfer_account_id ?? null,
        p_payee: a.payee ?? null,
        p_note: a.note ?? null,
        p_txn_date: a.txn_date ?? null,
        p_tags: a.tags ?? null,
        p_receipt_url: a.receipt_url ?? null,
      })
      return { summary: 'Transaction updated', data: tx }
    },
  },
  {
    name: 'delete_transaction',
    description: toolDescriptions.delete_transaction,
    schema: deleteTransactionInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_transaction', { p_transaction_id: a.transaction_id })
      return { summary: 'Transaction deleted', data: { ok: true } }
    },
  },
  {
    name: 'list_transactions',
    description: toolDescriptions.list_transactions,
    schema: listTransactionsInput,
    readOnly: true,
    run: async (ctx, a) => {
      const rows = await callRpc<unknown[]>(ctx.env, ctx.userId, 'list_transactions', {
        p_ledger_id: a.ledger_id,
        p_account_id: a.account_id ?? null,
        p_category_id: a.category_id ?? null,
        p_type: a.type ?? null,
        p_from: a.from ?? null,
        p_to: a.to ?? null,
        p_limit: a.limit ?? 100,
      })
      return { summary: `${rows.length} transaction(s)`, data: rows }
    },
  },
  {
    name: 'search_transactions',
    description: toolDescriptions.search_transactions,
    schema: searchTransactionsInput,
    readOnly: true,
    run: async (ctx, a) => {
      const rows = await callRpc<unknown[]>(ctx.env, ctx.userId, 'search_transactions', {
        p_ledger_id: a.ledger_id,
        p_query: a.query,
        p_limit: a.limit ?? 50,
      })
      return { summary: `${rows.length} matched`, data: rows }
    },
  },
  {
    name: 'get_ledger_summary',
    description: toolDescriptions.get_ledger_summary,
    schema: getLedgerSummaryInput,
    readOnly: true,
    run: async (ctx, a) => {
      const s = await callRpc(ctx.env, ctx.userId, 'get_ledger_summary', {
        p_ledger_id: a.ledger_id,
        p_from: a.from,
        p_to: a.to,
      })
      return { summary: 'Summary', data: s }
    },
  },

  // ── Mnema Galleon: budgets / recurring / reports ──
  {
    name: 'set_budget',
    description: toolDescriptions.set_budget,
    schema: setBudgetInput,
    readOnly: false,
    requiresScope: 'edit', // upsert: can overwrite an existing budget, so not add-only
    run: async (ctx, a) => {
      const b = await callRpc(ctx.env, ctx.userId, 'set_budget', {
        p_ledger_id: a.ledger_id,
        p_category_id: a.category_id ?? null,
        p_amount: a.amount,
        p_period: a.period ?? 'monthly',
        p_rollover: a.rollover ?? false,
      })
      return { summary: 'Budget set', data: b }
    },
  },
  {
    name: 'delete_budget',
    description: toolDescriptions.delete_budget,
    schema: deleteBudgetInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_budget', { p_budget_id: a.budget_id })
      return { summary: 'Budget removed', data: { ok: true } }
    },
  },
  {
    name: 'get_budget_status',
    description: toolDescriptions.get_budget_status,
    schema: getBudgetStatusInput,
    readOnly: true,
    run: async (ctx, a) => {
      const s = await callRpc(ctx.env, ctx.userId, 'get_budget_status', { p_ledger_id: a.ledger_id, p_from: a.from, p_to: a.to })
      return { summary: 'Budget status', data: s }
    },
  },
  {
    name: 'set_recurring_transaction',
    description: toolDescriptions.set_recurring_transaction,
    schema: setRecurringTransactionInput,
    readOnly: false,
    requiresScope: 'edit', // upsert: with recurring_id it updates an existing template
    run: async (ctx, a) => {
      const r = await callRpc<{ id: string }>(ctx.env, ctx.userId, 'set_recurring_transaction', {
        p_ledger_id: a.ledger_id,
        p_type: a.type,
        p_amount: a.amount,
        p_recurrence_rule: a.recurrence_rule,
        p_next_run: a.next_run,
        p_account_id: a.account_id ?? null,
        p_category_id: a.category_id ?? null,
        p_transfer_account_id: a.transfer_account_id ?? null,
        p_currency: a.currency ?? null,
        p_payee: a.payee ?? null,
        p_note: a.note ?? null,
        p_recurring_id: a.recurring_id ?? null,
        p_is_active: a.is_active ?? null,
      })
      return { summary: 'Recurring transaction set', data: r }
    },
  },
  {
    name: 'delete_recurring_transaction',
    description: toolDescriptions.delete_recurring_transaction,
    schema: deleteRecurringTransactionInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_recurring_transaction', { p_recurring_id: a.recurring_id })
      return { summary: 'Recurring removed', data: { ok: true } }
    },
  },
  {
    name: 'get_monthly_trend',
    description: toolDescriptions.get_monthly_trend,
    schema: getMonthlyTrendInput,
    readOnly: true,
    run: async (ctx, a) => {
      const trend = await callRpc(ctx.env, ctx.userId, 'get_monthly_trend', { p_ledger_id: a.ledger_id, p_months: a.months ?? 6 })
      return { summary: 'Monthly trend', data: trend }
    },
  },
  // ── Galleon P3: shared ledgers + splitting ──────────────────────────────
  {
    name: 'add_ledger_member',
    description: toolDescriptions.add_ledger_member,
    schema: addLedgerMemberInput,
    readOnly: false,
    requiresScope: 'edit', // grants another person read/write on your finances — privileged, not add-only
    run: async (ctx, a) => {
      const m = await callRpc(ctx.env, ctx.userId, 'add_ledger_member', {
        p_ledger_id: a.ledger_id,
        p_display_name: a.display_name,
        p_email: a.email ?? null,
        p_role: a.role ?? 'editor',
      })
      return { summary: 'Member added', data: m }
    },
  },
  {
    name: 'update_ledger_member',
    description: toolDescriptions.update_ledger_member,
    schema: updateLedgerMemberInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      const m = await callRpc(ctx.env, ctx.userId, 'update_ledger_member', {
        p_member_id: a.member_id,
        p_display_name: a.display_name ?? null,
        p_role: a.role ?? null,
      })
      return { summary: 'Member updated', data: m }
    },
  },
  {
    name: 'remove_ledger_member',
    description: toolDescriptions.remove_ledger_member,
    schema: removeLedgerMemberInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'remove_ledger_member', { p_member_id: a.member_id })
      return { summary: 'Member removed', data: { ok: true } }
    },
  },
  {
    name: 'create_split_expense',
    description: toolDescriptions.create_split_expense,
    schema: createSplitExpenseInput,
    readOnly: false,
    run: async (ctx, a) => {
      const tx = await callRpc(ctx.env, ctx.userId, 'create_split_expense', {
        p_ledger_id: a.ledger_id,
        p_amount: a.amount,
        p_splits: a.splits,
        p_account_id: a.account_id ?? null,
        p_category_id: a.category_id ?? null,
        p_payee: a.payee ?? null,
        p_note: a.note ?? null,
        p_txn_date: a.txn_date ?? null,
        p_currency: a.currency ?? null,
      })
      return { summary: 'Split expense recorded', data: tx }
    },
  },
  {
    name: 'set_transaction_splits',
    description: toolDescriptions.set_transaction_splits,
    schema: setTransactionSplitsInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'set_transaction_splits', { p_transaction_id: a.transaction_id, p_splits: a.splits })
      return { summary: 'Splits updated', data: { ok: true } }
    },
  },
  {
    name: 'get_balances',
    description: toolDescriptions.get_balances,
    schema: getBalancesInput,
    readOnly: true,
    run: async (ctx, a) => {
      const b = await callRpc(ctx.env, ctx.userId, 'get_balances', { p_ledger_id: a.ledger_id })
      return { summary: 'Member balances', data: b }
    },
  },
  {
    name: 'suggest_settlement',
    description: toolDescriptions.suggest_settlement,
    schema: suggestSettlementInput,
    readOnly: true,
    run: async (ctx, a) => {
      const balances = (await callRpc<MemberBalance[]>(ctx.env, ctx.userId, 'get_balances', { p_ledger_id: a.ledger_id })) ?? []
      const payments = settleUp(balances.map((b) => ({ member_id: b.member_id, display_name: b.display_name, balance: Number(b.balance) })))
      return { summary: `${payments.length} payment(s) settle everyone up`, data: { balances, payments } }
    },
  },
  {
    name: 'record_settlement',
    description: toolDescriptions.record_settlement,
    schema: recordSettlementInput,
    readOnly: false,
    run: async (ctx, a) => {
      const s = await callRpc(ctx.env, ctx.userId, 'record_settlement', {
        p_ledger_id: a.ledger_id,
        p_from_member: a.from_member,
        p_to_member: a.to_member,
        p_amount: a.amount,
        p_note: a.note ?? null,
        p_sett_date: a.sett_date ?? null,
        p_currency: a.currency ?? null,
      })
      return { summary: 'Settlement recorded', data: s }
    },
  },
  {
    name: 'delete_settlement',
    description: toolDescriptions.delete_settlement,
    schema: deleteSettlementInput,
    readOnly: false,
    requiresScope: 'edit',
    run: async (ctx, a) => {
      await callRpc(ctx.env, ctx.userId, 'delete_settlement', { p_settlement_id: a.settlement_id })
      return { summary: 'Settlement removed', data: { ok: true } }
    },
  },
  // ── Galleon read-only: close the create/list/get/delete asymmetry ───────
  {
    name: 'list_ledger_members',
    description: toolDescriptions.list_ledger_members,
    schema: listLedgerMembersInput,
    readOnly: true,
    run: async (ctx, a) => {
      const m = await callRpc(ctx.env, ctx.userId, 'list_ledger_members', { p_ledger_id: a.ledger_id })
      return { summary: 'Ledger members', data: m }
    },
  },
  {
    name: 'list_settlements',
    description: toolDescriptions.list_settlements,
    schema: listSettlementsInput,
    readOnly: true,
    run: async (ctx, a) => {
      const s = await callRpc(ctx.env, ctx.userId, 'list_settlements', { p_ledger_id: a.ledger_id })
      return { summary: 'Settlements', data: s }
    },
  },
  {
    name: 'list_recurring',
    description: toolDescriptions.list_recurring,
    schema: listRecurringInput,
    readOnly: true,
    run: async (ctx, a) => {
      const r = await callRpc(ctx.env, ctx.userId, 'list_recurring', { p_ledger_id: a.ledger_id })
      return { summary: 'Recurring templates', data: r }
    },
  },
  {
    name: 'get_transaction',
    description: toolDescriptions.get_transaction,
    schema: getTransactionInput,
    readOnly: true,
    run: async (ctx, a) => {
      const tx = await callRpc(ctx.env, ctx.userId, 'get_transaction', { p_transaction_id: a.transaction_id })
      return { summary: 'Transaction with splits', data: tx }
    },
  },
  {
    name: 'list_split_txn_ids',
    description: toolDescriptions.list_split_txn_ids,
    schema: listSplitTxnIdsInput,
    readOnly: true,
    run: async (ctx, a) => {
      const ids = await callRpc(ctx.env, ctx.userId, 'list_split_txn_ids', { p_ledger_id: a.ledger_id })
      return { summary: 'Split transaction ids', data: ids }
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
