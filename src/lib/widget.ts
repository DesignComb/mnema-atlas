import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Home-screen widget bridge. The web app writes a compact "today" snapshot into
 * Capacitor Preferences (Android SharedPreferences "CapacitorStorage"), and the
 * native TodayWidget reads that same store — so the widget needs no network and
 * no auth token of its own. WidgetBridge.refresh() pokes Android to redraw the
 * widget immediately after we write (otherwise it only refreshes on its ~30-min
 * cycle). No-ops on web.
 */
interface WidgetBridgePlugin {
  refresh(): Promise<void>
}
const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

/** Key shared with TodayWidget.java — keep in sync. */
export const WIDGET_TODAY_KEY = 'widget_today'

export interface WidgetTask {
  title: string
  /** Short context line: 逾期 / 今天 / a date. */
  sub: string
}
export interface TodaySnapshot {
  /** YYYY-MM-DD the snapshot was built for. */
  date: string
  /** Total count of today's open tasks (may exceed items.length). */
  count: number
  /** The first few tasks to show, already sorted. */
  items: WidgetTask[]
}

export async function pushTodayWidget(snap: TodaySnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Preferences.set({ key: WIDGET_TODAY_KEY, value: JSON.stringify(snap) })
    await WidgetBridge.refresh().catch(() => {})
  } catch {
    // The widget is non-critical — never let a write failure surface to the user.
  }
}
