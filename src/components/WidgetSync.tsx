import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useTasks, useCheckInsInRange, useJournalEntry } from '@/lib/hooks'
import { todayTasks } from '@/lib/today'
import { habitTodayISO } from '@/lib/recurrence'
import { router } from '@/router'
import {
  pushCalendarWidget,
  pushHabitsWidget,
  pushJournalWidget,
  pushStreakWidget,
  pushTodayWidget,
  pushWidgetAuth,
  pushWidgetLang,
  type CalendarSnapshot,
  type HabitsSnapshot,
  type JournalSnapshot,
  type StreakSnapshot,
  type TodaySnapshot,
} from '@/lib/widget'

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

/** Crude markdown strip for the journal snippet: drop syntax chars, collapse whitespace. */
function snippetOf(body: string): string {
  return body
    .replace(/[#*_`[\]()>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * Keeps the Android home-screen widgets in sync: today's task snapshot, habits,
 * journal, month calendar, featured-habit streak, the app language, the auth
 * blob the widgets need to write live, and the quick-add deep link. Renders
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

  const todayISO = localToday()
  // Shares the query cache with the Tempo screen (same key) — no extra fetch there.
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  // One range serves both the habits widget (±1 day covers every habit's
  // reset-aware "today" even when its tz runs ahead of / behind the device's)
  // and the streak widget's 28-day history ending today.
  const { data: checkins } = useCheckInsInRange(addDaysISO(todayISO, -27), addDaysISO(todayISO, 1))
  // Today's journal entry (null = none yet, undefined = still loading).
  const { data: journal } = useJournalEntry(todayISO)
  const lastRef = useRef('')
  const habitsRef = useRef('')
  const langRef = useRef('')
  const journalRef = useRef('')
  const calendarRef = useRef('')
  const streakRef = useRef('')

  // Give the widget the current access token (refreshed while the app is open).
  useEffect(() => {
    void pushWidgetAuth(token)
  }, [token])

  // The widgets render localized text natively — tell them the app language.
  useEffect(() => {
    if (lang === langRef.current) return
    langRef.current = lang
    void pushWidgetLang(lang)
  }, [lang])

  // On foreground, re-pull tasks + check-ins + today's journal so the widgets
  // reflect a new day or a change made elsewhere.
  useEffect(() => {
    const handle = CapApp.addListener('resume', () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['checkins'] })
      void qc.invalidateQueries({ queryKey: ['journal-entry'] })
    })
    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [qc])

  // Widget deep links: "+" opens tw.dco.mnema://add → Tempo; the journal
  // widget's tap opens ://journal → the Health journal section.
  useEffect(() => {
    const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
      if (url.startsWith('tw.dco.mnema://add')) {
        void router.navigate({ to: '/tempo' })
      } else if (url.startsWith('tw.dco.mnema://journal')) {
        void router.navigate({ to: '/health', search: { section: 'journal' } })
      }
    })
    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!tasks) return
    const today = localToday()
    const todays = todayTasks(tasks, today)

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

  // Journal widget: today's entry — mood/energy + a plain-text snippet.
  useEffect(() => {
    if (journal === undefined) return // still loading — don't push a false "no entry"
    const today = localToday()
    const snap: JournalSnapshot = journal
      ? {
          date: today,
          has_entry: true,
          mood: journal.mood,
          energy: journal.energy,
          snippet: snippetOf(journal.body ?? ''),
        }
      : { date: today, has_entry: false, mood: null, energy: null, snippet: '' }
    const key = JSON.stringify(snap)
    if (key === journalRef.current) return
    journalRef.current = key
    void pushJournalWidget(snap)
  }, [journal])

  // Calendar widget: per-day open-task counts for the current month. Same date
  // logic as the today widget (isDueToday), generalized: a non-habit task counts
  // on its due_date and on its scheduled_date — overdue stays on its own
  // original date, no rollover.
  useEffect(() => {
    if (!tasks) return
    const today = localToday()
    const monthPrefix = today.slice(0, 8) // "YYYY-MM-"
    const busy: Record<string, number> = {}
    const bump = (d: string | null) => {
      if (d && d.startsWith(monthPrefix)) busy[d] = (busy[d] ?? 0) + 1
    }
    for (const t of tasks) {
      if (t.kind === 'habit') continue
      bump(t.due_date)
      if (t.scheduled_date !== t.due_date) bump(t.scheduled_date)
    }
    const [y, m] = today.split('-').map(Number)
    const snap: CalendarSnapshot = {
      date: today,
      year: y,
      month: m,
      // Sorted keys → deterministic JSON for the equality skip below.
      busy: Object.fromEntries(Object.entries(busy).sort(([a], [b]) => (a < b ? -1 : 1))),
    }
    const key = JSON.stringify(snap)
    if (key === calendarRef.current) return
    calendarRef.current = key
    void pushCalendarWidget(snap)
  }, [tasks])

  // Streak widget: the featured habit (highest current streak, then sort order)
  // + its last-28-days check-in history.
  useEffect(() => {
    if (!tasks || !checkins) return
    const today = localToday()
    const habits = tasks.filter((t) => t.kind === 'habit')
    let featured: (typeof habits)[number] | null = null
    for (const h of habits) {
      if (
        !featured ||
        h.current_streak > featured.current_streak ||
        (h.current_streak === featured.current_streak && h.sort_order < featured.sort_order)
      ) {
        featured = h
      }
    }
    const done = new Set(checkins.map((c) => `${c.task_id}|${c.checkin_date}`))
    const days = Array.from({ length: 28 }, (_, i) => {
      const d = addDaysISO(today, i - 27)
      return { d, c: featured ? done.has(`${featured.id}|${d}`) : false }
    })
    const snap: StreakSnapshot = featured
      ? {
          date: today,
          habit_id: featured.id,
          title: featured.title,
          streak: featured.current_streak,
          longest: featured.longest_streak,
          checked_today: done.has(`${featured.id}|${habitTodayISO(featured.reset_time, featured.tz)}`),
          days,
        }
      : { date: today, habit_id: null, title: null, streak: 0, longest: 0, checked_today: false, days }
    const key = JSON.stringify(snap)
    if (key === streakRef.current) return
    streakRef.current = key
    void pushStreakWidget(snap)
  }, [tasks, checkins])

  return null
}
