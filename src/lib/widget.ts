import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Home-screen widget bridge. The web app writes compact snapshots AND a small
 * auth blob into Capacitor Preferences (Android SharedPreferences
 * "CapacitorStorage"); the native widgets read them. The snapshots drive the
 * widget UIs; the auth blob lets the widget complete a task live (a direct POST
 * to the Supabase complete_task RPC) without launching the app.
 * WidgetBridge.refresh() pokes Android to redraw immediately. All no-ops on web.
 */
interface WidgetBridgePlugin {
  refresh(): Promise<void>
}
const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

/** Keys shared with the native side (TodayWidget.java / HabitsWidget.java / receivers). */
export const WIDGET_TODAY_KEY = 'widget_today'
export const WIDGET_HABITS_KEY = 'widget_habits'
export const WIDGET_AUTH_KEY = 'widget_auth'
export const WIDGET_LANG_KEY = 'widget_lang'
export const WIDGET_JOURNAL_KEY = 'widget_journal'
export const WIDGET_CALENDAR_KEY = 'widget_calendar'
export const WIDGET_STREAK_KEY = 'widget_streak'

/**
 * refresh() redraws ALL widgets at once, so one sync pass writing several keys
 * back-to-back must not trigger N redraws. Each successful write schedules a
 * trailing debounced refresh: the burst settles, then Android redraws once.
 */
let refreshTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRefresh(): void {
  if (refreshTimer != null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void WidgetBridge.refresh().catch(() => {})
  }, 50)
}

/** Write one Preferences key then coalesce into a single widget redraw. */
async function setKey(key: string, value: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Preferences.set({ key, value })
    scheduleRefresh()
  } catch {
    // The widget is non-critical — never surface a write failure.
  }
}

export interface WidgetTask {
  /** Task id — the widget passes this to complete_task. */
  id: string
  title: string
  /** Short context line: 逾期 / 今天 / a date. */
  sub: string
}
export interface TodaySnapshot {
  date: string
  count: number
  items: WidgetTask[]
}

export async function pushTodayWidget(snap: TodaySnapshot): Promise<void> {
  await setKey(WIDGET_TODAY_KEY, JSON.stringify(snap))
}

export interface WidgetHabit {
  id: string
  title: string
  /** Whether the habit is checked in for its (reset-aware) today. */
  checked: boolean
}
export interface HabitsSnapshot {
  date: string
  items: WidgetHabit[]
}

/** Today's habits + checked state for the habit widget; tapping toggles check_in. */
export async function pushHabitsWidget(snap: HabitsSnapshot): Promise<void> {
  await setKey(WIDGET_HABITS_KEY, JSON.stringify(snap))
}

/** Today's journal entry (or its absence) for the journal widget. */
export interface JournalSnapshot {
  date: string
  has_entry: boolean
  mood: number | null
  energy: number | null
  /** Entry body, markdown crudely stripped, max 120 chars; "" when no entry. */
  snippet: string
}

export async function pushJournalWidget(snap: JournalSnapshot): Promise<void> {
  await setKey(WIDGET_JOURNAL_KEY, JSON.stringify(snap))
}

/** One agenda row in the calendar widget. */
export interface CalendarAgendaItem {
  /** Task id — the widget's check circle completes it via TaskActionReceiver. */
  id: string
  title: string
  /** "HH:mm" or null = all-day. */
  hm: string | null
}
/**
 * TickTick-style calendar widget data: open tasks per day (every dated open
 * task, not just the current month — the widget can page months natively) +
 * public-holiday names. Selection/month state lives on the native side.
 */
export interface CalendarSnapshot {
  date: string
  /** YYYY-MM-DD → that day's open tasks (timed first, then all-day). */
  days: Record<string, CalendarAgendaItem[]>
  /** YYYY-MM-DD → holiday name (mirrors the in-app calendar's TW set). */
  holidays: Record<string, string>
}

export async function pushCalendarWidget(snap: CalendarSnapshot): Promise<void> {
  await setKey(WIDGET_CALENDAR_KEY, JSON.stringify(snap))
}

export interface StreakDay {
  d: string
  c: boolean
}
/** The featured habit (highest current streak) + 28-day history for the streak widget. */
export interface StreakSnapshot {
  date: string
  /** Featured habit's task id — HabitActionReceiver patches this snapshot when the same habit is toggled from the Habits widget. */
  habit_id: string | null
  /** null when the user has no habits. */
  title: string | null
  streak: number
  longest: number
  /** Reset-aware, same as the habits widget's checked state. */
  checked_today: boolean
  /** Exactly 28 entries, oldest first, ending today. */
  days: StreakDay[]
}

export async function pushStreakWidget(snap: StreakSnapshot): Promise<void> {
  await setKey(WIDGET_STREAK_KEY, JSON.stringify(snap))
}

/** The app language, stored RAW (not JSON) — e.g. "en" / "zh". */
export async function pushWidgetLang(lang: string): Promise<void> {
  await setKey(WIDGET_LANG_KEY, lang)
}

/**
 * Store just enough for the widget to call the Supabase RPC itself: the project
 * URL, the publishable (anon) key, and the user's current access token. The token
 * is short-lived and refreshed while the app is open; it lives only in the app's
 * private storage and is cleared on sign-out (see WidgetSync). No redraw — auth
 * is never rendered.
 */
export async function pushWidgetAuth(token: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (!token) {
      await Preferences.remove({ key: WIDGET_AUTH_KEY })
      return
    }
    await Preferences.set({
      key: WIDGET_AUTH_KEY,
      value: JSON.stringify({
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        token,
      }),
    })
  } catch {
    // best-effort
  }
}
