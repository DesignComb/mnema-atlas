import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Pull-to-refresh for the app's per-screen scroll containers, touch only.
 *
 * `<PullToRefresh onRefresh={…}>` replaces a screen's
 * `<div className="flex-1 overflow-y-auto">` scroller: same flex sizing, plus a
 * brand-colored spinner chip that follows the pull with resistance and spins
 * while `onRefresh` resolves (min 400ms so it never flickers).
 *
 * Gesture rules (native touch events, like the bottom sheet's swipe-dismiss):
 * - arms only when the scroller is at scrollTop 0 on a coarse-pointer device
 * - direction-disambiguates: a mostly-horizontal start (SwipeRow's territory)
 *   or an upward start (a normal scroll) releases the gesture untouched
 * - once owned (>12px downward), touchmove is preventDefault-ed so the browser
 *   never scroll-chains into its own pull-to-refresh; `overscroll-y-contain`
 *   on the scroller backstops that in the PWA
 * - the indicator is driven by direct style writes (no React re-renders at
 *   60Hz), transform/opacity only.
 */
const PULL_TRIGGER = 70 // px of (resisted) indicator travel that commits a refresh
const MAX_PULL = 104 // soft cap on indicator travel
const RESISTANCE = 0.5 // indicator follows the finger at half speed
const MIN_SPIN_MS = 400
const HIDDEN_Y = -56 // indicator's resting spot, tucked above the scroller

const coarseMq = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null

export function PullToRefresh({
  onRefresh,
  className,
  children,
}: {
  /** Usually `() => Promise.all([...queryClient.invalidateQueries per screen key])`. */
  onRefresh: () => Promise<unknown>
  /** Extra classes for the scroll container (it already has flex-1 + overflow-y-auto). */
  className?: string
  children: ReactNode
}) {
  // State (not a ref) so the effect re-binds when the scroller mounts/unmounts.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollEl
    if (!el) return

    let armed = false // touch started at the top — a pull candidate
    let pulling = false // we own the gesture
    let startY = 0
    let startX = 0
    let pull = 0
    let ticked = false // haptic fired for this pull

    const indicator = () => indicatorRef.current

    const draw = (px: number) => {
      const ind = indicator()
      if (!ind) return
      const past = px >= PULL_TRIGGER
      ind.style.transform = `translate(-50%, ${Math.round(HIDDEN_Y + px)}px) scale(${past ? 1.08 : 1})`
      ind.style.opacity = String(Math.min(1, px / PULL_TRIGGER))
      // The icon turns with the pull — a quiet "you're winding it up" cue.
      const icon = ind.firstElementChild as HTMLElement | null
      if (icon) icon.style.transform = `rotate(${Math.round(px * 2.2)}deg)`
      if (past && !ticked) {
        ticked = true
        navigator.vibrate?.(10)
      } else if (!past) {
        ticked = false
      }
    }

    const settleBack = () => {
      const ind = indicator()
      if (!ind) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ind.style.transition = reduce ? 'none' : 'transform 180ms ease, opacity 180ms ease'
      ind.style.transform = `translate(-50%, ${HIDDEN_Y}px)`
      ind.style.opacity = '0'
      const clear = () => {
        ind.style.transition = ''
        ind.removeEventListener('transitionend', clear)
      }
      if (reduce) clear()
      else ind.addEventListener('transitionend', clear)
    }

    const dock = () => {
      const ind = indicator()
      if (!ind) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ind.style.transition = reduce ? 'none' : 'transform 150ms ease'
      ind.style.transform = `translate(-50%, ${HIDDEN_Y + PULL_TRIGGER}px)`
      ind.style.opacity = '1'
      const icon = ind.firstElementChild as HTMLElement | null
      if (icon) icon.style.transform = '' // hand rotation over to animate-spin
    }

    const startRefresh = () => {
      refreshingRef.current = true
      setRefreshing(true)
      dock()
      const started = Date.now()
      void Promise.resolve()
        .then(() => onRefreshRef.current())
        .catch(() => {}) // a failed refetch surfaces through each screen's ErrorState
        .then(() => {
          const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started))
          setTimeout(() => {
            refreshingRef.current = false
            setRefreshing(false)
            settleBack()
          }, wait)
        })
    }

    // A touch that starts on a gesture-owning element (SortableList grips are
    // touch-action:none) is a drag, never a pull — same rule as the bottom
    // sheet's swipe-dismiss.
    const ownsGesture = (target: EventTarget | null): boolean => {
      let node = target instanceof Element ? target : null
      while (node && node !== el) {
        if (node instanceof HTMLElement && window.getComputedStyle(node).touchAction === 'none') return true
        node = node.parentElement
      }
      return false
    }

    const onTouchStart = (e: TouchEvent) => {
      if (pulling) {
        // A second finger landed mid-pull — cancel cleanly instead of stranding
        // the chip mid-air with no path back.
        pulling = false
        armed = false
        settleBack()
        return
      }
      armed = false
      if (refreshingRef.current) return
      if (e.touches.length !== 1 || !coarseMq?.matches) return
      if (el.scrollTop > 0 || ownsGesture(e.target)) return
      armed = true
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      pull = 0
      ticked = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!armed) return
      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX
      if (!pulling) {
        // Mostly horizontal → a SwipeRow gesture; upward / mid-scroll → a scroll.
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          armed = false
          return
        }
        if (dy < 0 || el.scrollTop > 0) {
          armed = false
          return
        }
        if (dy <= 12) return // not decisive yet
        pulling = true
        const ind = indicator()
        if (ind) ind.style.transition = 'none'
      }
      if (e.cancelable) e.preventDefault() // we own it — no scroll-chaining, no native PTR
      pull = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE))
      draw(pull)
    }

    const finish = () => {
      if (!armed) return
      armed = false
      if (!pulling) return
      pulling = false
      if (pull >= PULL_TRIGGER) startRefresh()
      else settleBack()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', finish)
    el.addEventListener('touchcancel', finish)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', finish)
      el.removeEventListener('touchcancel', finish)
    }
  }, [scrollEl])

  return (
    // overflow-hidden: the tucked-away indicator must never paint over the
    // header above — it slides INTO this box as you pull.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-soft"
        style={{ transform: `translate(-50%, ${HIDDEN_Y}px)`, opacity: 0 }}
      >
        <RefreshCw className={cn('size-4 text-brand', refreshing && 'animate-spin')} />
      </div>
      <div ref={setScrollEl} className={cn('flex-1 overflow-y-auto overscroll-y-contain', className)}>
        {children}
      </div>
    </div>
  )
}
