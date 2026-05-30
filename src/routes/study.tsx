import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Keyboard, PartyPopper, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useDecks, useDueCards } from '@/lib/hooks'
import { recordReview } from '@/lib/api'
import { grade, previewIntervals, RATING_META, type IntervalHint } from '@/lib/srs'
import type { Grade } from 'ts-fsrs'
import type { CardRow } from '@/lib/database.types'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONE: Record<string, string> = {
  again: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  hard: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  easy: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
}

export function StudyScreen() {
  const params = useParams({ strict: false }) as { deckId?: string }
  const deckId = params.deckId
  const { data: decks } = useDecks()
  const { data: dueCards, isLoading } = useDueCards(deckId)
  const qc = useQueryClient()

  const [queue, setQueue] = useState<CardRow[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  // Snapshot the due queue once so grading doesn't reshuffle mid-session.
  useEffect(() => {
    if (dueCards && queue === null) setQueue(dueCards)
  }, [dueCards, queue])

  const current = queue?.[idx]
  const total = queue?.length ?? 0
  const deckName = deckId ? decks?.find((d) => d.id === deckId)?.name : 'All decks'

  const gradeCurrent = useCallback(
    (rating: Grade) => {
      if (!current) return
      const { card, log } = grade(current, rating)
      // Optimistically advance; persist in the background.
      recordReview(current.id, card, log).catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to save review'),
      )
      setReviewed((r) => r + 1)
      setFlipped(false)
      setIdx((i) => i + 1)
    },
    [current],
  )

  // When the session ends, refresh due counts everywhere.
  const done = queue !== null && idx >= total
  useEffect(() => {
    if (done && reviewed > 0) {
      qc.invalidateQueries({ queryKey: ['due'] })
      qc.invalidateQueries({ queryKey: ['cards'] })
    }
  }, [done, reviewed, qc])

  // Keyboard: space/enter reveals, 1–4 grade, space grades Good when revealed.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return
      if (!flipped) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setFlipped(true)
        }
        return
      }
      const map: Record<string, Grade> = { '1': 1, '2': 2, '3': 3, '4': 4 }
      if (e.key in map) {
        e.preventDefault()
        gradeCurrent(map[e.key])
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        gradeCurrent(3 as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, flipped, gradeCurrent])

  const hints: IntervalHint[] = current && flipped ? previewIntervals(current) : []

  return (
    <>
      <PageHeader
        title="Study"
        subtitle={deckName ?? undefined}
        icon={<Sparkles className="size-4" />}
        actions={
          total > 0 && !done ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.min(idx + 1, total)} / {total}
            </span>
          ) : null
        }
      />

      {/* Progress bar */}
      {total > 0 && !done ? (
        <div className="h-0.5 w-full bg-border">
          <motion.div
            className="h-full bg-brand"
            animate={{ width: `${(idx / total) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-dots px-6 py-10">
        {isLoading ? (
          <div className="h-64 w-full max-w-xl animate-pulse rounded-2xl bg-card" />
        ) : total === 0 ? (
          <EmptyState
            icon={<PartyPopper className="size-6" />}
            title="Nothing due right now"
            description="You're all caught up. New cards (including ones added by AI) appear here the moment they're created."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/">Back to Today</Link>
              </Button>
            }
          />
        ) : done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
              <Check className="size-8" />
            </div>
            <div className="space-y-1">
              <h2 className="font-serif text-2xl text-foreground">Session complete</h2>
              <p className="text-sm text-muted-foreground">
                You reviewed {reviewed} card{reviewed === 1 ? '' : 's'}. Nicely done.
              </p>
            </div>
            <Button asChild variant="brand">
              <Link to="/">Back to Today</Link>
            </Button>
          </motion.div>
        ) : current ? (
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
              >
                {/* Front */}
                <button
                  onClick={() => !flipped && setFlipped(true)}
                  className="flex min-h-44 w-full items-center justify-center px-8 py-10 text-center"
                >
                  <p className="font-serif text-2xl leading-snug text-foreground">{current.front}</p>
                </button>

                {/* Back */}
                <AnimatePresence>
                  {flipped ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="border-t border-border"
                    >
                      <div className="px-8 py-8 text-center">
                        <p className="whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-foreground">
                          {current.back}
                        </p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            <div className="mt-6">
              {!flipped ? (
                <Button variant="brand" className="w-full" size="lg" onClick={() => setFlipped(true)}>
                  Show answer
                  <kbd className="ml-1 rounded bg-brand-foreground/20 px-1.5 text-[11px]">Space</kbd>
                </Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {hints.map((h) => {
                    const meta = RATING_META[h.rating]
                    return (
                      <button
                        key={h.rating}
                        onClick={() => gradeCurrent(h.rating)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-sm font-medium transition',
                          TONE[meta.tone],
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <kbd className="rounded bg-white/60 px-1 text-[10px]">{meta.key}</kbd>
                          {meta.label}
                        </span>
                        <span className="text-[11px] opacity-70">{h.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Keyboard className="size-3.5" />
              Space to reveal · 1–4 to grade
            </p>
          </div>
        ) : null}
      </div>
    </>
  )
}
