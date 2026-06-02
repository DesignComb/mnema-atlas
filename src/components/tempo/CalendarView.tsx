import { useEffect, useRef, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScheduleTask } from '@/lib/hooks'
import { useHolidays } from '@/lib/holidays'
import { useT } from '@/lib/i18n'
import type { TaskRow } from '@/lib/database.types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  addDays,
  dayNum,
  minToTime,
  monthGrid,
  monthOf,
  startOfWeek,
  timeToMin,
  todayISO,
  weekDays,
  weekday,
  yearOf,
} from '@/lib/tempo-date'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Week starts Sunday.
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六']
const START_HOUR = 6
const END_HOUR = 23
const HOUR_PX = 44
const EMPTY: Map<string, string> = new Map()

function dateOf(task: TaskRow): string | null {
  return task.scheduled_date || task.due_date || task.next_occurrence || null
}
const isWeekend = (iso: string) => weekday(iso) === 0 || weekday(iso) === 6
/** Sunday red, Saturday blue, holiday red — the common CJK calendar convention. */
function numClass(iso: string, holiday: boolean): string {
  if (holiday || weekday(iso) === 0) return 'text-red-500'
  if (weekday(iso) === 6) return 'text-blue-500'
  return 'text-foreground'
}

type Mode = 'month' | 'week' | 'agenda'
type Tr = (en: string, zh: string) => string

export function CalendarView({ tasks, onEdit }: { tasks: TaskRow[]; onEdit: (t: TaskRow) => void }) {
  const t = useT()
  const schedule = useScheduleTask()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(todayISO())
  const [showHolidays, setShowHolidays] = useState(() => {
    try {
      return localStorage.getItem('mnema-show-holidays') !== '0'
    } catch {
      return true
    }
  })
  const [showTasks, setShowTasks] = useState(() => {
    try {
      return localStorage.getItem('mnema-show-tasks') !== '0'
    } catch {
      return true
    }
  })
  const today = todayISO()

  function toggleTasks() {
    setShowTasks((v) => {
      const n = !v
      try {
        localStorage.setItem('mnema-show-tasks', n ? '1' : '0')
      } catch {
        /* ignore */
      }
      return n
    })
  }

  const years = [yearOf(cursor) - 1, yearOf(cursor), yearOf(cursor) + 1]
  const { data: holidaysData } = useHolidays(years, 'TW', showHolidays)
  const holidays = showHolidays ? holidaysData ?? EMPTY : EMPTY

  function toggleHolidays() {
    setShowHolidays((v) => {
      const n = !v
      try {
        localStorage.setItem('mnema-show-holidays', n ? '1' : '0')
      } catch {
        /* ignore */
      }
      return n
    })
  }

  const visibleTasks = showTasks ? tasks : []
  const dated = visibleTasks.filter((x) => dateOf(x))
  const byDate = new Map<string, TaskRow[]>()
  for (const task of dated) {
    const d = dateOf(task)!
    const arr = byDate.get(d) ?? []
    arr.push(task)
    byDate.set(d, arr)
  }

  function shift(n: number) {
    setCursor(addDays(cursor, n * (mode === 'week' ? 7 : 30)))
  }

  const title =
    mode === 'week'
      ? (() => {
          const s = startOfWeek(cursor)
          return `${t(MONTHS_EN[monthOf(s)], `${monthOf(s) + 1}月`)} ${dayNum(s)}–${dayNum(addDays(s, 6))}`
        })()
      : `${t(MONTHS_EN[monthOf(cursor)], `${monthOf(cursor) + 1}月`)} ${yearOf(cursor)}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-md p-1 text-muted-foreground transition hover:bg-card hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-28 text-center text-[14px] font-semibold sm:min-w-36">{title}</span>
          <button onClick={() => shift(1)} className="rounded-md p-1 text-muted-foreground transition hover:bg-card hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setCursor(today)}
            className="ml-1 rounded-md border border-border px-2 py-0.5 text-[12px] text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
          >
            {t('Today', '今天')}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition hover:text-foreground">
                <CalendarRange className="size-3.5" /> {t('Calendars', '行事曆')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t('Shown calendars', '顯示的行事曆')}</DropdownMenuLabel>
              <DropdownMenuItem
                className="gap-2.5"
                onSelect={(e) => {
                  e.preventDefault()
                  toggleTasks()
                }}
              >
                <span
                  className={`size-4 shrink-0 rounded-[5px] border ${showTasks ? 'border-transparent bg-brand' : 'border-muted-foreground/40'}`}
                />
                <span className="flex-1">{t('Tasks', '任務')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5"
                onSelect={(e) => {
                  e.preventDefault()
                  toggleHolidays()
                }}
              >
                <span
                  className={`size-4 shrink-0 rounded-[5px] border ${showHolidays ? 'border-transparent bg-red-500' : 'border-muted-foreground/40'}`}
                />
                <span className="flex-1">{t('Holidays · Taiwan', '國定假日 · 台灣')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center rounded-full bg-muted/60 p-0.5">
            {(['month', 'week', 'agenda'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium transition ${
                  mode === m ? 'bg-brand text-brand-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(m === 'month' ? 'Month' : m === 'week' ? 'Week' : 'Agenda', m === 'month' ? '月' : m === 'week' ? '週' : '議程')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'month' ? (
          <MonthGrid cursor={cursor} byDate={byDate} holidays={holidays} today={today} t={t} onEdit={onEdit} />
        ) : (
          <div className="h-full overflow-y-auto pb-1">
            {mode === 'week' ? (
              <WeekGrid
                cursor={cursor}
                tasks={visibleTasks}
                holidays={holidays}
                today={today}
                t={t}
                onEdit={onEdit}
                onSchedule={(taskId, date, time, dur) =>
                  schedule.mutate({ task_id: taskId, scheduled_date: date, scheduled_time: time, duration_min: dur })
                }
              />
            ) : (
              <Agenda cursor={cursor} byDate={byDate} holidays={holidays} today={today} t={t} onEdit={onEdit} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MonthGrid({
  cursor,
  byDate,
  holidays,
  today,
  t,
  onEdit,
}: {
  cursor: string
  byDate: Map<string, TaskRow[]>
  holidays: Map<string, string>
  today: string
  t: Tr
  onEdit: (t: TaskRow) => void
}) {
  const days = monthGrid(yearOf(cursor), monthOf(cursor))
  const curMonth = monthOf(cursor)
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="grid shrink-0 grid-cols-7">
        {WD_EN.map((d, i) => (
          <div
            key={d}
            className={`px-2 py-1.5 text-center text-[11px] font-semibold ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
            }`}
          >
            {t(d, WD_ZH[i])}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const inMonth = monthOf(d) === curMonth
          const items = byDate.get(d) ?? []
          const isToday = d === today
          const holiday = holidays.get(d)
          return (
            <div
              key={d}
              className={`flex min-h-0 flex-col overflow-hidden border-t border-r border-border/40 p-1 transition hover:bg-muted/30 ${
                isWeekend(d) ? 'bg-muted/20' : ''
              } ${inMonth ? '' : 'opacity-45'}`}
            >
              <div className="mb-0.5 flex shrink-0 items-center justify-between gap-1">
                {holiday ? (
                  <span className="truncate text-[10px] font-medium text-red-500" title={holiday}>
                    {holiday}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                    isToday ? 'bg-brand text-brand-foreground' : numClass(d, Boolean(holiday))
                  }`}
                >
                  {dayNum(d)}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onEdit(task)}
                    className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] text-foreground transition hover:bg-brand-muted"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                    {task.scheduled_time ? <span className="shrink-0 tabular-nums text-muted-foreground">{task.scheduled_time.slice(0, 5)}</span> : null}
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {items.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Agenda({
  cursor,
  byDate,
  holidays,
  today,
  t,
  onEdit,
}: {
  cursor: string
  byDate: Map<string, TaskRow[]>
  holidays: Map<string, string>
  today: string
  t: Tr
  onEdit: (t: TaskRow) => void
}) {
  const start = cursor < today ? today : cursor
  const days = Array.from({ length: 30 }, (_, i) => addDays(start, i)).filter((d) => byDate.has(d) || holidays.has(d))
  if (!days.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted-foreground">
        {t('Nothing scheduled in the next 30 days.', '未來 30 天沒有排程。')}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const wdIdx = weekday(d) // 0=Sun … 6=Sat
        const holiday = holidays.get(d)
        return (
          <div key={d}>
            <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold">
              <span className={numClass(d, Boolean(holiday))}>
                {d === today ? t('Today', '今天') : d} · {t(WD_EN[wdIdx], WD_ZH[wdIdx])}
              </span>
              {holiday ? <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-500">{holiday}</span> : null}
            </p>
            {(byDate.get(d) ?? []).length ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                {(byDate.get(d) ?? [])
                  .slice()
                  .sort((a, b) => (timeToMin(a.scheduled_time) ?? 1e9) - (timeToMin(b.scheduled_time) ?? 1e9))
                  .map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onEdit(task)}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="w-12 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {task.scheduled_time ? task.scheduled_time.slice(0, 5) : '—'}
                      </span>
                      <span className="truncate text-[14px] text-foreground">{task.title}</span>
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function WeekGrid({
  cursor,
  tasks,
  holidays,
  today,
  t,
  onEdit,
  onSchedule,
}: {
  cursor: string
  tasks: TaskRow[]
  holidays: Map<string, string>
  today: string
  t: Tr
  onEdit: (t: TaskRow) => void
  onSchedule: (taskId: string, date: string, time: string, dur: number) => void
}) {
  const days = weekDays(cursor)
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ task: TaskRow; x: number; y: number } | null>(null)

  const unscheduled = tasks.filter((x) => !x.scheduled_date)
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  // Current-time indicator (only when this week contains today).
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showNow = days.includes(today) && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60
  const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_PX

  useEffect(() => {
    if (!drag) return
    function move(e: PointerEvent) {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    }
    function up(e: PointerEvent) {
      const grid = gridRef.current
      const task = drag!.task
      setDrag(null)
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return
      const col = Math.min(6, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 7)))
      let mins = START_HOUR * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60
      mins = Math.round(mins / 15) * 15
      onSchedule(task.id, days[col], minToTime(mins), task.duration_min ?? 60)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag, days, onSchedule])

  const allDayByDay = days.map((d) => tasks.filter((x) => x.scheduled_date === d && !x.scheduled_time))

  return (
    <div className="select-none">
      {unscheduled.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-dashed border-border p-2">
          <span className="self-center text-[11px] font-medium text-muted-foreground">{t('Drag onto a slot:', '拖到時段:')}</span>
          {unscheduled.slice(0, 12).map((task) => (
            <button
              key={task.id}
              onPointerDown={(e) => {
                e.preventDefault()
                setDrag({ task, x: e.clientX, y: e.clientY })
              }}
              className="cursor-grab touch-none rounded-md border border-border bg-card px-2 py-1 text-[12px] text-foreground active:cursor-grabbing"
            >
              {task.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <div className="min-w-[580px]">
          {/* Day headers */}
          <div className="grid border-b border-border/60" style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}>
            <div />
            {days.map((d, i) => {
              const holiday = holidays.get(d)
              return (
                <div key={d} className={`px-1 py-1.5 text-center ${isWeekend(d) ? 'bg-muted/30' : ''}`}>
                  <div className={`text-[11px] ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {t(WD_EN[i], WD_ZH[i])}
                  </div>
                  <div
                    className={`mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-[13px] font-semibold ${
                      d === today ? 'bg-brand text-brand-foreground' : numClass(d, Boolean(holiday))
                    }`}
                  >
                    {dayNum(d)}
                  </div>
                  {holiday ? <div className="mt-0.5 truncate text-[9px] text-red-500" title={holiday}>{holiday}</div> : null}
                </div>
              )
            })}
          </div>

          {/* All-day row (holidays + untimed scheduled tasks) */}
          {allDayByDay.some((a) => a.length) ? (
            <div className="grid border-b border-border/60" style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}>
              <div className="py-1 pr-1 text-right text-[9px] text-muted-foreground/70">{t('all-day', '整天')}</div>
              {days.map((d, i) => (
                <div key={d} className={`space-y-0.5 p-0.5 ${isWeekend(d) ? 'bg-muted/20' : ''}`}>
                  {allDayByDay[i].map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onEdit(task)}
                      className="block w-full truncate rounded bg-brand-muted px-1 py-0.5 text-left text-[10px] text-brand"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {/* Time grid */}
          <div className="grid" style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-1.5 right-1 text-[10px] text-muted-foreground">{h}:00</span>
                </div>
              ))}
            </div>
            <div
              ref={gridRef}
              className="relative col-span-7 grid"
              style={{ gridTemplateColumns: 'repeat(7, 1fr)', height: hours.length * HOUR_PX }}
            >
              {days.map((d) => (
                <div key={d} className={`relative border-l border-border/40 ${isWeekend(d) ? 'bg-muted/20' : ''}`}>
                  {hours.map((h) => (
                    <div key={h} className="border-b border-border/30" style={{ height: HOUR_PX }} />
                  ))}
                </div>
              ))}

              {showNow ? (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                  <span className="size-2 -ml-1 rounded-full bg-red-500" />
                  <span className="h-px flex-1 bg-red-500/70" />
                </div>
              ) : null}

              {tasks
                .filter((x) => x.scheduled_date && days.includes(x.scheduled_date) && x.scheduled_time)
                .map((task) => {
                  const col = days.indexOf(task.scheduled_date!)
                  const startMin = timeToMin(task.scheduled_time)!
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX
                  const height = Math.max(18, ((task.duration_min ?? 60) / 60) * HOUR_PX - 2)
                  if (top < -HOUR_PX) return null
                  return (
                    <button
                      key={task.id}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setDrag({ task, x: e.clientX, y: e.clientY })
                      }}
                      onClick={() => onEdit(task)}
                      className="absolute touch-none overflow-hidden rounded-md border border-brand/30 bg-brand-muted px-1.5 py-0.5 text-left text-[11px] text-brand shadow-sm active:cursor-grabbing"
                      style={{
                        left: `calc(${(col / 7) * 100}% + 2px)`,
                        width: `calc(${100 / 7}% - 4px)`,
                        top: Math.max(0, top),
                        height,
                      }}
                    >
                      <span className="font-medium">{task.scheduled_time!.slice(0, 5)}</span> {task.title}
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      </div>

      {drag ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-brand bg-brand-muted px-2 py-1 text-[12px] text-brand shadow-pop"
          style={{ left: drag.x + 8, top: drag.y + 8 }}
        >
          {drag.task.title}
        </div>
      ) : null}
    </div>
  )
}
