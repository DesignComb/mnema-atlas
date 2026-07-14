import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

/**
 * A lightweight, dependency-free product tour: a dimmed backdrop with a moving
 * "spotlight" hole over one chrome element at a time, plus a next/next tooltip
 * card. Steps target elements by a `data-tour="…"` attribute; the SAME value is
 * put on both the desktop and mobile variant of an affordance, and the tour
 * spotlights whichever one is currently visible — so it works on either layout
 * without branching. A step whose target isn't on screen is skipped.
 *
 * Runs once on first login (localStorage flag), and is re-runnable from the
 * guide page via ShellContext.startTour.
 */

const TOUR_SEEN_KEY = 'mnema:tour-seen'

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    /* storage unavailable — the tour just re-shows next launch, harmless */
  }
}

type TourStep = {
  /** CSS selector for the target; the first VISIBLE match is spotlit. */
  selector: string
  title: [string, string]
  body: [string, string]
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="import"]',
    title: ['Bring in your own AI', '帶進你自己的 AI'],
    body: [
      "This is the heart of Mnema: connect ChatGPT, Claude or any AI and let it fill your spaces for you. Whenever you want AI to add content, start here.",
      'Mnema 的核心：連接 ChatGPT、Claude 或任何 AI，讓它幫你充實各個空間。想讓 AI 新增內容時，都從這裡開始。',
    ],
  },
  {
    selector: '[data-tour="spaces"]',
    title: ['Switch between spaces', '切換各個空間'],
    body: [
      'Study, Money, Tasks, Travel and more — each space is a focused area for one part of your life. Tap to jump between them anytime.',
      '學習、記帳、任務、旅遊…每個空間都是專注於生活某一面向的區塊。隨時點一下就能切換。',
    ],
  },
  {
    selector: '[data-tour="capture"]',
    title: ['Capture anything, fast', '隨手暫存任何東西'],
    body: [
      'Got a fleeting thought? Drop it here and sort it out later — or let your AI file it into the right space.',
      '有稍縱即逝的靈感？先丟進來，之後再整理 —— 或交給 AI 幫你歸到正確的空間。',
    ],
  },
]

/** First visible element matching the selector (display:none variants — the
 *  desktop/mobile one that's hidden — have a zero-size rect and are skipped). */
function findVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

const SPOTLIGHT_PAD = 8
const CARD_MARGIN = 12

export function ProductTour({ run, onClose }: { run: boolean; onClose: () => void }) {
  const t = useT()
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Freeze the set of steps whose target is on screen when the tour starts — the
  // chrome doesn't change during the short tour, so this stays valid.
  const steps = useMemo(() => {
    if (!run) return []
    return STEPS.filter((s) => findVisible(s.selector))
  }, [run])

  // Reset to the first step each time the tour opens.
  useEffect(() => {
    if (run) setIdx(0)
  }, [run])

  const finish = useCallback(() => {
    setRect(null)
    setCardPos(null)
    onClose()
  }, [onClose])

  // Nothing to show (no chrome found) → don't trap the user.
  useEffect(() => {
    if (run && steps.length === 0) finish()
  }, [run, steps.length, finish])

  const active = steps[idx]

  // Measure the active target, and re-measure on resize/scroll so the spotlight
  // tracks the element.
  useLayoutEffect(() => {
    if (!run || !active) return
    const measure = () => {
      const el = findVisible(active.selector)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [run, active, idx])

  // Place the card near the target: below if it fits, otherwise above; clamped
  // to the viewport. Depends on the card's own measured size, so recompute per step.
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) return
    const card = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = rect.bottom + CARD_MARGIN
    if (top + card.height > vh - CARD_MARGIN) top = rect.top - CARD_MARGIN - card.height
    top = Math.max(CARD_MARGIN, Math.min(top, vh - CARD_MARGIN - card.height))
    let left = rect.left + rect.width / 2 - card.width / 2
    left = Math.max(CARD_MARGIN, Math.min(left, vw - CARD_MARGIN - card.width))
    setCardPos({ top, left })
  }, [rect, idx])

  const isLast = idx === steps.length - 1
  const next = useCallback(() => (isLast ? finish() : setIdx((i) => i + 1)), [isLast, finish])
  const back = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])

  // Keyboard: Esc skips, arrows / Enter navigate.
  useEffect(() => {
    if (!run) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, next, back, finish])

  if (!run || steps.length === 0 || !active) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        aria-label={t('Product tour', '使用導覽')}
      >
        {/* Click-blocking backdrop. When the target is missing we dim it directly;
            otherwise the spotlight's ring-shadow provides the dim + the hole. */}
        <div className={rect ? 'absolute inset-0' : 'absolute inset-0 bg-foreground/60'} onClick={finish} />

        {rect ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-brand"
            initial={false}
            animate={{
              top: rect.top - SPOTLIGHT_PAD,
              left: rect.left - SPOTLIGHT_PAD,
              width: rect.width + SPOTLIGHT_PAD * 2,
              height: rect.height + SPOTLIGHT_PAD * 2,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            // Token-based scrim (theme-aware) fills everything but the hole.
            style={{ boxShadow: '0 0 0 9999px color-mix(in oklch, var(--foreground) 60%, transparent)' }}
          />
        ) : null}

        <div
          ref={cardRef}
          style={{ top: cardPos?.top, left: cardPos?.left, opacity: cardPos ? 1 : 0 }}
          className="absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card p-4 shadow-pop"
        >
          <button
            type="button"
            onClick={finish}
            aria-label={t('Skip tour', '略過導覽')}
            className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>

          <div className="mb-2 flex items-center gap-2 pr-6">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
              {isLast ? <Sparkles className="size-4" /> : <Check className="size-4" />}
            </span>
            <h3 className="text-sm font-semibold text-foreground">{t(...active.title)}</h3>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">{t(...active.body)}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5" aria-hidden>
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={
                    i === idx ? 'size-1.5 rounded-full bg-brand' : 'size-1.5 rounded-full bg-border'
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {idx > 0 ? (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> {t('Back', '上一步')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {t('Skip', '略過')}
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-brand-foreground shadow-sm transition hover:bg-brand/90"
              >
                {isLast ? (
                  t('Done', '完成')
                ) : (
                  <>
                    {t('Next', '下一步')} <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
