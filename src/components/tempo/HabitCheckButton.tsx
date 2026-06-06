import { useEffect, useState, type MouseEvent } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { useCheckIn, useStreak, useUncheckIn } from '@/lib/hooks'
import { useT } from '@/lib/i18n'

/**
 * The one check-in control, shared by the habit card and the task-list row.
 * Optimistic: the circle flips the instant you tap (no waiting on the check_in
 * round-trip + the streak refetch), reverts on error, and tapping again undoes
 * the check-in for a misclick. `onChange` lets a parent mirror the state for its
 * own styling (tint, today cell) without a second source of truth.
 */
export function HabitCheckButton({
  habitId,
  today,
  iconClassName = 'size-8',
  onChange,
}: {
  habitId: string
  today: string
  iconClassName?: string
  onChange?: (checked: boolean) => void
}) {
  const t = useT()
  const { data: streak } = useStreak(habitId)
  const checkIn = useCheckIn()
  const uncheckIn = useUncheckIn()

  const serverChecked = (streak?.calendar ?? []).includes(today)
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const checked = optimistic ?? serverChecked

  // Drop the optimistic override once the server agrees.
  useEffect(() => {
    if (optimistic !== null && optimistic === serverChecked) setOptimistic(null)
  }, [optimistic, serverChecked])

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const next = !checked
    setOptimistic(next)
    onChange?.(next)
    const revert = () => {
      setOptimistic(null)
      onChange?.(serverChecked)
      toast.error(t('Could not save — try again', '無法儲存，請再試一次'))
    }
    if (next) checkIn.mutate({ taskId: habitId, date: today }, { onError: revert })
    else uncheckIn.mutate({ taskId: habitId, date: today }, { onError: revert })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={checked}
      aria-label={checked ? t('Undo today’s check-in', '取消今天的打卡') : t('Check in for today', '打卡今天')}
      className="shrink-0 transition-transform duration-150 hover:scale-105 active:scale-90"
    >
      {checked ? (
        <CheckCircle2 className={`${iconClassName} text-brand`} />
      ) : (
        <Circle className={`${iconClassName} text-muted-foreground/40 hover:text-brand`} />
      )}
    </button>
  )
}
