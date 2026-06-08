import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/lib/auth'
import { useTasks } from '@/lib/hooks'
import { pushTodayWidget, type TodaySnapshot } from '@/lib/widget'

/** Local YYYY-MM-DD — mirrors localToday() in routes/tempo.tsx. */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function cmpDate(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : 1
}

/**
 * Keeps the Android home-screen widget's "today" snapshot in sync with the
 * user's open tasks. Renders nothing. Only does work in the native shell while
 * signed in — on web (and signed-out) it's a no-op, so it never fetches.
 */
export function WidgetSync() {
  const { session } = useAuth()
  if (!Capacitor.isNativePlatform() || !session) return null
  return <WidgetSyncInner />
}

function WidgetSyncInner() {
  // Shares the query cache with the Tempo screen (same key) — no extra fetch there.
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  const lastRef = useRef('')

  useEffect(() => {
    if (!tasks) return
    const today = localToday()
    const todays = tasks
      .filter((t) => t.kind !== 'habit' && ((t.due_date != null && t.due_date <= today) || t.scheduled_date === today))
      .sort((a, b) => b.priority - a.priority || cmpDate(a.due_date, b.due_date) || a.sort_order - b.sort_order)

    const sub = (t: (typeof todays)[number]): string => {
      if (t.due_date != null && t.due_date < today) return '逾期'
      if (t.due_date === today || t.scheduled_date === today) return '今天'
      return t.due_date ?? ''
    }

    const snap: TodaySnapshot = {
      date: today,
      count: todays.length,
      items: todays.slice(0, 5).map((t) => ({ title: t.title, sub: sub(t) })),
    }

    // Skip redundant writes (react-query refetches return fresh arrays often).
    const key = JSON.stringify(snap)
    if (key === lastRef.current) return
    lastRef.current = key
    void pushTodayWidget(snap)
  }, [tasks])

  return null
}
