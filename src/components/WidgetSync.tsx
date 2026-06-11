import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useTasks, useCheckInsInRange } from '@/lib/hooks'
import { habitTodayISO } from '@/lib/recurrence'
import { router } from '@/router'
import { pushHabitsWidget, pushTodayWidget, pushWidgetAuth, type HabitsSnapshot, type TodaySnapshot } from '@/lib/widget'

/** Local YYYY-MM-DD — mirrors localToday() in routes/tempo.tsx. */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
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
  const qc = useQueryClient()
  // The widget renders these strings verbatim — follow the app language (A6).
  const { lang } = useI18n()
  // Re-render each minute so localToday()/the range roll over live at midnight or
  // a habit's reset_time (otherwise frozen at first-render's day).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Shares the query cache with the Tempo screen (same key) — no extra fetch there.
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  // ±1 day around today covers every habit's reset-aware "today" even when the
  // habit's tz runs ahead of / behind the device's.
  const { data: checkins } = useCheckInsInRange(addDaysISO(localToday(), -1), addDaysISO(localToday(), 1))
  const lastRef = useRef('')
  const habitsRef = useRef('')

  // Give the widget the current access token (refreshed while the app is open).
  useEffect(() => {
    void pushWidgetAuth(token)
  }, [token])

  // On foreground, re-pull tasks + check-ins so the widget reflects a new day or
  // a check-in made elsewhere.
  useEffect(() => {
    const handle = CapApp.addListener('resume', () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['checkins'] })
    })
    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [qc])

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
      if (t.due_date != null && t.due_date < today) return lang === 'zh' ? '逾期' : 'Overdue'
      if (t.due_date === today || t.scheduled_date === today) return lang === 'zh' ? '今天' : 'Today'
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
  }, [tasks, lang])

  // Habit widget: today's habits + their (reset-aware) checked state.
  useEffect(() => {
    if (!tasks) return
    const done = new Set((checkins ?? []).map((c) => `${c.task_id}|${c.checkin_date}`))
    const items = tasks
      .filter((t) => t.kind === 'habit')
      .slice(0, 6)
      .map((h) => ({ id: h.id, title: h.title, checked: done.has(`${h.id}|${habitTodayISO(h.reset_time, h.tz)}`) }))
    const snap: HabitsSnapshot = { date: localToday(), items }
    const key = JSON.stringify(snap)
    if (key === habitsRef.current) return
    habitsRef.current = key
    void pushHabitsWidget(snap)
  }, [tasks, checkins])

  return null
}
