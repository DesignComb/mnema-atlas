import * as api from '@/lib/api'
import type { DayRef, ItemRef, TripPlan } from '@/lib/trip-roundtrip'

/**
 * Apply a diff plan (from diffTrip) to the live trip through the normal write
 * path. Order matters: create days first (so new items can land on them and
 * moved items resolve), then update, create items, delete items, delete days,
 * and finally a best-effort reorder so the saved order matches the pasted one.
 * Sequential on purpose — trips are small and later steps depend on earlier ids.
 */
export async function applyTripPlan(plan: TripPlan): Promise<void> {
  const newDayIds = new Map<string, string>()
  const newItemIds = new Map<string, string>()

  const resolveDay = (ref: DayRef): string | null =>
    ref.kind === 'existing' ? ref.id : ref.kind === 'unscheduled' ? null : (newDayIds.get(ref.key) ?? null)
  const resolveItem = (ref: ItemRef): string | null =>
    ref.kind === 'existing' ? ref.id : (newItemIds.get(ref.key) ?? null)

  // 1. Trip title
  if (plan.titleTo) await api.updateItinerary({ itinerary_id: plan.tripId, title: plan.titleTo })

  // 2. Update existing days
  for (const d of plan.dayUpdates) {
    await api.updateDay({ day_id: d.id, ...d.write })
  }

  // 3. Create new days (in document order) → capture their ids
  for (const d of [...plan.dayCreates].sort((a, b) => a.order - b.order)) {
    const row = await api.createDay({ itinerary_id: plan.tripId, day_date: d.day_date, label: d.label, sort_order: d.order })
    newDayIds.set(d.key, row.id)
  }

  // 4. Update existing items: fields first, then a day move if needed
  for (const u of plan.itemUpdates) {
    if (Object.keys(u.write).length) await api.updateItem({ item_id: u.id, ...u.write })
    if (u.move) await api.setItemDay(u.id, resolveDay(u.move))
  }

  // 5. Create new items on their resolved day (or unscheduled)
  for (const c of plan.itemCreates) {
    const dayId = resolveDay(c.dayRef)
    const row = dayId
      ? await api.createItem({ day_id: dayId, ...c.write })
      : await api.createItem({ itinerary_id: plan.tripId, ...c.write })
    newItemIds.set(c.key, row.id)
  }

  // 6. Delete removed items, then 7. removed (now-empty) days
  for (const d of plan.itemDeletes) await api.deleteItem(d.id)
  for (const d of plan.dayDeletes) await api.deleteDay(d.id)

  // 8. Best-effort: make the saved order match the pasted order. Ordering glitches
  //    must never fail the whole apply, so swallow errors here.
  const uniq = <T>(a: T[]): T[] => Array.from(new Set(a))
  try {
    const dayOrder = uniq(plan.orderedDays.map((o) => resolveDay(o.ref)).filter((x): x is string => !!x))
    if (dayOrder.length) await api.reorderDays(plan.tripId, dayOrder)
    for (const o of plan.orderedDays) {
      const dayId = resolveDay(o.ref)
      const ids = uniq(o.itemRefs.map(resolveItem).filter((x): x is string => !!x))
      if (dayId && ids.length) await api.reorderItems(dayId, ids)
    }
    const unsched = uniq(plan.unschedRefs.map(resolveItem).filter((x): x is string => !!x))
    if (unsched.length) await api.reorderItems(null, unsched)
  } catch {
    /* ordering is cosmetic — the content changes already landed */
  }
}
