import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, FastForward, Keyboard, Loader2, PartyPopper, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useDecks, useDueCards } from '@/lib/hooks'
import { listAheadCards, recordReviewSafe } from '@/lib/api'
import { grade, previewIntervals, RATING_META, type IntervalHint } from '@/lib/srs'
import type { Grade } from 'ts-fsrs'
import type { CardRow } from '@/lib/database.types'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const TONE: Record<string, string> = {
  again: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  hard: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  easy: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
}

export function StudyScreen() {
  const t = useT()
  const params = useParams({ strict: false }) as { deckId?: string }
  const deckId = params.deckId
  const { data: decks } = useDecks()
  const { data: dueCards, isLoading } = useDueCards(deckId)
  const qc = useQueryClient()

  const [queue, setQueue] = useState<CardRow[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [unsaved, setUnsaved] = useState(0) // reviews that failed every retry
  const [cram, setCram] = useState(false) // studying ahead (not-yet-due cards)
  const [cramLoading, setCramLoading] = useState(false)

  // Snapshot the due queue once so grading doesn't reshuffle mid-session.
  useEffect(() => {
    if (dueCards && queue === null) setQueue(dueCards)
  }, [dueCards, queue])

  const current = queue?.[idx]
  const total = queue?.length ?? 0
  const deckName = deckId ? decks?.find((d) => d.id === deckId)?.name : t('All decks', '所有牌組')

  const gradeCurrent = useCallback(
    (rating: Grade) => {
      if (!current) return
      const { card, log } = grade(current, rating)
      // Optimistically advance; persist in the background with retry so a blip
      // doesn't silently lose the grade. If every retry fails, flag it loudly.
      recordReviewSafe(current.id, card, log).catch((err) => {
        setUnsaved((u) => u + 1)
        toast.error(
          err instanceof Error
            ? t(`Couldn't save a review: ${err.message}`, `有一筆複習未能儲存：${err.message}`)
            : t('Failed to save a review', '有一筆複習未能儲存'),
          { duration: 6000 },
        )
      })
      setReviewed((r) => r + 1)
      setFlipped(false)
      setIdx((i) => i + 1)
    },
    [current, t],
  )

  // Study-ahead: pull not-yet-due cards into a fresh queue (cramming).
  const startCram = useCallback(async () => {
    setCramLoading(true)
    try {
      const ahead = await listAheadCards(deckId, 30)
      if (!ahead.length) {
        toast.success(t('Nothing scheduled ahead yet — add more cards.', '目前沒有可超前的卡片 — 多新增一些吧。'))
        return
      }
      setQueue(ahead)
      setIdx(0)
      setReviewed(0)
      setFlipped(false)
      setUnsaved(0)
      setCram(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to load cards', '載入卡片失敗'))
    } finally {
      setCramLoading(false)
    }
  }, [deckId, t])

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
        title={t('Study', '學習')}
        subtitle={cram ? t('Studying ahead', '超前複習') : (deckName ?? undefined)}
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

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-dots px-4 py-6 sm:px-6 sm:py-10">
        {isLoading ? (
          <div className="h-64 w-full max-w-xl animate-pulse rounded-2xl bg-card" />
        ) : total === 0 ? (
          <EmptyState
            icon={<PartyPopper className="size-6" />}
            title={t('Nothing due right now', '目前沒有待複習的字卡')}
            description={t(
              "You're all caught up. New cards (including ones added by AI) appear here the moment they're created.",
              '你已全部複習完畢。新字卡（包括 AI 新增的）一建立就會出現在這裡。',
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="brand" size="sm" onClick={startCram} disabled={cramLoading}>
                  {cramLoading ? <Loader2 className="size-4 animate-spin" /> : <FastForward className="size-4" />}
                  {t('Study ahead', '超前複習')}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/">{t('Back to Today', '回到今天')}</Link>
                </Button>
              </div>
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
              <h2 className="font-serif text-2xl text-foreground">{t('Session complete', '本次學習完成')}</h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Nicely done.`,
                  `你複習了 ${reviewed} 張字卡，做得很好。`,
                )}
              </p>
              {unsaved > 0 ? (
                <p className="flex items-center justify-center gap-1.5 text-[13px] text-amber-600">
                  <AlertTriangle className="size-3.5" />
                  {t(
                    `${unsaved} review${unsaved === 1 ? '' : 's'} couldn't be saved — check your connection.`,
                    `${unsaved} 筆複習未能儲存 — 請檢查網路連線。`,
                  )}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={startCram} disabled={cramLoading}>
                {cramLoading ? <Loader2 className="size-4 animate-spin" /> : <FastForward className="size-4" />}
                {t('Study ahead', '超前複習')}
              </Button>
              <Button asChild variant="brand">
                <Link to="/">{t('Back to Today', '回到今天')}</Link>
              </Button>
            </div>
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
                  className="flex min-h-40 w-full items-center justify-center px-6 py-8 text-center sm:min-h-44 sm:px-8 sm:py-10"
                >
                  <p className="font-serif text-xl leading-snug text-foreground sm:text-2xl">{current.front}</p>
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
                      <div className="px-6 py-6 text-center sm:px-8 sm:py-8">
                        <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground sm:text-[17px]">
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
                  {t('Show answer', '顯示答案')}
                  <kbd className="ml-1 rounded bg-brand-foreground/20 px-1.5 text-[11px]">Space</kbd>
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {hints.map((h) => {
                    const meta = RATING_META[h.rating]
                    return (
                      <button
                        key={h.rating}
                        onClick={() => gradeCurrent(h.rating)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-sm font-medium transition sm:py-2.5',
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
              {t('Space to reveal · 1–4 to grade', '空白鍵顯示答案 · 1–4 評分')}
            </p>
          </div>
        ) : null}
      </div>
    </>
  )
}
