import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useScheduleTask } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskRow } from '@/lib/database.types'
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
  yearOf,
} from '@/lib/tempo-date'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WD_ZH = ['一', '二', '三', '四', '五', '六', '日']
const START_HOUR = 6
const END_HOUR = 23
const HOUR_PX = 44

/** A task's calendar date: scheduled wins, then due, then next recurrence. */
function dateOf(task: TaskRow): string | null {
  return task.scheduled_date || task.due_date || task.next_occurrence || null
}

type Mode = 'month' | 'week' | 'agenda'

export function CalendarView({ tasks, onEdit }: { tasks: TaskRow[]; onEdit: (t: TaskRow) => void }) {
  const t = useT()
  const schedule = useScheduleTask()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(todayISO())
  const today = todayISO()

  const dated = tasks.filter((x) => dateOf(x))
  const byDate = new Map<string, TaskRow[]>()
  for (const task of dated) {
    const d = dateOf(task)!
    const arr = byDate.get(d) ?? []
    arr.push(task)
    byDate.set(d, arr)
  }

  function shift(n: number) {
    if (mode === 'week') setCursor(addDays(cursor, n * 7))
    else setCursor(addDays(cursor, n * 30))
  }

  const title =
    mode === 'week'
      ? (() => {
          const s = startOfWeek(cursor)
          return `${t(MONTHS_EN[monthOf(s)], `${monthOf(s) + 1}月`)} ${dayNum(s)}–${dayNum(addDays(s, 6))}`
        })()
      : `${t(MONTHS_EN[monthOf(cursor)], `${monthOf(cursor) + 1}月`)} ${yearOf(cursor)}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-md p-1 text-muted-foreground transition hover:bg-card hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-32 text-center text-[14px] font-semibold">{title}</span>
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
        <div className="flex items-center gap-1">
          {(['month', 'week', 'agenda'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium transition ${
                mode === m ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground'
              }`}
            >
              {t(m === 'month' ? 'Month' : m === 'week' ? 'Week' : 'Agenda', m === 'month' ? '月' : m === 'week' ? '週' : '議程')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' ? (
        <MonthGrid cursor={cursor} byDate={byDate} today={today} t={t} onEdit={onEdit} />
      ) : mode === 'week' ? (
        <WeekGrid
          cursor={cursor}
          tasks={tasks}
          today={today}
          t={t}
          onEdit={onEdit}
          onSchedule={(taskId, date, time, dur) =>
            schedule.mutate({ task_id: taskId, scheduled_date: date, scheduled_time: time, duration_min: dur })
          }
        />
      ) : (
        <Agenda cursor={cursor} byDate={byDate} today={today} t={t} onEdit={onEdit} />
      )}
    </div>
  )
}

type Tr = (en: string, zh: string) => string

function MonthGrid({
  cursor,
  byDate,
  today,
  t,
  onEdit,
}: {
  cursor: string
  byDate: Map<string, TaskRow[]>
  today: string
  t: Tr
  onEdit: (t: TaskRow) => void
}) {
  const days = monthGrid(yearOf(cursor), monthOf(cursor))
  const curMonth = monthOf(cursor)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WD_EN.map((d, i) => (
          <div key={d} className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
            {t(d, WD_ZH[i])}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = monthOf(d) === curMonth
          const items = byDate.get(d) ?? []
          const isToday = d === today
          return (
            <div
              key={d}
              className={`min-h-[5.5rem] border-b border-r border-border/60 p-1 ${inMonth ? '' : 'bg-muted/20'}`}
            >
              <div className="mb-0.5 flex justify-end">
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] ${
                    isToday ? 'bg-brand font-semibold text-brand-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  {dayNum(d)}
                </span>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onEdit(task)}
                    className="block w-full truncate rounded bg-brand-muted px-1.5 py-0.5 text-left text-[11px] text-brand"
                  >
                    {task.scheduled_time ? `${task.scheduled_time.slice(0, 5)} ` : ''}
                    {task.title}
                  </button>
                ))}
                {items.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3}</p>
                ) : null}
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
  today,
  t,
  onEdit,
}: {
  cursor: string
  byDate: Map<string, TaskRow[]>
  today: string
  t: Tr
  onEdit: (t: TaskRow) => void
}) {
  const start = cursor < today ? today : cursor
  const days = Array.from({ length: 30 }, (_, i) => addDays(start, i)).filter((d) => byDate.has(d))
  if (!days.length) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted-foreground">{t('Nothing scheduled in the next 30 days.', '未來 30 天沒有排程。')}</p>
  }
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <div key={d}>
          <p className="mb-1 text-[12px] font-semibold text-muted-foreground">
            {d === today ? t('Today', '今天') : d} · {t(WD_EN[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7], WD_ZH[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7])}
          </p>
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
        </div>
      ))}
    </div>
  )
}

function WeekGrid({
  cursor,
  tasks,
  today,
  t,
  onEdit,
  onSchedule,
}: {
  cursor: string
  tasks: TaskRow[]
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
      const minsFromTop = ((e.clientY - rect.top) / HOUR_PX) * 60
      let mins = START_HOUR * 60 + minsFromTop
      mins = Math.round(mins / 15) * 15 // snap 15 min
      onSchedule(task.id, days[col], minToTime(mins), task.duration_min ?? 60)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag, days, onSchedule])

  return (
    <div className="select-none">
      {/* Unscheduled rail */}
      {unscheduled.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-dashed border-border p-2">
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

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Day headers */}
          <div className="grid" style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}>
            <div />
            {days.map((d, i) => (
              <div key={d} className="px-1 py-1 text-center">
                <div className="text-[11px] text-muted-foreground">{t(WD_EN[i], WD_ZH[i])}</div>
                <div
                  className={`text-[13px] font-semibold ${d === today ? 'text-brand' : 'text-foreground'}`}
                >
                  {dayNum(d)}
                </div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid" style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}>
            {/* hour gutter */}
            <div>
              {hours.map((h) => (
                <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-1.5 right-1 text-[10px] text-muted-foreground">{h}:00</span>
                </div>
              ))}
            </div>
            {/* day columns + blocks live in one positioned grid */}
            <div
              ref={gridRef}
              className="relative col-span-7 grid"
              style={{ gridTemplateColumns: 'repeat(7, 1fr)', height: hours.length * HOUR_PX }}
            >
              {days.map((d) => (
                <div key={d} className="relative border-l border-border/60">
                  {hours.map((h) => (
                    <div key={h} className="border-b border-border/40" style={{ height: HOUR_PX }} />
                  ))}
                </div>
              ))}
              {/* blocks */}
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
                      className="absolute touch-none overflow-hidden rounded-md border border-brand/30 bg-brand-muted px-1.5 py-0.5 text-left text-[11px] text-brand active:cursor-grabbing"
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

      {/* Drag ghost */}
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
