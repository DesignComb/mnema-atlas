import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Home-screen widget bridge. The web app writes a compact "today" snapshot AND a
 * small auth blob into Capacitor Preferences (Android SharedPreferences
 * "CapacitorStorage"); the native TodayWidget reads both. The snapshot drives the
 * list; the auth blob lets the widget complete a task live (a direct POST to the
 * Supabase complete_task RPC) without launching the app. WidgetBridge.refresh()
 * pokes Android to redraw immediately. All no-ops on web.
 */
interface WidgetBridgePlugin {
  refresh(): Promise<void>
}
const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

/** Keys shared with the native side (TodayWidget.java / HabitsWidget.java / receivers). */
export const WIDGET_TODAY_KEY = 'widget_today'
export const WIDGET_HABITS_KEY = 'widget_habits'
export const WIDGET_AUTH_KEY = 'widget_auth'

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
  if (!Capacitor.isNativePlatform()) return
  try {
    await Preferences.set({ key: WIDGET_TODAY_KEY, value: JSON.stringify(snap) })
    await WidgetBridge.refresh().catch(() => {})
  } catch {
    // The widget is non-critical — never surface a write failure.
  }
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
  if (!Capacitor.isNativePlatform()) return
  try {
    await Preferences.set({ key: WIDGET_HABITS_KEY, value: JSON.stringify(snap) })
    await WidgetBridge.refresh().catch(() => {})
  } catch {
    // best-effort
  }
}

/**
 * Store just enough for the widget to call the Supabase RPC itself: the project
 * URL, the publishable (anon) key, and the user's current access token. The token
 * is short-lived and refreshed while the app is open; it lives only in the app's
 * private storage and is cleared on sign-out (see WidgetSync).
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
