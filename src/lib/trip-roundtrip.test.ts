import { describe, it, expect } from 'vitest'
import type { ItineraryItem, ItineraryTree } from '@/lib/api'
import { diffTrip, parseTripDoc, planCounts, planIsEmpty, serializeTrip } from '@/lib/trip-roundtrip'

function item(id: string, dayId: string | null, title: string, over: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id,
    day_id: dayId,
    title,
    place: null,
    lat: null,
    lng: null,
    category: 'sight',
    start_time: null,
    end_time: null,
    end_day_offset: 0,
    transport_mode: null,
    transport_detail: null,
    cost: null,
    currency: null,
    booking_url: null,
    booking_ref: null,
    notes: null,
    sort_order: 0,
    status: 'planned',
    assignees: [],
    tags: [],
    ...over,
  }
}

function tree(): ItineraryTree {
  return {
    id: 'trip1',
    owner_id: 'u',
    my_role: 'owner',
    title: 'Tokyo',
    destination: 'Japan',
    start_date: '2025-04-01',
    end_date: '2025-04-02',
    timezone: 'Asia/Tokyo',
    default_currency: 'JPY',
    cover_url: null,
    notes: null,
    travelers: [],
    budget_total: null,
    created_at: '',
    updated_at: '',
    days: [
      { id: 'd1', day_date: '2025-04-01', label: 'Day 1', sort_order: 0, items: [item('i1', 'd1', 'Shrine'), item('i2', 'd1', 'Lunch', { category: 'food' })] },
      { id: 'd2', day_date: '2025-04-02', label: 'Day 2', sort_order: 1, items: [item('i3', 'd2', 'Museum')] },
    ],
    unscheduled: [item('u1', null, 'Maybe ramen', { category: 'food' })],
    bookings: [],
    checklist: [],
    cost_by_currency: {},
  }
}

describe('trip-roundtrip diff', () => {
  it('serialize → diff is a no-op (identity round-trip)', () => {
    const t = tree()
    const plan = diffTrip(t, serializeTrip(t))
    expect(planIsEmpty(plan)).toBe(true)
    expect(planCounts(plan).total).toBe(0)
  })

  it('detects a new item (no id) on an existing day', () => {
    const t = tree()
    const doc = serializeTrip(t)
    doc.days[0].items.push({ title: 'New stop' })
    const plan = diffTrip(t, doc)
    expect(plan.itemCreates).toHaveLength(1)
    expect(plan.itemCreates[0].dayRef).toEqual({ kind: 'existing', id: 'd1' })
    expect(plan.itemCreates[0].write.title).toBe('New stop')
  })

  it('detects a title rename', () => {
    const t = tree()
    const doc = serializeTrip(t)
    doc.title = 'Tokyo Spring'
    expect(diffTrip(t, doc).titleTo).toBe('Tokyo Spring')
  })

  it('removing a day from the doc deletes the day and its items', () => {
    const t = tree()
    const doc = serializeTrip(t)
    doc.days = [doc.days[0]] // drop Day 2
    const plan = diffTrip(t, doc)
    expect(plan.dayDeletes.map((d) => d.id)).toEqual(['d2'])
    expect(plan.itemDeletes.map((i) => i.id)).toContain('i3')
  })

  it('detects an item field edit (keeps id)', () => {
    const t = tree()
    const doc = serializeTrip(t)
    doc.days[0].items[0].title = 'Big Shrine'
    const plan = diffTrip(t, doc)
    expect(plan.itemUpdates).toHaveLength(1)
    expect(plan.itemUpdates[0].id).toBe('i1')
    expect(plan.itemUpdates[0].write.title).toBe('Big Shrine')
    expect(plan.itemUpdates[0].move).toBeUndefined()
  })

  it('dedupes a repeated existing item id across days (first wins, never deleted)', () => {
    const t = tree()
    const doc = serializeTrip(t)
    doc.days[0].items[0].title = 'Changed' // edit the real i1 (first occurrence)
    doc.days[1].items.push({ id: 'i1', title: 'Dup' }) // accidental repeat of i1 — must be ignored
    const plan = diffTrip(t, doc)
    expect(plan.itemUpdates.filter((u) => u.id === 'i1')).toHaveLength(1)
    expect(plan.itemUpdates.find((u) => u.id === 'i1')?.write.title).toBe('Changed')
    expect(plan.itemDeletes.find((d) => d.id === 'i1')).toBeUndefined()
  })

  it('detects moving an item to another day', () => {
    const t = tree()
    const doc = serializeTrip(t)
    // Move i3 from Day 2 to Day 1; keep Day 2 (now empty) so it is not deleted.
    const moved = doc.days[1].items[0]
    doc.days[0].items.push(moved)
    doc.days[1].items = []
    const plan = diffTrip(t, doc)
    const u = plan.itemUpdates.find((x) => x.id === 'i3')
    expect(u?.move).toEqual({ kind: 'existing', id: 'd1' })
    expect(plan.itemDeletes).toHaveLength(0)
  })
})

describe('trip-roundtrip parse', () => {
  it('parses a fenced mnema-trip block, ignoring surrounding prose', () => {
    const text = 'Sure!\n```mnema-trip\n{"tripId":"x","days":[{"date":"2025-04-01","items":[{"title":"A"}]}],"unscheduled":[]}\n```\nDone.'
    const r = parseTripDoc(text)
    expect(r.ok).toBe(true)
    expect(r.data?.days[0].items[0].title).toBe('A')
  })

  it('reports an error for non-JSON', () => {
    expect(parseTripDoc('no block here').ok).toBe(false)
  })
})
