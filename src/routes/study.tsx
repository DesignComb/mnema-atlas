import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, FastForward, Keyboard, Layers, Loader2, PartyPopper, Sparkles, Star, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useDecks, useDueCards, useSetCardStarred } from '@/lib/hooks'
import { deleteCard, listAheadCards, recordReviewSafe } from '@/lib/api'
import { undoableDelete } from '@/lib/undoable'
import { grade, previewIntervals, Rating, RATING_META, type IntervalHint } from '@/lib/srs'
import type { Grade } from 'ts-fsrs'
import type { CardRow } from '@/lib/database.types'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Wikilinked } from '@/components/common/Wikilinked'
import { cn, humanizeError } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const TONE: Record<string, string> = {
  again:
    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20',
  hard: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  easy: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/20',
}

const cardLabel = (s: string) => (s.length > 24 ? `${s.slice(0, 24)}…` : s)

export function StudyScreen() {
  const t = useT()
  const params = useParams({ strict: false }) as { deckId?: string }
  const deckId = params.deckId
  const search = useSearch({ strict: false }) as { tag?: string; starred?: '1' }
  const tag = search.tag
  const importantOnly = search.starred === '1'
  const { data: decks } = useDecks()
  const { data: dueCards, isLoading } = useDueCards(deckId, tag, importantOnly)
  const setCardStarred = useSetCardStarred()
  const qc = useQueryClient()

  const [queue, setQueue] = useState<CardRow[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [unsaved, setUnsaved] = useState(0) // reviews that failed every retry
  const [cram, setCram] = useState(false) // studying ahead (not-yet-due cards)
  const [cramLoading, setCramLoading] = useState(false)
  // One-level undo (A12): the pre-grade row, where it sat in the queue, and the
  // grade's (settled) write promise so the undo can sequence after it.
  const [lastGrade, setLastGrade] = useState<{
    row: CardRow
    index: number
    requeued: boolean
    write: Promise<unknown>
  } | null>(null)

  // Reset the whole session when the filter (deck or tag) changes — the route
  // component is reused across /study, /study/$deckId, and /study?tag=…
  useEffect(() => {
    setQueue(null)
    setIdx(0)
    setReviewed(0)
    setFlipped(false)
    setUnsaved(0)
    setCram(false)
    setLastGrade(null)
  }, [deckId, tag, importantOnly])

  // Snapshot the due queue once so grading doesn't reshuffle mid-session.
  useEffect(() => {
    if (dueCards && queue === null) setQueue(dueCards)
  }, [dueCards, queue])

  const current = queue?.[idx]
  const total = queue?.length ?? 0
  const deckById = useMemo(() => new Map((decks ?? []).map((d) => [d.id, d.name])), [decks])
  const deckName = deckId ? decks?.find((d) => d.id === deckId)?.name : t('All decks', '所有牌組')
  // The deck a card belongs to — surfaced on the card so a mixed session
  // (All decks / a #tag spanning decks) shows where each prompt comes from.
  const currentDeckName = current?.deck_id ? deckById.get(current.deck_id) : undefined

  const gradeCurrent = useCallback(
    (rating: Grade) => {
      if (!current) return
      const { card, log } = grade(current, rating)
      // Optimistically advance; persist in the background with retry so a blip
      // doesn't silently lose the grade. If every retry fails, flag it loudly.
      // Keep the (settled) promise so an undo can sequence AFTER this write —
      // otherwise a retrying grade write could land after the restore.
      const write = recordReviewSafe(current.id, card, log).catch((err) => {
        setUnsaved((u) => u + 1)
        toast.error(
          err instanceof Error
            ? t(`Couldn't save a review: ${err.message}`, `有一筆複習未能儲存：${err.message}`)
            : t('Failed to save a review', '有一筆複習未能儲存'),
          { duration: 6000 },
        )
      })
      // A11: an Again card re-enters this session with its updated FSRS state,
      // so the "1m" hint it showed is actually honoured.
      const requeued = rating === Rating.Again
      if (requeued) {
        const updated = { ...current, ...card } as CardRow
        setQueue((q) => (q ? [...q, updated] : q))
      }
      setLastGrade({ row: current, index: idx, requeued, write })
      setReviewed((r) => r + 1)
      setFlipped(false)
      setIdx((i) => i + 1)
    },
    [current, idx, t],
  )

  // A12: one-level undo — a misclick must not silently rewrite FSRS state.
  const undoLast = useCallback(() => {
    if (!lastGrade) return
    const { row, index, requeued, write } = lastGrade
    setLastGrade(null)
    // Restore the server to the pre-grade snapshot. record_review always writes
    // a review_logs row — rating 0 (Manual) marks it as an undo, not a review.
    const cardJson = {
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      learning_steps: row.learning_steps,
      reps: row.reps,
      lapses: row.lapses,
      last_review: row.last_review,
    }
    const undoLog = {
      rating: 0,
      state: row.state,
      due: row.due,
      stability: row.stability ?? 0,
      difficulty: row.difficulty ?? 0,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: row.learning_steps,
      review: new Date().toISOString(),
    }
    // Sequence the restore after the grade write settles, so a retrying grade
    // request can never land after (and overwrite) the undo.
    void write
      .then(() => recordReviewSafe(row.id, cardJson, undoLog))
      .catch(() => {
        toast.error(t('Couldn’t undo on the server — the grade may stick.', '伺服器端復原失敗,原評分可能仍生效。'))
      })
    if (requeued) setQueue((q) => (q ? q.slice(0, -1) : q))
    setReviewed((r) => Math.max(0, r - 1))
    setFlipped(false)
    setIdx(index)
  }, [lastGrade, t])

  // Discard the current card mid-session — a typo, dupe, or card you no longer
  // want. It leaves the in-session queue at once; the server delete fires after
  // a grace window so Undo (toast) restores both the row and the queue slot.
  const discardCurrent = useCallback(() => {
    if (!current) return
    const row = current
    const at = idx
    // A discard reshuffles the queue, which would invalidate the grade-undo's
    // saved index — drop it so Z can't rewind into a now-stale slot.
    setLastGrade(null)
    setQueue((q) => (q ? q.filter((_, i) => i !== at) : q))
    setFlipped(false)
    undoableDelete({
      key: `card:${row.id}`,
      message: t(`Discarded "${cardLabel(row.front)}"`, `已丟棄「${cardLabel(row.front)}」`),
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Discard failed — the card is back', '丟棄失敗，閃卡已還原'),
      commit: () => deleteCard(row.id),
      onUndo: () => {
        setQueue((q) => {
          const base = q ?? []
          const next = [...base]
          next.splice(Math.min(at, base.length), 0, row)
          return next
        })
        setIdx(at)
        setFlipped(false)
      },
      onSettled: () =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ['due'] }),
          qc.invalidateQueries({ queryKey: ['cards'] }),
          qc.invalidateQueries({ queryKey: ['cards-by-note'] }),
        ]),
    })
  }, [current, idx, qc, t])

  // Study-ahead: pull not-yet-due cards into a fresh queue (cramming).
  const startCram = useCallback(async () => {
    setCramLoading(true)
    try {
      const ahead = await listAheadCards(deckId, tag, 30, importantOnly)
      if (!ahead.length) {
        toast.success(t('Nothing scheduled ahead yet — add more cards.', '目前沒有可超前的閃卡 — 多新增一些吧。'))
        return
      }
      setQueue(ahead)
      setIdx(0)
      setReviewed(0)
      setFlipped(false)
      setUnsaved(0)
      setCram(true)
      setLastGrade(null)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to load cards', '載入閃卡失敗']))
    } finally {
      setCramLoading(false)
    }
  }, [deckId, tag, importantOnly, t])

  // Toggle the current card's "important" flag mid-review — flag what matters as
  // you meet it. Update the snapshot queue too so the star reflects instantly.
  const toggleStar = useCallback(() => {
    if (!current) return
    const next = !current.starred
    setQueue((q) => (q ? q.map((c) => (c.id === current.id ? { ...c, starred: next } : c)) : q))
    setCardStarred.mutate({ cardId: current.id, starred: next })
  }, [current, setCardStarred])

  // When the session ends, refresh due counts everywhere.
  const done = queue !== null && idx >= total
  useEffect(() => {
    if (done && reviewed > 0) {
      qc.invalidateQueries({ queryKey: ['due'] })
      qc.invalidateQueries({ queryKey: ['cards'] })
    }
  }, [done, reviewed, qc])

  // Keyboard: space/enter reveals, 1–4 grade, space grades Good when revealed,
  // Z/U undoes the last grade (works on the done screen too).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never react to typing in an input (⌘K palette, capture dialog, …) —
      // window-level shortcuts must not swallow text or fire side effects.
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((e.key === 'z' || e.key === 'u') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!lastGrade) return
        e.preventDefault()
        undoLast()
        return
      }
      if (!current) return
      if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        discardCurrent()
        return
      }
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
  }, [current, flipped, gradeCurrent, undoLast, lastGrade, discardCurrent])

  const hints: IntervalHint[] = current && flipped ? previewIntervals(current) : []

  return (
    <>
      <PageHeader
        title={t('Study', '學習')}
        subtitle={
          cram
            ? t('Studying ahead', '超前學習')
            : importantOnly
              ? t('Important cards', '重要閃卡')
              : tag
                ? `#${tag}`
                : (deckName ?? undefined)
        }
        icon={<Sparkles className="size-4" />}
        actions={
          <div className="flex items-center gap-2">
            {lastGrade ? (
              <Button variant="ghost" size="sm" onClick={undoLast} title={t('Undo last grade (Z)', '復原上一筆評分 (Z)')}>
                <Undo2 className="size-4" /> {t('Undo', '復原')}
              </Button>
            ) : null}
            {total > 0 && !done ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.min(idx + 1, total)} / {total}
              </span>
            ) : null}
          </div>
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
            title={t('Nothing due right now', '目前沒有待複習的閃卡')}
            description={t(
              "You're all caught up. New cards (including ones added by AI) appear here the moment they're created.",
              '你已全部複習完畢。新閃卡（包括 AI 新增的）一建立就會出現在這裡。',
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="brand" size="sm" onClick={startCram} disabled={cramLoading}>
                  {cramLoading ? <Loader2 className="size-4 animate-spin" /> : <FastForward className="size-4" />}
                  {t('Study ahead', '超前學習')}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/today">{t('Back to Today', '回到今天')}</Link>
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
                  `你複習了 ${reviewed} 張閃卡，做得很好。`,
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
                {t('Study ahead', '超前學習')}
              </Button>
              <Button asChild variant="brand">
                <Link to="/today">{t('Back to Today', '回到今天')}</Link>
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
                className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
              >
                {/* Mark this card important without leaving the review flow. */}
                <button
                  type="button"
                  onClick={toggleStar}
                  aria-pressed={current.starred}
                  title={current.starred ? t('Unmark important', '取消重要') : t('Mark important', '標記為重要')}
                  className="absolute right-2.5 top-2.5 z-10 rounded-md p-1.5 outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Star
                    className={cn(
                      'size-4',
                      current.starred ? 'fill-warning text-warning' : 'text-muted-foreground/40 hover:text-warning',
                    )}
                  />
                </button>

                {/* Front — a role=button (not <button>) so an in-text wikilink
                    can be a real <a> without nesting interactives. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !flipped && setFlipped(true)}
                  onKeyDown={(e) => {
                    if (!flipped && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      setFlipped(true)
                    }
                  }}
                  className="flex min-h-40 w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center sm:min-h-44 sm:px-8 sm:py-10"
                >
                  {currentDeckName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2.5 py-0.5 text-[11px] font-medium text-brand">
                      <Layers className="size-3" />
                      {currentDeckName}
                    </span>
                  ) : null}
                  <p className="font-serif text-xl leading-snug text-foreground sm:text-2xl">
                    <Wikilinked text={current.front} />
                  </p>
                  {current.image_url ? (
                    <img src={current.image_url} alt="" className="max-h-56 rounded-lg border border-border object-contain" />
                  ) : null}
                </div>

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
                          <Wikilinked text={current.back} />
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
                          <kbd className="rounded bg-white/60 px-1 text-[10px] dark:bg-white/10">{meta.key}</kbd>
                          {meta.label}
                        </span>
                        <span className="text-[11px] opacity-70">{h.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={discardCurrent}
                title={t('Discard this card (D)', '丟棄這張閃卡 (D)')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2.5 text-xs text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:border-red-200 active:bg-red-50 active:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:active:border-red-500/30 dark:active:bg-red-500/10 dark:active:text-red-400 sm:py-1.5"
              >
                <Trash2 className="size-3.5" />
                {t('Discard', '丟棄')}
              </button>
            </div>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Keyboard className="size-3.5" />
              {t('Space to reveal · 1–4 to grade · Z to undo · D to discard', '空白鍵顯示答案 · 1–4 評分 · Z 復原 · D 丟棄')}
            </p>
          </div>
        ) : null}
      </div>
    </>
  )
}
