import { useEffect, type RefObject } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { activeSpace, spaceSubnav } from '@/components/app-shell/spaces'
import { isSubNavActive } from '@/components/app-shell/SubNav'

/**
 * Swipe left/right across the content to move between the current space's SubNav
 * views (Study pages, Tempo views) — the phone-native way to flip tabs. Touch
 * only, and deliberately conservative so it never fights existing gestures:
 *
 * - acts only on touch-END (no live content drag), and never preventDefault()s,
 *   so vertical scrolling and SwipeRow are completely untouched;
 * - ignores a swipe that starts on an input, a horizontal scroller (the strip
 *   itself, carousels, the trip strip), or an element that owns its own gesture
 *   (touch-action none/pan-y — i.e. SortableList grips and SwipeRow rows);
 * - requires a decisive, horizontal-dominant travel before it commits.
 */
const COMMIT = 64 // px of horizontal travel to flip a tab
const DOMINANCE = 1.6 // horizontal must beat vertical by this factor

function shouldIgnore(root: HTMLElement, target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null
  if (node?.closest('input, textarea, select, [contenteditable="true"]')) return true
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const s = window.getComputedStyle(node)
      if (s.touchAction === 'none' || s.touchAction === 'pan-y') return true
      if (node.scrollWidth > node.clientWidth + 1 && /(auto|scroll)/.test(s.overflowX)) return true
    }
    node = node.parentElement
  }
  return false
}

export function useSwipeNav(ref: RefObject<HTMLElement | null>) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search as Record<string, string | undefined> })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const belowLg = window.matchMedia('(max-width: 1023px)')
    const coarse = window.matchMedia('(pointer: coarse)')

    let armed = false
    let decided = false
    let horizontal = false
    let x0 = 0
    let y0 = 0

    const onStart = (e: TouchEvent) => {
      armed = false
      if (e.touches.length !== 1 || !belowLg.matches || !coarse.matches) return
      if (shouldIgnore(el, e.target)) return
      armed = true
      decided = false
      horizontal = false
      x0 = e.touches[0].clientX
      y0 = e.touches[0].clientY
    }

    const onMove = (e: TouchEvent) => {
      if (!armed) return
      const dx = e.touches[0].clientX - x0
      const dy = e.touches[0].clientY - y0
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      const horizNow = Math.abs(dx) > Math.abs(dy) * DOMINANCE
      if (!decided) {
        decided = true
        horizontal = horizNow
        if (!horizontal) armed = false // started as a vertical scroll — let it be
      } else if (!horizNow) {
        // Veered vertical mid-swipe — it's a scroll, not a tab flip. Disarm so a
        // diagonal drag can't commit a navigation on release.
        armed = false
      }
    }

    const onEnd = (e: TouchEvent) => {
      const ok = armed && horizontal
      armed = false
      if (!ok) return
      const dx = (e.changedTouches[0]?.clientX ?? x0) - x0
      if (Math.abs(dx) < COMMIT) return

      const items = spaceSubnav(activeSpace(pathname), pathname)
      if (!items.length) return
      const idx = items.findIndex((it) => isSubNavActive(it, pathname, search))
      if (idx < 0) return
      const target = items[dx < 0 ? idx + 1 : idx - 1]
      if (!target) return // already at an edge

      if (target.kind === 'route') navigate({ to: target.to })
      else navigate({ to: '/tempo', search: (prev) => ({ ...prev, [target.param]: target.value }) })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, navigate, pathname, search])
}
