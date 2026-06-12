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

const imageUrl = z.string().url().max(2_000)
export const createFlashcardInput = z.object({
  front: flashcardFace,
  back: flashcardFace,
  note_id: uuid.optional(),
  deck_id: uuid.optional(),
  tags: tagArray.optional(),
  image_url: imageUrl.optional(),
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
  // a full URL sets the image; an empty string clears it; omit to leave unchanged
  image_url: z.string().max(2_000).optional(),
})
export const deleteCardInput = z.object({ card_id: uuid })
export const deleteNoteInput = z.object({ note_id: uuid })
export const deleteDeckInput = z.object({ deck_id: uuid })
export const updateDeckInput = z.object({
  deck_id: uuid,
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2_000).optional(),
})
export const setDeckParentInput = z.object({ deck_id: uuid, parent_deck_id: uuid.nullable().optional() })
export const setNoteDeckInput = z.object({ note_id: uuid, deck_id: uuid.nullable() })
export const setNoteStarredInput = z.object({ note_id: uuid, starred: z.boolean() })
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
  // Habit day-boundary: wall-clock time (in tz) the day rolls over, e.g. "04:00".
  // Null/omitted = midnight. Used to decide which day a check-in belongs to.
  reset_time: clockTime.optional(),
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
  reset_time: clockTime.optional(),
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

// A hyperlink on a task (pass "" to clear it).
export const setTaskUrlInput = z.object({ task_id: uuid, url: z.string().trim().max(2_000) })
export type SetTaskUrlInput = z.infer<typeof setTaskUrlInput>

// Daily end-of-day review opt-in.
export const setReviewPrefsInput = z.object({ is_enabled: z.boolean() })
export type SetReviewPrefsInput = z.infer<typeof setReviewPrefsInput>

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

// ── Captures (quick-capture inbox / 暫存區) ──
export const captureSource = z.enum(['ui', 'share', 'rest', 'mcp'])
export const captureStatus = z.enum(['pending', 'processed', 'dismissed'])
export const createCaptureInput = z.object({
  raw_text: z.string().trim().min(1).max(5_000),
  source: captureSource.optional(),
})
export type CreateCaptureInput = z.infer<typeof createCaptureInput>
export const listCapturesInput = z.object({
  status: z.union([captureStatus, z.literal('all')]).optional(),
  limit: z.number().int().min(1).max(500).default(100),
})
export const resolveCaptureInput = z.object({
  capture_id: uuid,
  // What it became + a back-link to the created item.
  resolved_kind: z.string().trim().min(1).max(40).optional(),
  resolved_ref: z
    .object({ id: z.string().optional(), title: z.string().optional(), space: z.string().optional() })
    .passthrough()
    .optional(),
  note: z.string().max(2_000).optional(),
})
export type ResolveCaptureInput = z.infer<typeof resolveCaptureInput>
export const dismissCaptureInput = z.object({ capture_id: uuid })
export const reopenCaptureInput = z.object({ capture_id: uuid })
export const deleteCaptureInput = z.object({ capture_id: uuid })

// ── Mnema Vitals: health (metrics / journal+mood / medications) ────
export const healthModule = z.enum(['vitals', 'activity', 'nutrition', 'meds', 'journal'])
export type HealthModule = z.infer<typeof healthModule>
export const healthLogKind = z.enum([
  'weight', 'body_fat', 'waist', 'blood_pressure', 'heart_rate', 'blood_glucose', 'temperature',
  'sleep', 'workout', 'water', 'meal', 'meds', 'symptom', 'other',
])
export type HealthLogKind = z.infer<typeof healthLogKind>
const healthMeta = z.record(z.unknown())
const moodScale = z.number().int().min(1).max(5)
const healthTags = z.array(z.string().trim().min(1).max(40)).max(20)

export const setHealthSettingsInput = z.object({
  enabled_modules: z.array(healthModule).max(5).optional(),
  weight_unit: z.enum(['kg', 'lb']).optional(),
})
export type SetHealthSettingsInput = z.infer<typeof setHealthSettingsInput>

export const logHealthInput = z.object({
  kind: healthLogKind,
  value: z.number().optional(),
  value2: z.number().optional(),
  unit: z.string().trim().max(16).optional(),
  text_value: z.string().trim().max(300).optional(),
  meta: healthMeta.optional(),
  logged_at: z.string().trim().max(40).optional(),
  logged_date: isoDate.optional(),
  note: z.string().max(2_000).optional(),
})
export type LogHealthInput = z.infer<typeof logHealthInput>

export const updateHealthLogInput = z.object({
  log_id: uuid,
  value: z.number().optional(),
  value2: z.number().optional(),
  unit: z.string().trim().max(16).optional(),
  text_value: z.string().trim().max(300).optional(),
  meta: healthMeta.optional(),
  logged_at: z.string().trim().max(40).optional(),
  logged_date: isoDate.optional(),
  note: z.string().max(2_000).optional(),
})
export type UpdateHealthLogInput = z.infer<typeof updateHealthLogInput>

export const deleteHealthLogInput = z.object({ log_id: uuid })
export const listHealthLogsInput = z.object({
  kind: healthLogKind.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.number().int().min(1).max(1_000).default(200),
})
export type ListHealthLogsInput = z.infer<typeof listHealthLogsInput>

export const setJournalEntryInput = z.object({
  entry_date: isoDate.optional(),
  mood: moodScale.optional(),
  energy: moodScale.optional(),
  body: z.string().max(20_000).optional(),
  tags: healthTags.optional(),
})
export type SetJournalEntryInput = z.infer<typeof setJournalEntryInput>

export const deleteJournalEntryInput = z.object({ entry_id: uuid })
export const listJournalEntriesInput = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.number().int().min(1).max(1_000).default(100),
})
export type ListJournalEntriesInput = z.infer<typeof listJournalEntriesInput>

const medTimes = z.array(clockTime).max(12)
export const createMedicationInput = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(120).optional(),
  times: medTimes.optional(),
  schedule_rule: z.string().trim().max(1_000).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(2_000).optional(),
})
export type CreateMedicationInput = z.infer<typeof createMedicationInput>

export const updateMedicationInput = z.object({
  medication_id: uuid,
  name: z.string().trim().min(1).max(200).optional(),
  dosage: z.string().trim().max(120).optional(),
  times: medTimes.optional(),
  schedule_rule: z.string().trim().max(1_000).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(2_000).optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateMedicationInput = z.infer<typeof updateMedicationInput>

export const deleteMedicationInput = z.object({ medication_id: uuid })
export const listMedicationsInput = z.object({
  active_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(1_000).default(200),
})
export type ListMedicationsInput = z.infer<typeof listMedicationsInput>

// ── Mnema Kitchen: recipes / pantry / shopping / meal plan ─────────
const recipeUrl = z.string().trim().url().max(2_000)
const kitchenTags = z.array(z.string().trim().min(1).max(40)).max(20)
export const recipeIngredient = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(40).optional(),
})
export type RecipeIngredient = z.infer<typeof recipeIngredient>
const ingredientsArray = z.array(recipeIngredient).max(100)

const recipeFields = {
  description: z.string().max(5_000).optional(),
  instructions: z.string().max(50_000).optional(),
  ingredients: ingredientsArray.optional(),
  servings: z.number().int().min(0).max(100).optional(),
  total_minutes: z.number().int().min(0).max(100_000).optional(),
  tags: kitchenTags.optional(),
  source_url: recipeUrl.optional(),
  image_url: recipeUrl.optional(),
  is_favorite: z.boolean().optional(),
}
export const createRecipeInput = z.object({ title: z.string().trim().min(1).max(300), ...recipeFields })
export type CreateRecipeInput = z.infer<typeof createRecipeInput>
export const updateRecipeInput = z.object({
  recipe_id: uuid,
  title: z.string().trim().min(1).max(300).optional(),
  ...recipeFields,
})
export type UpdateRecipeInput = z.infer<typeof updateRecipeInput>
export const deleteRecipeInput = z.object({ recipe_id: uuid })
export const getRecipeInput = z.object({ recipe_id: uuid })
export const listRecipesInput = z.object({
  query: z.string().trim().min(1).optional(),
  favorites_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(1_000).default(200),
})
export type ListRecipesInput = z.infer<typeof listRecipesInput>

export const addPantryItemInput = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().optional(),
  unit: z.string().trim().max(24).optional(),
  category: z.string().trim().max(60).optional(),
  location: z.string().trim().max(60).optional(),
  expires_on: isoDate.optional(),
  notes: z.string().max(1_000).optional(),
})
export type AddPantryItemInput = z.infer<typeof addPantryItemInput>
export const updatePantryItemInput = z.object({
  item_id: uuid,
  name: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().optional(),
  unit: z.string().trim().max(24).optional(),
  category: z.string().trim().max(60).optional(),
  location: z.string().trim().max(60).optional(),
  expires_on: isoDate.optional(),
  notes: z.string().max(1_000).optional(),
})
export type UpdatePantryItemInput = z.infer<typeof updatePantryItemInput>
export const deletePantryItemInput = z.object({ item_id: uuid })
export const listPantryInput = z.object({ limit: z.number().int().min(1).max(2_000).default(500) })

export const shoppingItemInput = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  recipe_id: uuid.optional(),
})
export const addShoppingItemsInput = z.object({ items: z.array(shoppingItemInput).min(1).max(200) })
export type AddShoppingItemsInput = z.infer<typeof addShoppingItemsInput>
export const updateShoppingItemInput = z.object({
  item_id: uuid,
  name: z.string().trim().min(1).max(200).optional(),
  quantity: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  is_checked: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemInput>
export const deleteShoppingItemInput = z.object({ item_id: uuid })
export const clearCheckedShoppingInput = z.object({})
export const listShoppingInput = z.object({ limit: z.number().int().min(1).max(2_000).default(500) })

export const mealSlot = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
export type MealSlot = z.infer<typeof mealSlot>
export const setMealPlanInput = z.object({
  plan_id: uuid.optional(),
  plan_date: isoDate.optional(),
  slot: mealSlot.optional(),
  recipe_id: uuid.optional(),
  title: z.string().trim().max(300).optional(),
  note: z.string().max(1_000).optional(),
})
export type SetMealPlanInput = z.infer<typeof setMealPlanInput>
export const deleteMealPlanInput = z.object({ plan_id: uuid })
export const listMealPlansInput = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.number().int().min(1).max(2_000).default(500),
})
export type ListMealPlansInput = z.infer<typeof listMealPlansInput>

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
export const deleteAccountInput = z.object({ account_id: uuid, reassign_to_account_id: uuid.optional() })

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

// Galleon: subscriptions (recurring paid services with renewal + auto-post)
export const setSubscriptionInput = z.object({
  ledger_id: uuid,
  name: z.string().trim().min(1).max(200),
  amount: money,
  renewal_date: isoDate,
  recurrence_rule: z.string().trim().min(1).max(1_000).optional(),
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  currency: currency.optional(),
  cancel_reminder_days: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(2_000).optional(),
  subscription_id: uuid.optional(),
  is_active: z.boolean().optional(),
})
export type SetSubscriptionInput = z.infer<typeof setSubscriptionInput>
export const deleteSubscriptionInput = z.object({ subscription_id: uuid })
export const listSubscriptionsInput = z.object({ ledger_id: uuid })
export const postDueSubscriptionsInput = z.object({ ledger_id: uuid })
export const getUpcomingSubscriptionsInput = z.object({
  ledger_id: uuid,
  days_ahead: z.number().int().min(0).max(365).default(14),
})

// Galleon P3: members + splitting
const splitShare = z.object({ member_id: uuid, paid: money, owed: money })
export const addLedgerMemberInput = z.object({
  ledger_id: uuid,
  display_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().optional(),
  role: z.enum(['editor', 'viewer']).optional(),
})
export const updateLedgerMemberInput = z.object({
  member_id: uuid,
  display_name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(['editor', 'viewer']).optional(),
})
export const removeLedgerMemberInput = z.object({ member_id: uuid })
export const createSplitExpenseInput = z.object({
  ledger_id: uuid,
  amount: money,
  splits: z.array(splitShare).min(1).max(100),
  account_id: uuid.optional(),
  category_id: uuid.optional(),
  payee: z.string().trim().max(200).optional(),
  note: z.string().max(2_000).optional(),
  txn_date: isoDate.optional(),
  currency: currency.optional(),
})
export type CreateSplitExpenseInput = z.infer<typeof createSplitExpenseInput>
export const setTransactionSplitsInput = z.object({ transaction_id: uuid, splits: z.array(splitShare).max(100) })
export const getBalancesInput = z.object({ ledger_id: uuid })
export const suggestSettlementInput = z.object({ ledger_id: uuid })
export const recordSettlementInput = z.object({
  ledger_id: uuid,
  from_member: uuid,
  to_member: uuid,
  amount: money,
  note: z.string().max(2_000).optional(),
  sett_date: isoDate.optional(),
  currency: currency.optional(),
})
export type RecordSettlementInput = z.infer<typeof recordSettlementInput>
export const deleteSettlementInput = z.object({ settlement_id: uuid })
export const listLedgerMembersInput = z.object({ ledger_id: uuid })
export const listSplitTxnIdsInput = z.object({ ledger_id: uuid })
export const listSettlementsInput = z.object({ ledger_id: uuid })
export const listRecurringInput = z.object({ ledger_id: uuid })
export const getTransactionInput = z.object({ transaction_id: uuid })

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
  create_flashcard:
    'Create one spaced-repetition flashcard (front/back, optional tags). Optionally attach an image via image_url (a public URL — e.g. one already uploaded to the app). Schedulable immediately.',
  create_flashcards_bulk: 'Create many flashcards in one call (each may carry its own tags).',
  link_notes: 'Create a typed link between two notes (feeds the knowledge graph).',
  list_notes: 'List the user’s notes (optionally filtered by deck). Returns ids + titles.',
  list_cards: 'List the user’s flashcards (optionally by deck or tag). Returns ids + front/back.',
  update_card: 'Edit an existing flashcard’s front/back, tags, image (image_url; "" clears it), or move it to another deck/note.',
  delete_card: 'Delete a flashcard.',
  delete_note: 'Delete a note (its flashcards are kept, just unlinked from the note).',
  update_deck: 'Rename a deck or change its description.',
  delete_deck: 'Delete a deck (its notes & cards are kept, just unfiled).',
  set_deck_parent:
    'Move a deck under another deck (or to the top level with parent_deck_id=null). Decks can nest like folders.',
  set_note_deck: 'Move a note into a deck, or out of all decks (deck_id = null).',
  set_note_starred: 'Star or unstar a note (starred notes pin to the top of the notes list).',
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
    'Create a todo. Optional: list, parent (subtask), priority (0–4), labels, scheduled/due date+time, duration (for time-blocking), recurrence (RRULE), or make it a habit (kind="habit"). For a habit whose day rolls over at a non-midnight cutoff — e.g. a game daily that resets at 04:00 or 14:00 — set reset_time ("HH:MM", in the task’s tz) so a check-in counts for the right day. CATEGORISE IT: if the user didn’t say where it belongs, read the labels already in use (via list_tasks) and reuse one — keep categories COARSE/life-area level (e.g. 遊戲 / 日常 / 學習), not per-item. Propose the best fit and confirm (e.g. "貼上 日常 分類?"); only invent a new category if nothing fits. Returns the new task id.',
  create_tasks_bulk:
    'Create many tasks in one call (each may carry its own list/labels/schedule/recurrence). Categorise each the way create_task describes — match the user’s existing lists/labels and confirm the grouping.',
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
  set_task_url: 'Attach a hyperlink to a task (a ticket, doc, or product page), shown as a clickable link on the todo. Pass an empty string to clear it.',
  set_review_prefs:
    'Turn the daily end-of-day review on or off (is_enabled). When on, the user gets an evening nudge to log their mood/journal and a catch-up the next day if they miss it.',
  get_task: 'Fetch one task with its subtasks, reminders, and (for habits) check-in history.',
  list_tasks:
    'List tasks with optional filters: list_id, status (todo/done/cancelled), kind (task/habit), label, due_before, scheduled_on. Top-level only unless include_subtasks=true.',
  search_tasks: 'Search the user’s tasks by keyword (title/notes).',
  get_habit: 'Fetch a habit with its full check-in history.',
  get_streak: 'Get a habit’s current streak, longest streak, and check-in calendar.',
  suggest_recurring_tasks:
    'Find clusters of repeatedly-added non-recurring tasks (with an inferred cadence) so you can propose turning them into recurring tasks.',
  // Captures (quick-capture inbox / 暫存區)
  create_capture:
    'Drop a raw quick-capture line into the user’s inbox (暫存區) — an unstructured thought to triage later, not yet filed anywhere. Use this when the user is jotting on the go (e.g. “記一下:週五要交報告”), not when they want something filed now. Returns the capture id.',
  list_captures:
    'List the user’s captures (default status=pending) — the quick-capture inbox (暫存區) to triage. When the user asks to process their inbox (“處理我的暫存區 / process my inbox”), for EACH pending capture: (1) interpret the raw text into the right space — a Tempo task or habit, a note, a trip item, or a money transaction; (2) auto-categorise using the user’s OWN lists — call list_task_lists first and match (e.g. “原神/星鐵/寶可夢” → a 遊戲/Games list); (3) ask only the few things you genuinely need (a specific time? repeat/recurring? which list? for a game daily, the reset time?) — be conversational, do not silently dump; (4) create the item with create_task/create_note/etc., then call resolve_capture with its id. Confirm what you filed.',
  resolve_capture:
    'Mark a capture as processed once you have filed it into a real item. Pass resolved_kind ("task"/"note"/"transaction"/"itinerary") and resolved_ref ({id,title}) so the capture links back to what it became. Call this right after the create_* succeeds.',
  dismiss_capture: 'Mark a capture as dismissed (not worth keeping) without filing it anywhere.',
  reopen_capture: 'Move a processed or dismissed capture back to pending (undo a triage).',
  delete_capture: 'Permanently delete a capture from the inbox.',
  // Mnema Vitals (health)
  log_health:
    'Log one health metric. Pick `kind` and use the right fields: weight/body_fat/waist/heart_rate/blood_glucose/temperature → value (+unit, e.g. kg, bpm, mg/dL, °C); blood_pressure → value=systolic, value2=diastolic; sleep → value=hours (meta {bedtime,wake}); workout → value=minutes, text_value=type (meta {distance_km, calories}); water → value=ml; meal → text_value=description, value=kcal (meta {protein,carbs,fat}); meds → text_value=medication name; symptom → text_value=what + note. Pass logged_date (YYYY-MM-DD, the user’s local day) and optional logged_at. This is the "log my weight / meal / workout / sleep / blood pressure" tool. Returns the new row id.',
  update_health_log: 'Update a health log entry (only the fields you pass change).',
  delete_health_log: 'Delete a health log entry.',
  list_health_logs:
    'List the user’s health logs, optionally filtered by kind and a date range (from/to, YYYY-MM-DD). Use it to read trends before answering (e.g. weight over the last month).',
  set_journal_entry:
    'Create or update the user’s daily journal entry (one per day) — the merged journal + mood. Pass entry_date (default today), an optional mood and energy each 1–5, free-text body, and tags. Upserts: re-calling for the same day merges. This is the tool for "today I felt…", the end-of-day reflection, and recording a mood.',
  delete_journal_entry: 'Delete a journal entry by id.',
  list_journal_entries: 'List journal entries (mood/energy/body) over an optional date range — for mood trends and reflections.',
  create_medication:
    'Add a medication/supplement the user takes. Pass name, optional dosage, times (wall-clock "HH:MM" array, e.g. ["08:00","20:00"]), an optional RRULE schedule_rule for non-daily meds, and notes. Logging an actual dose taken is log_health(kind="meds"). Returns the new id.',
  update_medication: 'Update a medication’s name, dosage, times, schedule, active state, or order.',
  delete_medication: 'Delete a medication from the list.',
  list_medications: 'List the user’s medications (pass active_only=true for current ones) — with their times and dosage.',
  set_health_settings:
    'Set which health modules the user wants visible (enabled_modules: any of vitals, activity, nutrition, meds, journal) and/or the weight unit (kg/lb). Use when the user wants to turn a whole category on or off.',
  // Mnema Kitchen (recipes / pantry / shopping / meal plan)
  create_recipe:
    'Save a recipe. Pass title, optional description, instructions (markdown steps), ingredients (array of {name, quantity, unit}), servings, total_minutes, tags, source_url, image_url. This is the "save this recipe" tool. Returns the new recipe id.',
  update_recipe: 'Update a recipe’s fields (only the fields you pass change). Pass the full ingredients array to replace it.',
  delete_recipe: 'Delete a recipe.',
  list_recipes: 'List the user’s recipes (optional title query, favorites_only). Returns ids + titles + ingredients.',
  get_recipe: 'Fetch one recipe with its full ingredients and instructions.',
  add_pantry_item:
    'Add an item to the pantry/fridge inventory. Pass name, optional quantity (number) + unit, category, location (fridge/freezer/pantry), expires_on (YYYY-MM-DD), notes. Use for "我買了…" / "冰箱還有…".',
  update_pantry_item: 'Update a pantry item (e.g. reduce quantity after cooking, set an expiry).',
  delete_pantry_item: 'Remove an item from the pantry (e.g. it’s used up).',
  list_pantry: 'List what’s in the pantry — read this before suggesting meals from what the user has, or before building a shopping list.',
  add_shopping_items:
    'Add one or more items to the shopping list. Pass items: an array of {name, quantity?, category?, recipe_id?}. To fill the list from a recipe, read the recipe’s ingredients and add them (set recipe_id). Returns the created items.',
  update_shopping_item: 'Update a shopping item — rename, change quantity, or tick it off (is_checked=true).',
  delete_shopping_item: 'Remove an item from the shopping list.',
  clear_checked_shopping: 'Delete all ticked-off shopping items (after a shop). Returns how many were removed.',
  list_shopping: 'List the shopping list (unchecked first).',
  set_meal_plan:
    'Plan a meal for a day. Pass plan_date (YYYY-MM-DD), slot (breakfast/lunch/dinner/snack), and either recipe_id (a saved recipe) or a free-text title. Pass plan_id to update an existing plan. Returns the plan.',
  delete_meal_plan: 'Remove a planned meal.',
  list_meal_plans: 'List planned meals over an optional date range (from/to) — for the week’s menu.',
  // Mnema Galleon (money)
  create_ledger: 'Create a money ledger (帳本). Seeds default categories. Returns the new ledger id.',
  update_ledger: 'Rename a ledger, change its base currency, icon, colour, or archive it.',
  delete_ledger: 'Delete a ledger and everything in it (owner only).',
  list_ledgers: 'List the user’s money ledgers.',
  get_ledger: 'Fetch a ledger with its accounts (incl. computed balances) and categories.',
  create_account: 'Add an account/wallet to a ledger (cash, bank, credit, ewallet, investment) with an opening balance.',
  update_account: 'Update an account’s name, type, currency, opening balance, or archive it.',
  delete_account: 'Delete an account (its transactions keep but lose the account link).',
  create_category: 'Add an income or expense category to a ledger.',
  update_category: 'Update a category’s name, kind, parent, icon, or colour.',
  delete_category: 'Delete a category.',
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
  add_ledger_member:
    'Add a person to a shared ledger so expenses can be split with them. If you pass the email of an existing Mnema user they join as a real collaborator (can open the ledger with their own AI); any other email (or none) adds a name-only guest. Owner only.',
  update_ledger_member: 'Rename a ledger member or change their role (editor/viewer). Cannot change the owner.',
  remove_ledger_member: 'Remove a member from a shared ledger. Cannot remove the owner.',
  create_split_expense:
    'Record an expense split among members. Pass the total amount plus a `splits` array of {member_id, paid, owed} resolved amounts (Splitwise model — paid is what each person fronted, owed is their share). Sum of paid and sum of owed should each equal the amount.',
  set_transaction_splits: 'Replace the per-member paid/owed splits on an existing transaction.',
  get_balances: 'Per-member net balance in a shared ledger: positive = they are owed money, negative = they owe. Accounts for all splits and recorded settlements.',
  suggest_settlement: 'Compute the minimal set of who-pays-whom payments that settles everyone up in a shared ledger. Returns current balances plus a list of suggested payments — read-only, records nothing.',
  record_settlement: 'Record that one member paid another to settle up (e.g. a debtor repaid a creditor). Adjusts both balances toward zero.',
  delete_settlement: 'Remove a previously recorded settlement.',
  list_ledger_members: 'List a shared ledger’s members with their member_id, name, role, and whether they are a real Mnema user or a name-only guest. Use this to get the member_id needed for splitting/settling.',
  list_settlements: 'List recorded settlements (who paid whom, how much, when) in a ledger — including each settlement_id needed to delete one.',
  list_recurring: 'List a ledger’s recurring-transaction templates with their recurring_id, amount, rule, and next run date.',
  get_transaction: 'Get one transaction plus its per-member split breakdown (paid/owed). Read this before editing splits so you do not overwrite other members’ shares.',
  list_split_txn_ids: 'List the ids of transactions in a ledger that have a split breakdown — use it to tell which transactions are shared.',
  // Galleon: subscriptions
  set_subscription:
    'Create or update a subscription (a recurring paid service — Netflix, iCloud, gym…). Pass ledger_id, name, amount, renewal_date (YYYY-MM-DD, the next charge), an RRULE recurrence_rule (default FREQ=MONTHLY), and optional account_id/category_id/currency/cancel_reminder_days/notes. Subscriptions AUTO-POST: an expense is recorded and the renewal_date advances when the ledger is opened. Pass subscription_id to update. Returns the subscription.',
  delete_subscription: 'Delete a subscription (stops future auto-posting). Past posted transactions are kept.',
  list_subscriptions: 'List a ledger’s subscriptions with their amount, renewal date, and active state.',
  get_upcoming_subscriptions: 'List active subscriptions renewing within the next N days (days_ahead, default 14) — for "what’s renewing soon" and cancel reminders.',
} as const
