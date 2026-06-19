import { Check, Flame, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useCheckIn, useCompleteTask, useUncheckIn } from '@/lib/hooks'
import type { TaskRow } from '@/lib/database.types'
import type { CheckInRow } from '@/lib/api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六']

/**
 * A clicked calendar day: what was checked-in / completed that day, plus the
 * ability to backfill — toggle a habit's check-in for that date, or mark an open
 * task as "done on this day". The latter is the cat-nail-trimming case: for an
 * after-completion recurring task, completing as of a past date makes the server
 * recompute the next due from that date (complete_task handles this; see 0015).
 */
export function DayDetailSheet({
  date,
  tasks,
  doneRows,
  onOpenChange,
}: {
  date: string | null
  tasks: TaskRow[]
  doneRows: CheckInRow[]
  onOpenChange: (date: string | null) => void
}) {
  const t = useT()
  const checkIn = useCheckIn()
  const uncheck = useUncheckIn()
  const complete = useCompleteTask()

  const doneIds = new Set(doneRows.map((r) => r.task_id))
  const habits = tasks.filter((x) => x.kind === 'habit')
  const openTasks = tasks.filter((x) => x.kind !== 'habit' && x.status !== 'done')
  // Task completions that landed on this day (habits are handled in their own list).
  const doneTasks = doneRows.filter((r) => r.kind !== 'habit')

  function toggleHabit(habit: TaskRow) {
    if (!date) return
    if (doneIds.has(habit.id)) uncheck.mutate({ taskId: habit.id, date })
    else checkIn.mutate({ taskId: habit.id, date })
  }

  function completeOnDay(task: TaskRow) {
    if (!date) return
    // Noon-UTC so (p_completed_at)::date lands on the chosen day server-side.
    complete.mutate(
      { taskId: task.id, completedAt: `${date}T12:00:00Z` },
      { onSuccess: () => toast.success(t('Logged for this day', '已補登到這天')) },
    )
  }

  const weekday = date ? WD_ZH[new Date(`${date}T00:00:00`).getDay()] : ''

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onOpenChange(null)}>
      <DialogContent className="sm:max-h-[85dvh]">
        {date && (
          <>
            <DialogHeader>
              <DialogTitle>
                {date} · {t('Sun Mon Tue Wed Thu Fri Sat'.split(' ')[new Date(`${date}T00:00:00`).getDay()], `週${weekday}`)}
              </DialogTitle>
              <DialogDescription>{t('What you did — and backfill anything you forgot.', '這天做了什麼 —— 忘了記的也能補登。')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Habits — tap to check in / undo for this day */}
              {habits.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Flame className="size-3.5" /> {t('Habits', '習慣')}
                  </p>
                  <div className="space-y-1">
                    {habits.map((h) => {
                      const checked = doneIds.has(h.id)
                      return (
                        <button
                          key={h.id}
                          onClick={() => toggleHabit(h)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition hover:border-brand/40 hover:bg-brand-muted/40"
                        >
                          <span
                            className={cn(
                              'grid size-5 shrink-0 place-items-center rounded-md border',
                              checked ? 'border-transparent bg-brand text-brand-foreground' : 'border-muted-foreground/40',
                            )}
                          >
                            {checked && <Check className="size-3.5" />}
                          </span>
                          <span className={cn('flex-1 text-sm', checked && 'text-muted-foreground line-through')}>{h.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Tasks completed on this day (read-only context) */}
              {doneTasks.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Check className="size-3.5" /> {t('Completed', '當天完成')}
                  </p>
                  <div className="space-y-1">
                    {doneTasks.map((r) => (
                      <div key={r.task_id} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2 text-sm text-muted-foreground">
                        <Check className="size-4 shrink-0 text-brand" />
                        <span className="line-through">{r.title}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Backfill: mark an open task done on this day */}
              {openTasks.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ListChecks className="size-3.5" /> {t('Mark a task done on this day', '補登任務完成於這天')}
                  </p>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {openTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => completeOnDay(task)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left text-sm transition hover:border-brand/40 hover:bg-brand-muted/40"
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-md border border-muted-foreground/40" />
                        <span className="flex-1">{task.title}</span>
                        {task.recurrence_rule && task.recurrence_after_completion ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{t('recomputes next', '重算下次')}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
