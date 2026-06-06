import { useEffect, useState } from 'react'
import { CheckCircle2, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useStreak } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskRow } from '@/lib/database.types'
import { formatResetTime, shortRecurrenceLabel } from '@/lib/recurrence'
import { HabitCheckButton } from './HabitCheckButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const WD = ['日', '一', '二', '三', '四', '五', '六']
const WD_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}
function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function HabitCard({
  habit,
  today,
  onEdit,
  onDelete,
}: {
  habit: TaskRow
  today: string
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useT()
  const { data: streak } = useStreak(habit.id)
  const done = new Set(streak?.calendar ?? [])
  // `shown` mirrors the check button's optimistic state so the card tint + today
  // cell flip instantly too; it clears once the streak refetches.
  const [shown, setShown] = useState<boolean | null>(null)
  const checkedToday = shown ?? done.has(today)
  useEffect(() => setShown(null), [streak?.calendar])

  const current = streak?.current_streak ?? habit.current_streak
  const longest = streak?.longest_streak ?? habit.longest_streak
  // Last 14 days, oldest → newest, for the don't-break-the-chain strip.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))

  const recur = shortRecurrenceLabel(habit.recurrence_rule, t)
  const reset = formatResetTime(habit.reset_time)

  return (
    <div
      className={`rounded-xl border p-3.5 shadow-soft transition-colors sm:p-4 ${
        checkedToday ? 'border-brand/40 bg-brand-muted/25' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium text-foreground">{habit.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            {checkedToday ? (
              <>
                <span className="inline-flex items-center gap-1 font-medium text-brand">
                  <CheckCircle2 className="size-3.5" /> {t('done today', '今天已完成')}
                </span>
                <span>·</span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-1 text-orange-500">
              <Flame className="size-3.5" /> {current}
            </span>
            <span>·</span>
            <span>{t(`best ${longest}`, `最佳 ${longest}`)}</span>
            {recur ? (
              <>
                <span>·</span>
                <span>{recur}</span>
              </>
            ) : null}
            {reset ? (
              <>
                <span>·</span>
                <span>{t(`resets ${reset}`, `重置 ${reset}`)}</span>
              </>
            ) : null}
          </p>
        </button>
        <HabitCheckButton habitId={habit.id} today={today} iconClassName="size-8" onChange={setShown} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={t('Habit options', '習慣選項')}>
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {t('Edit', '編輯')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive [&_svg]:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 /> {t('Delete', '刪除')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-end justify-between gap-0.5">
        {days.map((d) => {
          const on = d === today ? checkedToday : done.has(d)
          const isToday = d === today
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <span
                title={d}
                className={`h-6 w-full rounded-sm transition ${
                  on ? 'bg-brand' : 'bg-muted'
                } ${isToday ? 'ring-2 ring-brand/40' : ''}`}
              />
              <span className="text-[9px] text-muted-foreground/70">{t(WD_EN[weekday(d)], WD[weekday(d)])}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
