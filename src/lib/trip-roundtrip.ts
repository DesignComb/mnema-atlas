import { z } from 'zod'
import type { ItineraryTree, ItineraryItem } from '@/lib/api'
import { categoryOf, type Category } from '@/lib/itinerary'

/**
 * Trip "round-trip" editing without MCP/REST: copy the current trip out as a
 * fixed `mnema-trip` JSON block, let any AI edit it, paste the edited block
 * back, then diff it against the live trip and apply the changes through the
 * normal `api.*` write path (see trip-roundtrip-apply.ts).
 *
 * The format carries each day/item `id` so the diff can tell apart edits
 * (id kept), additions (id omitted) and removals (id gone). It only includes
 * the human-editable subset of fields; anything not in the block (status, tags,
 * assignees, coordinates, transport, booking refs…) is left untouched on apply.
 */

// ── The pasted document ──────────────────────────────────────────────────────

const rtItemSchema = z.object({
  id: z.string().nullish(),
  title: z.string().min(1, 'item needs a title'),
  category: z.string().nullish(),
  start: z.string().nullish(), // start time, HH:MM
  end: z.string().nullish(), // end time, HH:MM
  place: z.string().nullish(),
  cost: z.number().nullish(),
  currency: z.string().nullish(),
  notes: z.string().nullish(),
})
const rtDaySchema = z.object({
  id: z.string().nullish(),
  date: z.string().nullish(), // YYYY-MM-DD
  label: z.string().nullish(),
  items: z.array(rtItemSchema).default([]),
})
const roundTripDocSchema = z.object({
  tripId: z.string().nullish(),
  title: z.string().nullish(),
  days: z.array(rtDaySchema).default([]),
  unscheduled: z.array(rtItemSchema).default([]),
})

export type RtItem = z.infer<typeof rtItemSchema>
export type RtDay = z.infer<typeof rtDaySchema>
export type RoundTripDoc = z.infer<typeof roundTripDocSchema>

// ── Serialize the live trip → the document ───────────────────────────────────

function serializeItem(i: ItineraryItem): RtItem {
  return {
    id: i.id,
    title: i.title,
    category: i.category,
    start: i.start_time,
    end: i.end_time,
    place: i.place,
    cost: i.cost,
    currency: i.currency,
    notes: i.notes,
  }
}

export function serializeTrip(trip: ItineraryTree): RoundTripDoc {
  return {
    tripId: trip.id,
    title: trip.title,
    days: trip.days.map((d) => ({
      id: d.id,
      date: d.day_date,
      label: d.label,
      items: d.items.map(serializeItem),
    })),
    unscheduled: trip.unscheduled.map(serializeItem),
  }
}

/** Instruction + fenced block the user copies and pastes into their AI. */
export function buildTripExport(trip: ItineraryTree): string {
  const doc = serializeTrip(trip)
  const json = JSON.stringify(doc, null, 2)
  return [
    'Here is my current trip from Mnema. Edit it exactly as I ask, then reply with ONLY a fenced ```mnema-trip code block in the SAME shape.',
    '',
    'Rules:',
    '- Keep the "id" of any day/item you keep or modify. OMIT "id" for anything new. Never invent ids.',
    '- To remove a day or item, leave it out of your reply.',
    '- To move an item to another day, put it under that day.',
    '- Dates are "YYYY-MM-DD", times are "HH:MM" (24h). category ∈ food|transport|sight|lodging|activity|shopping|other.',
    '- Keep the same field names. Output nothing but the block.',
    '',
    '```mnema-trip',
    json,
    '```',
  ].join('\n')
}

// ── Parse the pasted reply ───────────────────────────────────────────────────

/** Pull the JSON out of pasted text — prefers a ```mnema-trip fence, then any
 *  ```json/``` fence, then a bare {…}, so it survives the AI adding prose. */
export function extractTripBlock(text: string): string | null {
  const fenced = text.match(/```(?:mnema-trip|mnema|json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const brace = text.match(/\{[\s\S]*\}/)
  return brace ? brace[0] : null
}

function softRepair(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
}

export interface TripParseResult {
  ok: boolean
  data?: RoundTripDoc
  error?: string
}

export function parseTripDoc(text: string): TripParseResult {
  const block = extractTripBlock(text)
  if (!block) return { ok: false, error: 'No JSON or ```mnema-trip block found in the pasted text.' }
  let json: unknown
  try {
    json = JSON.parse(softRepair(block))
  } catch (e) {
    return { ok: false, error: `Couldn't parse JSON: ${e instanceof Error ? e.message : 'invalid'}` }
  }
  const parsed = roundTripDocSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ') }
  }
  return { ok: true, data: parsed.data }
}

// ── Diff: the document vs the live trip → an apply plan ───────────────────────

export type DayRef = { kind: 'existing'; id: string } | { kind: 'new'; key: string } | { kind: 'unscheduled' }
export type ItemRef = { kind: 'existing'; id: string } | { kind: 'new'; key: string }

/** Editable item fields, all optional — only non-empty changed values are set
 *  (clearing a field back to empty is intentionally NOT supported; remove the
 *  item instead). Never carries null, so it matches the api input types. */
export interface ItemWrite {
  title?: string
  category?: Category
  start_time?: string
  end_time?: string
  place?: string
  currency?: string
  notes?: string
  cost?: number
}
export interface DayWrite {
  day_date?: string
  label?: string
}

export interface DayCreateOp {
  key: string
  order: number
  day_date?: string
  label?: string
  preview: string
}
export interface DayUpdateOp {
  id: string
  preview: string
  write: DayWrite
}
export interface DayDeleteOp {
  id: string
  preview: string
}
export interface ItemCreateOp {
  key: string
  dayRef: DayRef
  // category is always set (create requires it; defaults to 'other').
  write: ItemWrite & { title: string; category: Category }
  preview: string
}
export interface ItemUpdateOp {
  id: string
  preview: string
  write: ItemWrite
  move?: DayRef
}
export interface ItemDeleteOp {
  id: string
  preview: string
}

export interface TripPlan {
  tripId: string
  titleTo?: string
  dayCreates: DayCreateOp[]
  dayUpdates: DayUpdateOp[]
  dayDeletes: DayDeleteOp[]
  itemCreates: ItemCreateOp[]
  itemUpdates: ItemUpdateOp[]
  itemDeletes: ItemDeleteOp[]
  /** Final desired order, for a best-effort reorder pass after apply. */
  orderedDays: { ref: DayRef; itemRefs: ItemRef[] }[]
  unschedRefs: ItemRef[]
}

export interface TripDiffCounts {
  dayAdd: number
  dayChange: number
  dayRemove: number
  itemAdd: number
  itemChange: number
  itemRemove: number
  titleChanged: boolean
  total: number
}

const sTrim = (x: unknown): string => (x == null ? '' : String(x).trim())
const emptyToUndef = (x: unknown): string | undefined => {
  const s = sTrim(x)
  return s === '' ? undefined : s
}
const dayLabelOf = (d: { label: string | null; day_date: string | null }, idx?: number): string =>
  d.label?.trim() || d.day_date || (idx != null ? `Day ${idx + 1}` : 'Day')

function itemChanges(cur: ItineraryItem, rt: RtItem): ItemWrite {
  const w: ItemWrite = {}
  const title = emptyToUndef(rt.title)
  if (title && title !== sTrim(cur.title)) w.title = title
  if (rt.category != null) {
    const cat = categoryOf(String(rt.category))
    if (cat !== categoryOf(cur.category)) w.category = cat
  }
  const start = emptyToUndef(rt.start)
  if (start && start !== sTrim(cur.start_time)) w.start_time = start
  const end = emptyToUndef(rt.end)
  if (end && end !== sTrim(cur.end_time)) w.end_time = end
  const place = emptyToUndef(rt.place)
  if (place && place !== sTrim(cur.place)) w.place = place
  const currency = emptyToUndef(rt.currency)
  if (currency && currency !== sTrim(cur.currency)) w.currency = currency
  const notes = emptyToUndef(rt.notes)
  if (notes && notes !== sTrim(cur.notes)) w.notes = notes
  if (typeof rt.cost === 'number' && rt.cost !== cur.cost) w.cost = rt.cost
  return w
}

function createWrite(rt: RtItem): ItemWrite & { title: string; category: Category } {
  const w: ItemWrite & { title: string; category: Category } = {
    title: sTrim(rt.title),
    category: rt.category != null ? categoryOf(String(rt.category)) : 'other',
  }
  const start = emptyToUndef(rt.start)
  if (start) w.start_time = start
  const end = emptyToUndef(rt.end)
  if (end) w.end_time = end
  const place = emptyToUndef(rt.place)
  if (place) w.place = place
  const currency = emptyToUndef(rt.currency)
  if (currency) w.currency = currency
  const notes = emptyToUndef(rt.notes)
  if (notes) w.notes = notes
  if (typeof rt.cost === 'number') w.cost = rt.cost
  return w
}

const hasKeys = (o: object): boolean => Object.keys(o).length > 0

export function diffTrip(trip: ItineraryTree, doc: RoundTripDoc): TripPlan {
  const curDays = new Map(trip.days.map((d) => [d.id, d] as const))
  const curItems = new Map<string, ItineraryItem>()
  trip.days.forEach((d) => d.items.forEach((i) => curItems.set(i.id, i)))
  trip.unscheduled.forEach((i) => curItems.set(i.id, i))

  const seenDays = new Set<string>()
  const seenItems = new Set<string>()
  // Which pasted ids we've already bound, so a doc that repeats the same id
  // (AI duplicating a row across days) yields one op, not conflicting ones.
  const claimedItems = new Set<string>()

  const plan: TripPlan = {
    tripId: trip.id,
    dayCreates: [],
    dayUpdates: [],
    dayDeletes: [],
    itemCreates: [],
    itemUpdates: [],
    itemDeletes: [],
    orderedDays: [],
    unschedRefs: [],
  }

  const reconcileItem = (rt: RtItem, dayRef: DayRef, keyPrefix: string, idx: number): ItemRef | null => {
    if (rt.id && curItems.has(rt.id)) {
      if (claimedItems.has(rt.id)) return null // repeated id — keep the first, drop the rest
      claimedItems.add(rt.id)
      const cur = curItems.get(rt.id)!
      seenItems.add(cur.id)
      const write = itemChanges(cur, rt)
      let move: DayRef | undefined
      if (dayRef.kind === 'new') {
        move = dayRef // created day → move there after it exists
      } else {
        const wantDay = dayRef.kind === 'existing' ? dayRef.id : null
        if (wantDay !== cur.day_id) move = dayRef
      }
      if (hasKeys(write) || move) plan.itemUpdates.push({ id: cur.id, preview: cur.title, write, move })
      return { kind: 'existing', id: cur.id }
    }
    const key = `${keyPrefix}_${idx}`
    plan.itemCreates.push({ key, dayRef, write: createWrite(rt), preview: sTrim(rt.title) })
    return { kind: 'new', key }
  }

  doc.days.forEach((rtDay, di) => {
    let dayRef: DayRef
    if (rtDay.id && curDays.has(rtDay.id)) {
      const cur = curDays.get(rtDay.id)!
      seenDays.add(cur.id)
      dayRef = { kind: 'existing', id: cur.id }
      const write: DayWrite = {}
      const date = emptyToUndef(rtDay.date)
      if (date && date !== sTrim(cur.day_date)) write.day_date = date
      const label = emptyToUndef(rtDay.label)
      if (label && label !== sTrim(cur.label)) write.label = label
      if (hasKeys(write)) plan.dayUpdates.push({ id: cur.id, preview: dayLabelOf(cur, di), write })
    } else {
      const key = `d${di}`
      dayRef = { kind: 'new', key }
      plan.dayCreates.push({
        key,
        order: di,
        day_date: emptyToUndef(rtDay.date),
        label: emptyToUndef(rtDay.label),
        preview: rtDay.label?.trim() || rtDay.date || `Day ${di + 1}`,
      })
    }
    const itemRefs = rtDay.items
      .map((rt, ii) => reconcileItem(rt, dayRef, `i${di}`, ii))
      .filter((r): r is ItemRef => r != null)
    plan.orderedDays.push({ ref: dayRef, itemRefs })
  })

  plan.unschedRefs = doc.unscheduled
    .map((rt, ii) => reconcileItem(rt, { kind: 'unscheduled' }, 'u', ii))
    .filter((r): r is ItemRef => r != null)

  trip.days.forEach((d, di) => {
    if (!seenDays.has(d.id)) plan.dayDeletes.push({ id: d.id, preview: dayLabelOf(d, di) })
  })
  curItems.forEach((i) => {
    if (!seenItems.has(i.id)) plan.itemDeletes.push({ id: i.id, preview: i.title })
  })

  const newTitle = emptyToUndef(doc.title)
  if (newTitle && newTitle !== sTrim(trip.title)) plan.titleTo = newTitle

  return plan
}

export function planCounts(plan: TripPlan): TripDiffCounts {
  const c = {
    dayAdd: plan.dayCreates.length,
    dayChange: plan.dayUpdates.length,
    dayRemove: plan.dayDeletes.length,
    itemAdd: plan.itemCreates.length,
    itemChange: plan.itemUpdates.length,
    itemRemove: plan.itemDeletes.length,
    titleChanged: plan.titleTo != null,
  }
  const total =
    c.dayAdd + c.dayChange + c.dayRemove + c.itemAdd + c.itemChange + c.itemRemove + (c.titleChanged ? 1 : 0)
  return { ...c, total }
}

export const planIsEmpty = (plan: TripPlan): boolean => planCounts(plan).total === 0
