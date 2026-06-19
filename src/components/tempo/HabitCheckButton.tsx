import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useCheckIn, useStreak, useUncheckIn } from '@/lib/hooks'
import { useT } from '@/lib/i18n'

/** Streak lengths worth a one-time celebration (QW13 — Duolingo restraint: rare, earned). */
const MILESTONES = [7, 30, 100]

/**
 * The one check-in control, shared by the habit card and the task-list row.
 * Optimistic: the circle flips the instant you tap (no waiting on the check_in
 * round-trip + the streak refetch), reverts on error, and tapping again undoes
 * the check-in for a misclick. `onChange` lets a parent mirror the state for its
 * own styling (tint, today cell) without a second source of truth.
 *
 * Checking in springs the check, fires a soft haptic, and celebrates streak
 * milestones (7/30/100) once per habit — motion respects MotionConfig's
 * reduced-motion setting.
 */
export function HabitCheckButton({
  habitId,
  today,
  iconClassName = 'size-8',
  title,
  onChange,
}: {
  habitId: string
  today: string
  iconClassName?: string
  /** Habit title, used only in the milestone toast copy. */
  title?: string
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

  // Celebrate only check-ins made in this session (never on plain page load),
  // and only once the refetched streak actually reflects today.
  const justChecked = useRef(false)
  useEffect(() => {
    if (!justChecked.current || !streak) return
    if (streak.last_checkin_date !== today) return
    justChecked.current = false
    const cur = streak.current_streak
    if (!MILESTONES.includes(cur)) return
    const onceKey = `mnema:celebrated:${habitId}:${cur}`
    try {
      if (localStorage.getItem(onceKey)) return
      localStorage.setItem(onceKey, '1')
    } catch {
      /* private mode — celebrate anyway */
    }
    navigator.vibrate?.([30, 40, 30])
    toast.success(
      title
        ? t(`🔥 ${cur}-day streak on “${title}”!`, `🔥「${title}」連續 ${cur} 天!`)
        : t(`🔥 ${cur}-day streak!`, `🔥 連續 ${cur} 天!`),
      { duration: 6000 },
    )
  }, [streak, today, habitId, title, t])

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
    if (next) {
      justChecked.current = true
      navigator.vibrate?.(12)
      checkIn.mutate({ taskId: habitId, date: today }, { onError: revert })
    } else {
      justChecked.current = false
      uncheckIn.mutate({ taskId: habitId, date: today }, { onError: revert })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={checked}
      aria-label={checked ? t('Undo today’s check-in', '取消今天的打卡') : t('Check in for today', '打卡今天')}
      className="shrink-0 rounded-full outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-90"
    >
      {checked ? (
        <motion.span
          // Spring only on an in-session check (optimistic is non-null then) —
          // already-checked habits must mount statically on page load.
          initial={optimistic === true ? { scale: 0.4 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          className="inline-flex"
        >
          <CheckCircle2 className={`${iconClassName} text-brand`} />
        </motion.span>
      ) : (
        <Circle className={`${iconClassName} text-muted-foreground/40 hover:text-brand`} />
      )}
    </button>
  )
}
