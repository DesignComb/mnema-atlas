import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '@/lib/auth'
import { useTasks } from '@/lib/hooks'
import { router } from '@/router'
import { pushTodayWidget, pushWidgetAuth, type TodaySnapshot } from '@/lib/widget'

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
 * Keeps the Android home-screen widget in sync: today's task snapshot, the auth
 * blob it needs to complete a task live, and the quick-add deep link. Renders
 * nothing. Native + signed-in only — a no-op on web and signed out.
 */
export function WidgetSync() {
  const { session } = useAuth()
  if (!Capacitor.isNativePlatform() || !session) return null
  return <WidgetSyncInner token={session.access_token} />
}

function WidgetSyncInner({ token }: { token: string }) {
  // Shares the query cache with the Tempo screen (same key) — no extra fetch there.
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  const lastRef = useRef('')

  // Give the widget the current access token (refreshed while the app is open).
  useEffect(() => {
    void pushWidgetAuth(token)
  }, [token])

  // The widget's "+" opens tw.dco.mnema://add — land on the Tempo add screen.
  useEffect(() => {
    const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
      if (url.startsWith('tw.dco.mnema://add')) {
        void router.navigate({ to: '/tempo' })
      }
    })
    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [])

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
      items: todays.slice(0, 5).map((t) => ({ id: t.id, title: t.title, sub: sub(t) })),
    }

    const key = JSON.stringify(snap)
    if (key === lastRef.current) return
    lastRef.current = key
    void pushTodayWidget(snap)
  }, [tasks])

  return null
}
