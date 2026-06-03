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
/** Structured tag set — settable inline on create/update AND via set_*_tags. */
const tagArray = z.array(z.string().trim().min(1).max(40)).max(12)

export const createNoteInput = z.object({
  title,
  body: z.string().max(100_000).default(''),
  deck_id: uuid.optional(),
  tags: tagArray.optional(),
})
export type CreateNoteInput = z.infer<typeof createNoteInput>

export const updateNoteInput = z.object({
  note_id: uuid,
  title: title.optional(),
  body: z.string().max(100_000).optional(),
  deck_id: uuid.optional(),
  tags: tagArray.optional(),
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
  tags: tagArray.optional(),
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
        tags: tagArray.optional(),
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

// ── Notes / cards / decks: edit + delete + organise (AI management tools) ──
const tagList = z.array(z.string().trim().min(1).max(40)).max(12)

export const listNotesToolInput = z.object({
  deck_id: uuid.optional(),
  limit: z.number().int().min(1).max(200).default(50),
})
export const listCardsToolInput = z.object({
  deck_id: uuid.optional(),
  tag: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
})
export const updateCardInput = z.object({
  card_id: uuid,
  front: flashcardFace.optional(),
  back: flashcardFace.optional(),
  deck_id: uuid.optional(),
  note_id: uuid.optional(),
  tags: tagArray.optional(),
})
export const deleteCardInput = z.object({ card_id: uuid })
export const deleteNoteInput = z.object({ note_id: uuid })
export const deleteDeckInput = z.object({ deck_id: uuid })
export const updateDeckInput = z.object({
  deck_id: uuid,
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2_000).optional(),
})
export const setNoteDeckInput = z.object({ note_id: uuid, deck_id: uuid.nullable() })
export const setNoteTagsInput = z.object({ note_id: uuid, tags: tagList })
export const setCardTagsInput = z.object({ card_id: uuid, tags: tagList })
export const unlinkNotesInput = z.object({ note_id_a: uuid, note_id_b: uuid })

// ── Travel itineraries ────────────────────────────────────────────
export const itineraryCategory = z.enum(['food', 'transport', 'sight', 'lodging', 'activity', 'shopping', 'other'])
export type ItineraryCategory = z.infer<typeof itineraryCategory>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const clockTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM')
const currency = z.string().trim().min(1).max(8)
const placeUrl = z.string().trim().url().max(2_000)

const travelers = z.array(z.string().trim().min(1).max(40)).max(20)

export const createItineraryInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  destination: z.string().trim().max(300).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  timezone: z.string().trim().max(64).optional(),
  default_currency: currency.optional(),
  cover_url: placeUrl.optional(),
  notes: z.string().max(20_000).optional(),
  travelers: travelers.optional(),
  budget_total: z.number().min(0).max(1e12).optional(),
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
  travelers: travelers.optional(),
  budget_total: z.number().min(0).max(1e12).optional(),
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

// ── Trip v2: reservations / packing / item status & assignees ──
export const bookingType = z.enum(['flight', 'lodging', 'transport', 'ticket', 'car', 'other'])
export const checklistKind = z.enum(['packing', 'todo'])
export const itemStatus = z.enum(['idea', 'tentative', 'planned', 'done'])
const isoDateTime = z.string().trim().min(1).max(40)
const assigneeList = z.array(z.string().trim().min(1).max(40)).max(20)

const bookingFields = {
  type: bookingType.default('other'),
  title: z.string().trim().min(1, 'Title is required').max(300),
  start_at: isoDateTime.optional(),
  end_at: isoDateTime.optional(),
  from_label: z.string().trim().max(200).optional(),
  to_label: z.string().trim().max(200).optional(),
  location: z.string().trim().max(300).optional(),
  confirmation: z.string().trim().max(200).optional(),
  cost: z.number().min(0).max(1e12).optional(),
  currency: currency.optional(),
  url: placeUrl.optional(),
  notes: z.string().max(5_000).optional(),
  sort_order: z.number().int().optional(),
}
export const createBookingInput = z.object({ itinerary_id: uuid, ...bookingFields })
export type CreateBookingInput = z.infer<typeof createBookingInput>
export const updateBookingInput = z.object({
  booking_id: uuid,
  type: bookingType.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  start_at: isoDateTime.optional(),
  end_at: isoDateTime.optional(),
  from_label: z.string().trim().max(200).optional(),
  to_label: z.string().trim().max(200).optional(),
  location: z.string().trim().max(300).optional(),
  confirmation: z.string().trim().max(200).optional(),
  cost: z.number().min(0).max(1e12).optional(),
  currency: currency.optional(),
  url: placeUrl.optional(),
  notes: z.string().max(5_000).optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateBookingInput = z.infer<typeof updateBookingInput>
export const deleteBookingInput = z.object({ booking_id: uuid })
export const createBookingsBulkInput = z.object({ itinerary_id: uuid, bookings: z.array(z.object(bookingFields)).min(1).max(100) })

const checklistFields = {
  kind: checklistKind.default('todo'),
  text: z.string().trim().min(1, 'Required').max(1_000),
  category: z.string().trim().max(60).optional(),
  assignee: z.string().trim().max(80).optional(),
  sort_order: z.number().int().optional(),
}
export const createChecklistInput = z.object({ itinerary_id: uuid, ...checklistFields })
export type CreateChecklistInput = z.infer<typeof createChecklistInput>
export const updateChecklistInput = z.object({
  item_id: uuid,
  text: z.string().trim().min(1).max(1_000).optional(),
  category: z.string().trim().max(60).optional(),
  done: z.boolean().optional(),
  assignee: z.string().trim().max(80).optional(),
  kind: checklistKind.optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateChecklistInput = z.infer<typeof updateChecklistInput>
export const deleteChecklistInput = z.object({ item_id: uuid })
export const createChecklistBulkInput = z.object({ itinerary_id: uuid, items: z.array(z.object(checklistFields)).min(1).max(200) })

export const setItemStatusInput = z.object({ item_id: uuid, status: itemStatus })
export const setItemAssigneesInput = z.object({ item_id: uuid, assignees: assigneeList })

// ── Mnema Tempo: todos / habits / reminders ───────────────────────
export const taskStatus = z.enum(['todo', 'done', 'cancelled'])
export type TaskStatus = z.infer<typeof taskStatus>
export const taskKind = z.enum(['task', 'habit'])
export const listKind = z.enum(['list', 'project'])
const priority = z.number().int().min(0).max(4)
const labelArray = z.array(z.string().trim().min(1).max(40)).max(20)
const rrule = z.string().trim().max(1_000)
const tzName = z.string().trim().max(64)

export const createTaskListInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: listKind.optional(),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(40).optional(),
  sort_order: z.number().int().optional(),
})
export type CreateTaskListInput = z.infer<typeof createTaskListInput>

export const updateTaskListInput = z.object({
  list_id: uuid,
  name: z.string().trim().min(1).max(120).optional(),
  kind: listKind.optional(),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(40).optional(),
  is_archived: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateTaskListInput = z.infer<typeof updateTaskListInput>

export const deleteTaskListInput = z.object({ list_id: uuid })
export const reorderTaskListsInput = z.object({ list_ids: z.array(uuid).max(2_000) })

// Shared task fields, reused by create / bulk.
const taskFields = {
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(20_000).optional(),
  list_id: uuid.optional(),
  parent_task_id: uuid.optional(),
  priority: priority.optional(),
  labels: labelArray.optional(),
  scheduled_date: isoDate.optional(),
  scheduled_time: clockTime.optional(),
  due_date: isoDate.optional(),
  due_time: clockTime.optional(),
  duration_min: z.number().int().min(0).max(1_440).optional(),
  kind: taskKind.optional(),
  recurrence_rule: rrule.optional(),
  recurrence_after_completion: z.boolean().optional(),
  recurrence_anchor: isoDate.optional(),
  next_occurrence: isoDate.optional(),
  tz: tzName.optional(),
  sort_order: z.number().int().optional(),
}
export const createTaskInput = z.object({ ...taskFields })
export type CreateTaskInput = z.infer<typeof createTaskInput>

export const createTasksBulkInput = z.object({ tasks: z.array(z.object(taskFields)).min(1).max(200) })
export type CreateTasksBulkInput = z.infer<typeof createTasksBulkInput>

export const updateTaskInput = z.object({
  task_id: uuid,
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).optional(),
  list_id: uuid.optional(),
  priority: priority.optional(),
  labels: labelArray.optional(),
  due_date: isoDate.optional(),
  due_time: clockTime.optional(),
  status: taskStatus.optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateTaskInput = z.infer<typeof updateTaskInput>

export const completeTaskInput = z.object({
  task_id: uuid,
  completed_at: z.string().optional(),
  next_occurrence: isoDate.optional(),
})
export const uncompleteTaskInput = z.object({ task_id: uuid })
export const deleteTaskInput = z.object({ task_id: uuid })
export const moveTaskInput = z.object({
  task_id: uuid,
  list_id: uuid.nullable().optional(),
  parent_task_id: uuid.nullable().optional(),
})
export const reorderTasksInput = z.object({ list_id: uuid.optional(), task_ids: z.array(uuid).max(1_000) })

export const setRecurrenceInput = z.object({
  task_id: uuid,
  recurrence_rule: rrule,
  recurrence_after_completion: z.boolean().optional(),
  recurrence_anchor: isoDate.optional(),
  next_occurrence: isoDate.optional(),
})
export type SetRecurrenceInput = z.infer<typeof setRecurrenceInput>
export const scheduleTaskInput = z.object({
  task_id: uuid,
  scheduled_date: isoDate.optional(),
  scheduled_time: clockTime.optional(),
  due_date: isoDate.optional(),
  due_time: clockTime.optional(),
  duration_min: z.number().int().min(0).max(1_440).optional(),
})
export type ScheduleTaskInput = z.infer<typeof scheduleTaskInput>
export const snoozeTaskInput = z.object({ task_id: uuid, until: isoDate, until_time: clockTime.optional() })

export const checkInInput = z.object({ task_id: uuid, checkin_date: isoDate.optional(), note: z.string().max(500).optional() })
export const uncheckInInput = z.object({ task_id: uuid, checkin_date: isoDate.optional() })

export const addReminderInput = z.object({
  task_id: uuid,
  remind_at: z.string().trim().min(1).max(40),
  offset_min: z.number().int().optional(),
})
export type AddReminderInput = z.infer<typeof addReminderInput>
export const removeReminderInput = z.object({ reminder_id: uuid })

export const getTaskInput = z.object({ task_id: uuid })
export const listTasksInput = z.object({
  list_id: uuid.optional(),
  status: taskStatus.optional(),
  kind: taskKind.optional(),
  label: z.string().trim().min(1).optional(),
  due_before: isoDate.optional(),
  scheduled_on: isoDate.optional(),
  include_subtasks: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})
export const searchTasksInput = z.object({ query: z.string().trim().min(1), limit: z.number().int().min(1).max(200).default(50) })
export const getHabitInput = z.object({ task_id: uuid })
export const getStreakInput = z.object({ task_id: uuid })
export const suggestRecurringTasksInput = z.object({
  lookback_days: z.number().int().min(1).max(365).default(90),
  min_count: z.number().int().min(2).max(50).default(3),
})

// ── Mnema Galleon: money (ledgers / accounts / categories / transactions) ──
export const accountType = z.enum(['cash', 'bank', 'credit', 'ewallet', 'investment'])
export const txnType = z.enum(['income', 'expense', 'transfer'])
export const categoryKind = z.enum(['income', 'expense'])
const money = z.number()
const txnTags = z.array(z.string().trim().min(1).max(40)).max(20)

export const createLedgerInput = z.object({
  name: z.string().trim().min(1).max(120),
  base_currency: currency.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
})
export type CreateLedgerInput = z.infer<typeof createLedgerInput>
export const updateLedgerInput = z.object({
  ledger_id: uuid,
  name: z.string().trim().min(1).max(120).optional(),
  base_currency: currency.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
  is_archived: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateLedgerInput = z.infer<typeof updateLedgerInput>
export const deleteLedgerInput = z.object({ ledger_id: uuid })
export const getLedgerInput = z.object({ ledger_id: uuid })

export const createAccountInput = z.object({
  ledger_id: uuid,
  name: z.string().trim().min(1).max(120),
  type: accountType.optional(),
  currency: currency.optional(),
  opening_balance: money.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
  sort_order: z.number().int().optional(),
})
export type CreateAccountInput = z.infer<typeof createAccountInput>
export const updateAccountInput = z.object({
  account_id: uuid,
  name: z.string().trim().min(1).max(120).optional(),
  type: accountType.optional(),
  currency: currency.optional(),
  opening_balance: money.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
  is_archived: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateAccountInput = z.infer<typeof updateAccountInput>
export const deleteAccountInput = z.object({ account_id: uuid })

export const createCategoryInput = z.object({
  ledger_id: uuid,
  name: z.string().trim().min(1).max(80),
  kind: categoryKind,
  parent_id: uuid.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
  sort_order: z.number().int().optional(),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInput>
export const updateCategoryInput = z.object({
  category_id: uuid,
  name: z.string().trim().min(1).max(80).optional(),
  kind: categoryKind.optional(),
  parent_id: uuid.optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(40).optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>
export const deleteCategoryInput = z.object({ category_id: uuid })

const txnFields = {
  type: txnType,
  amount: money,
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  transfer_account_id: uuid.optional(),
  currency: currency.optional(),
  fx_rate: z.number().positive().optional(),
  payee: z.string().trim().max(200).optional(),
  note: z.string().max(2_000).optional(),
  txn_date: isoDate.optional(),
  tags: txnTags.optional(),
  receipt_url: placeUrl.optional(),
}
export const createTransactionInput = z.object({ ledger_id: uuid, ...txnFields })
export type CreateTransactionInput = z.infer<typeof createTransactionInput>
export const createTransactionsBulkInput = z.object({
  ledger_id: uuid,
  transactions: z.array(z.object(txnFields)).min(1).max(200),
})
export type CreateTransactionsBulkInput = z.infer<typeof createTransactionsBulkInput>
export const updateTransactionInput = z.object({
  transaction_id: uuid,
  type: txnType.optional(),
  amount: money.optional(),
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  transfer_account_id: uuid.optional(),
  payee: z.string().trim().max(200).optional(),
  note: z.string().max(2_000).optional(),
  txn_date: isoDate.optional(),
  tags: txnTags.optional(),
  receipt_url: placeUrl.optional(),
})
export type UpdateTransactionInput = z.infer<typeof updateTransactionInput>
export const deleteTransactionInput = z.object({ transaction_id: uuid })
export const createTransferInput = z.object({
  ledger_id: uuid,
  from_account_id: uuid,
  to_account_id: uuid,
  amount: money,
  txn_date: isoDate.optional(),
  note: z.string().max(2_000).optional(),
})
export type CreateTransferInput = z.infer<typeof createTransferInput>

export const listTransactionsInput = z.object({
  ledger_id: uuid,
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  type: txnType.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.number().int().min(1).max(1000).default(100),
})
export const searchTransactionsInput = z.object({ ledger_id: uuid, query: z.string().trim().min(1), limit: z.number().int().min(1).max(200).default(50) })
export const getLedgerSummaryInput = z.object({ ledger_id: uuid, from: isoDate, to: isoDate })

// Galleon P2: budgets, recurring, reports
export const setBudgetInput = z.object({
  ledger_id: uuid,
  category_id: uuid.optional(),
  amount: money,
  period: z.enum(['monthly', 'weekly']).optional(),
  rollover: z.boolean().optional(),
})
export type SetBudgetInput = z.infer<typeof setBudgetInput>
export const deleteBudgetInput = z.object({ budget_id: uuid })
export const getBudgetStatusInput = z.object({ ledger_id: uuid, from: isoDate, to: isoDate })
export const setRecurringTransactionInput = z.object({
  ledger_id: uuid,
  type: txnType,
  amount: money,
  recurrence_rule: z.string().trim().min(1).max(1_000),
  next_run: isoDate,
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  transfer_account_id: uuid.optional(),
  currency: currency.optional(),
  payee: z.string().trim().max(200).optional(),
  note: z.string().max(2_000).optional(),
  recurring_id: uuid.optional(),
  is_active: z.boolean().optional(),
})
export type SetRecurringTransactionInput = z.infer<typeof setRecurringTransactionInput>
export const deleteRecurringTransactionInput = z.object({ recurring_id: uuid })
export const runDueRecurringInput = z.object({ ledger_id: uuid })
export const getMonthlyTrendInput = z.object({ ledger_id: uuid, months: z.number().int().min(1).max(36).default(6) })

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
  create_note: 'Create a study note (markdown body). Optionally set tags inline. Returns the new note id.',
  update_note: 'Update an existing note’s title, body, deck, and/or tags (only the fields you pass change).',
  get_note: 'Fetch one note by id.',
  search_notes: 'Full-text search the user’s notes by keyword.',
  create_deck: 'Create a deck (folder) to organise notes and flashcards.',
  list_decks: 'List the user’s decks.',
  create_flashcard: 'Create one spaced-repetition flashcard (front/back, optional tags). Schedulable immediately.',
  create_flashcards_bulk: 'Create many flashcards in one call (each may carry its own tags).',
  link_notes: 'Create a typed link between two notes (feeds the knowledge graph).',
  list_notes: 'List the user’s notes (optionally filtered by deck). Returns ids + titles.',
  list_cards: 'List the user’s flashcards (optionally by deck or tag). Returns ids + front/back.',
  update_card: 'Edit an existing flashcard’s front/back, tags, or move it to another deck/note.',
  delete_card: 'Delete a flashcard.',
  delete_note: 'Delete a note (its flashcards are kept, just unlinked from the note).',
  update_deck: 'Rename a deck or change its description.',
  delete_deck: 'Delete a deck (its notes & cards are kept, just unfiled).',
  set_note_deck: 'Move a note into a deck, or out of all decks (deck_id = null).',
  set_note_tags: 'Replace a note’s whole tag set (drives the graph colours/clusters).',
  set_card_tags: 'Replace a flashcard’s whole tag set (enables study-by-tag).',
  unlink_notes: 'Remove the link between two notes.',
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
  update_itinerary_meta: 'Set a trip’s travelers and/or total budget.',
  create_booking:
    'Add a reservation to a trip — flight, lodging, transport, ticket, car, or document. Returns the new id.',
  update_booking: 'Update a reservation’s fields.',
  delete_booking: 'Delete a reservation.',
  create_bookings_bulk: 'Add many reservations to a trip in one call.',
  create_checklist_item: 'Add a packing item or to-do to a trip.',
  update_checklist_item: 'Update a packing/to-do item (text, category, assignee, or done state).',
  delete_checklist_item: 'Delete a packing/to-do item.',
  create_checklist_bulk: 'Add many packing/to-do items to a trip in one call.',
  set_item_status: 'Set an activity’s status: idea, tentative, planned, or done.',
  set_item_assignees: 'Set which travelers an activity is for (a subset of the trip’s travelers).',
  list_share_links: 'List a trip’s public share links.',
  create_share_link:
    'Create a public read-only share link for a trip. Optionally hide costs. Returns a token; the link is /s/<token>.',
  revoke_share_link: 'Revoke a public share link so it can no longer be viewed.',
  // Mnema Tempo (todos / habits / reminders)
  create_task_list: 'Create a task list (or project) to organise todos. Returns the new list id.',
  update_task_list: 'Rename a list, recolour it, archive it, or change its order.',
  delete_task_list: 'Delete a list (its tasks fall back to the Inbox).',
  reorder_task_lists: 'Set the order of lists by passing their ids in the desired order.',
  list_task_lists: 'List the user’s task lists.',
  create_task:
    'Create a todo. Optional: list, parent (subtask), priority (0–4), labels, scheduled/due date+time, duration (for time-blocking), recurrence (RRULE), or make it a habit (kind="habit"). Returns the new task id.',
  create_tasks_bulk: 'Create many tasks in one call (each may carry its own list/labels/schedule/recurrence).',
  update_task: 'Update a task’s title, notes, list, priority, labels, due date, or status (only fields you pass change).',
  complete_task:
    'Mark a task done. A recurring task advances to its next occurrence; a habit records today’s check-in and bumps its streak. Pass next_occurrence (computed from the RRULE) to advance precisely.',
  uncomplete_task: 'Reopen a completed task.',
  delete_task: 'Delete a task (and its subtasks).',
  move_task: 'Move a task to another list and/or under another task (parent). Pass null to send to the Inbox / top level.',
  reorder_tasks: 'Set the order of tasks within a list by passing their ids in the desired order.',
  set_recurrence:
    'Make a task repeat using an iCal RRULE (e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR). after_completion=true means the next due date is counted from when you actually complete it (Todoist’s "every!").',
  schedule_task: 'Set or clear a task’s scheduled date+time, due date+time, and duration (minutes) — the calendar/time-block fields.',
  snooze_task: 'Push a task’s scheduled date (and next occurrence) to a later day.',
  check_in: 'Record a habit check-in for a date (default today) and recompute its streak. Returns the updated task.',
  uncheck_in: 'Remove a habit check-in for a date and recompute the streak.',
  add_reminder: 'Add a reminder to a task at an absolute time (ISO 8601). Delivered via web push when due.',
  remove_reminder: 'Remove a reminder.',
  get_task: 'Fetch one task with its subtasks, reminders, and (for habits) check-in history.',
  list_tasks:
    'List tasks with optional filters: list_id, status (todo/done/cancelled), kind (task/habit), label, due_before, scheduled_on. Top-level only unless include_subtasks=true.',
  search_tasks: 'Search the user’s tasks by keyword (title/notes).',
  get_habit: 'Fetch a habit with its full check-in history.',
  get_streak: 'Get a habit’s current streak, longest streak, and check-in calendar.',
  suggest_recurring_tasks:
    'Find clusters of repeatedly-added non-recurring tasks (with an inferred cadence) so you can propose turning them into recurring tasks.',
  // Mnema Galleon (money)
  create_ledger: 'Create a money ledger (帳本). Seeds default categories. Returns the new ledger id.',
  update_ledger: 'Rename a ledger, change its base currency, icon, colour, or archive it.',
  delete_ledger: 'Delete a ledger and everything in it (owner only).',
  list_ledgers: 'List the user’s money ledgers.',
  get_ledger: 'Fetch a ledger with its accounts (incl. computed balances) and categories.',
  create_account: 'Add an account/wallet to a ledger (cash, bank, credit, ewallet, investment) with an opening balance.',
  update_account: 'Update an account’s name, type, currency, opening balance, or archive it.',
  delete_account: 'Delete an account (its transactions keep but lose the account link).',
  list_accounts: 'List a ledger’s accounts.',
  create_category: 'Add an income or expense category to a ledger.',
  update_category: 'Update a category’s name, kind, parent, icon, or colour.',
  delete_category: 'Delete a category.',
  list_categories: 'List a ledger’s categories.',
  create_transaction:
    'Record one transaction — income, expense, or transfer. Pass account_id (the wallet), category_id (not for transfers), amount, and optional payee/note/txn_date/tags. Returns the new id. This is the "log a transaction" tool.',
  create_transactions_bulk: 'Record many transactions in one call (e.g. line items from a receipt).',
  create_transfer: 'Move money between two accounts in the same ledger (no income/expense effect).',
  update_transaction: 'Update a transaction’s amount, type, account, category, payee, note, date, or tags.',
  delete_transaction: 'Delete a transaction.',
  list_transactions: 'List a ledger’s transactions with optional filters: account, category, type, date range.',
  search_transactions: 'Search a ledger’s transactions by payee/note keyword.',
  get_ledger_summary:
    'Totals (income, expense) and spending-by-category for a ledger over a date range — for dashboards/reports.',
  set_budget: 'Set a monthly budget for a category (omit category_id for an overall budget). Upserts.',
  delete_budget: 'Remove a budget.',
  get_budget_status: 'Each budget with its limit and how much has been spent in a date range.',
  set_recurring_transaction:
    'Create or update a recurring transaction template (salary, rent, subscriptions). Uses an RRULE + next_run; posted automatically when the ledger is next opened. Pass recurring_id to update.',
  delete_recurring_transaction: 'Remove a recurring transaction template.',
  get_monthly_trend: 'Income vs expense per month for the last N months — for trend charts.',
} as const
