import type { TaskRow } from './database.types'

/**
 * The one "is this task part of today" predicate (audit QW9) — shared by the
 * Today screen and the Android widget (WidgetSync) so they can never disagree.
 */
export function isDueToday(t: TaskRow, today: string): boolean {
  return t.kind !== 'habit' && ((t.due_date != null && t.due_date <= today) || t.scheduled_date === today)
}

function cmpDate(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : 1
}

/** Today's tasks, most urgent first (priority desc, then due date, then manual order). */
export function todayTasks(tasks: TaskRow[], today: string): TaskRow[] {
  return tasks
    .filter((t) => isDueToday(t, today))
    .sort((a, b) => b.priority - a.priority || cmpDate(a.due_date, b.due_date) || a.sort_order - b.sort_order)
}

/** Calm time-of-day greeting for the Today header. */
export function greeting(lang: 'en' | 'zh', hour: number = new Date().getHours()): string {
  if (hour < 5) return lang === 'zh' ? '夜深了' : 'Up late'
  if (hour < 12) return lang === 'zh' ? '早安' : 'Good morning'
  if (hour < 18) return lang === 'zh' ? '午安' : 'Good afternoon'
  return lang === 'zh' ? '晚安' : 'Good evening'
}
