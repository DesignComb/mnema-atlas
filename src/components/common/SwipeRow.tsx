import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react'

import { cn } from '@/lib/utils'

/**
 * Swipe-to-act row (Things 3 / Apple Mail style), touch devices only.
 *
 * - Swipe RIGHT reveals `right` (the positive action: complete / check / reopen).
 * - Swipe LEFT reveals `left` (the destructive/secondary action: delete / dismiss).
 * - The reveal layer brightens and its icon pops as the finger crosses the
 *   trigger threshold, with a small haptic tick. Releasing past it commits:
 *   `commit: 'snap'` fires the action and springs the row back (complete-style),
 *   `commit: 'exit'` flings the row off first, then fires (delete-style — pair
 *   with the undoable-delete flow, which hides the row synchronously).
 * - Desktop / fine pointers render a static wrapper with the same DOM shape:
 *   mouse users keep the existing hover/menu affordances, and swipe is only an
 *   enhancement — every action must stay reachable via the row's own controls.
 * - Styling contract (the "borders tear" gotcha): borders/rounded corners go on
 *   THIS component's `className` (or a wrapper outside it), never on the moving
 *   content. The outer div is `overflow-hidden` so the reveal layer clips to
 *   the row's corners; `contentClassName` (default `bg-card`) keeps the moving
 *   surface opaque so the action color never bleeds through at rest.
 */
export interface SwipeAction {
  icon: ReactNode
  /** Short, localized label rendered under the icon. */
  label: string
  /** Reveal-layer colors, e.g. `bg-success text-success-foreground`. */
  className: string
  onTrigger: () => void
  /** 'snap' (default for right) returns the row; 'exit' (default for left) flings it off. */
  commit?: 'snap' | 'exit'
}

/** Finger travel (px) that arms the action — also capped at 35% of row width on release. */
const TRIGGER = 96
/** Extra elastic travel allowed past the trigger before the drag constraint bites. */
const OVERDRAG = 32

const coarseMq = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null
function subscribeCoarse(onChange: () => void) {
  coarseMq?.addEventListener('change', onChange)
  return () => coarseMq?.removeEventListener('change', onChange)
}
/** True on touch-primary devices — the only place swipe gestures activate. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, () => coarseMq?.matches ?? false, () => false)
}

export function SwipeRow({
  children,
  right,
  left,
  disabled,
  className,
  contentClassName = 'bg-card',
}: {
  children: ReactNode
  /** Revealed by swiping right → (anchored at the row's left edge). */
  right?: SwipeAction
  /** Revealed by swiping left ← (anchored at the row's right edge). */
  left?: SwipeAction
  disabled?: boolean
  /** Outer wrapper — put borders / rounded corners / shadows here. */
  className?: string
  /** The moving surface — must be opaque (default `bg-card`). */
  contentClassName?: string
}) {
  const coarse = useCoarsePointer()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [exiting, setExiting] = useState(false)
  const armedRef = useRef<'left' | 'right' | null>(null)
  // Suppresses the synthetic click some browsers fire right after a drag, so
  // finishing a swipe over a button/row never also "taps" it.
  const draggedRef = useRef(false)

  // Reveal layers fade in fast, then hit full strength at the trigger point.
  const rightOpacity = useTransform(x, [0, 12, TRIGGER], [0, 0.55, 1])
  const leftOpacity = useTransform(x, [-TRIGGER, -12, 0], [1, 0.55, 0])
  // The icon grows toward the threshold and pops past it (transform-only).
  const rightScale = useTransform(x, [0, TRIGGER, TRIGGER + OVERDRAG], [0.7, 1, 1.18])
  const leftScale = useTransform(x, [-(TRIGGER + OVERDRAG), -TRIGGER, 0], [1.18, 1, 0.7])

  useMotionValueEvent(x, 'change', (v) => {
    const armed = v >= TRIGGER ? 'right' : v <= -TRIGGER ? 'left' : null
    if (armed !== armedRef.current) {
      if (armed) navigator.vibrate?.(10) // haptic tick on crossing the threshold
      armedRef.current = armed
    }
  })

  // Desktop / disabled / nothing wired: same DOM shape, zero gesture handlers.
  // overflow-hidden matches the gesture branch — callers put rounding/borders
  // on this wrapper, and the square content surface must not overpaint them.
  if (!coarse || disabled || (!right && !left)) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <div className={contentClassName}>{children}</div>
      </div>
    )
  }

  function settle(target: number, onDone?: () => void) {
    const controls = reduced
      ? animate(x, target, { duration: 0 })
      : target === 0
        ? animate(x, 0, { type: 'spring', stiffness: 480, damping: 38 })
        : animate(x, target, { duration: 0.18, ease: 'easeOut' })
    if (onDone) void controls.then(onDone)
  }

  function commit(action: SwipeAction, dir: 1 | -1, width: number) {
    const mode = action.commit ?? (dir === 1 ? 'snap' : 'exit')
    if (mode === 'exit') {
      setExiting(true)
      // Fling off first, then fire — so an undoable delete's hide/toast lands
      // right as the row clears the viewport (no flash back).
      settle(dir * (width + 48), () => action.onTrigger())
    } else {
      action.onTrigger()
      settle(0)
    }
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const width = ref.current?.offsetWidth ?? 320
    const threshold = Math.min(TRIGGER, width * 0.35)
    const offset = x.get()
    const flick = (dir: 1 | -1) => info.velocity.x * dir > 600 && offset * dir > 32

    if (right && (offset > threshold || flick(1))) commit(right, 1, width)
    else if (left && (offset < -threshold || flick(-1))) commit(left, -1, width)
    else settle(0)

    // Let the drag-suppressed click pass, then re-enable taps.
    setTimeout(() => {
      draggedRef.current = false
    }, 80)
  }

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {right ? (
        <motion.div
          aria-hidden
          style={{ opacity: rightOpacity }}
          className={cn('absolute inset-0 flex items-center justify-start pl-5', right.className)}
        >
          <motion.span style={{ scale: rightScale }} className="flex flex-col items-center gap-0.5">
            {right.icon}
            <span className="text-[10.5px] font-medium leading-none">{right.label}</span>
          </motion.span>
        </motion.div>
      ) : null}
      {left ? (
        <motion.div
          aria-hidden
          style={{ opacity: leftOpacity }}
          className={cn('absolute inset-0 flex items-center justify-end pr-5', left.className)}
        >
          <motion.span style={{ scale: leftScale }} className="flex flex-col items-center gap-0.5">
            {left.icon}
            <span className="text-[10.5px] font-medium leading-none">{left.label}</span>
          </motion.span>
        </motion.div>
      ) : null}
      <motion.div
        drag={exiting ? false : 'x'}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{
          left: left ? -(TRIGGER + OVERDRAG) : 0,
          right: right ? TRIGGER + OVERDRAG : 0,
        }}
        // 1:1 follow inside the constraints; a side with no action barely budges.
        dragElastic={{ left: left ? 0.15 : 0.04, right: right ? 0.15 : 0.04 }}
        onDragStart={() => {
          draggedRef.current = true
        }}
        onDragEnd={onDragEnd}
        onClickCapture={(e) => {
          if (draggedRef.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        style={{ x, touchAction: 'pan-y' }}
        className={cn('relative', exiting && 'pointer-events-none', contentClassName)}
      >
        {children}
      </motion.div>
    </div>
  )
}
