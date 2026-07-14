import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, FastForward, GraduationCap, Keyboard, Layers, Loader2, PartyPopper, Star, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useDecks, useDueCards, useSetCardStarred } from '@/lib/hooks'
import { deleteCard, isCardNotFound, listAheadCards, recordReviewSafe } from '@/lib/api'
import { undoableDelete } from '@/lib/undoable'
import { grade, previewIntervals, Rating, RATING_META, type IntervalHint } from '@/lib/srs'
import { clearStudySession, patchStudySession, restoreStudySession, saveStudySession } from '@/lib/study-session'
import type { Grade } from 'ts-fsrs'
import type { CardRow } from '@/lib/database.types'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { AiImportButton } from '@/components/app-shell/AiImportButton'
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

// One-level undo (A12): the pre-grade row, where it sat in the queue, and the
// grade's (settled) write promise so the undo can sequence after it.
type LastGrade = {
  row: CardRow
  index: number
  requeued: boolean
  write: Promise<unknown>
}

// The live session, mirrored into the study-session store so a wikilink
// round-trip (tap a [[link]] on a card, read the note, come back) resumes
// mid-queue instead of restarting at card 1. `flipped` is deliberately not
// part of it: resuming onto a card's back side would turn the "Space =
// reveal" habit into a silent Good grade.
type SessionSnapshot = {
  queue: CardRow[]
  idx: number
  reviewed: number
  unsaved: number
  cram: boolean
  lastGrade: LastGrade | null
}

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

  // The filter identity — a saved session only resumes under the same filter.
  const sessionKey = `${deckId ?? ''}|${tag ?? ''}|${importantOnly ? 'starred' : ''}`
  // Resume an in-progress session (left via a wikilink, came back). Restoring in
  // the lazy initializer — not an effect — so the snapshot effect below never
  // sees a null queue on the mount commit and clobbers the restore with a
  // cached due list (idx would then point into the wrong queue).
  const [resumed] = useState(() => restoreStudySession<SessionSnapshot>(sessionKey))

  const [queue, setQueue] = useState<CardRow[] | null>(resumed?.queue ?? null)
  const [idx, setIdx] = useState(resumed?.idx ?? 0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(resumed?.reviewed ?? 0)
  const [unsaved, setUnsaved] = useState(resumed?.unsaved ?? 0) // reviews that failed every retry
  const [cram, setCram] = useState(resumed?.cram ?? false) // studying ahead (not-yet-due cards)
  const [cramLoading, setCramLoading] = useState(false)
  const [lastGrade, setLastGrade] = useState<LastGrade | null>(resumed?.lastGrade ?? null)
  // A restored session already earned its slot — remember that, because the
  // restored state alone may show no progress (flipped isn't restored) and the
  // mirror effect must not clear the slot on the resume commit itself (a cram
  // queue would then survive exactly one wikilink round-trip).
  const [touched, setTouched] = useState(resumed !== null)
  // One-shot cue announcing the resume — re-entering mid-queue must be
  // explained, not silent (the counter suddenly starts at e.g. 6/20).
  const [resumeNotice, setResumeNotice] = useState<SessionSnapshot | null>(resumed)

  // Live key so async callbacks (startCram, grade failures, discard-undo) can
  // tell whether the filter changed since they were created. Written in the
  // adjust block below (not an effect) so it can never lag the reset.
  const keyRef = useRef(sessionKey)

  // Reset (or resume) the session when the filter changes — a search/param
  // change (/study?tag=a → ?tag=b, /study/$deckId A → B) reuses this component
  // instance. Done during render (React's adjust-state-on-prop-change
  // pattern), NOT in an effect: an effect-based reset lets one commit pair the
  // new key with the old session's state, so the mirror effect below would
  // save the old session under the new key and then destroy that key's slot.
  const [prevKey, setPrevKey] = useState(sessionKey)
  if (prevKey !== sessionKey) {
    setPrevKey(sessionKey)
    keyRef.current = sessionKey
    const next = restoreStudySession<SessionSnapshot>(sessionKey)
    setQueue(next?.queue ?? null)
    setIdx(next?.idx ?? 0)
    setFlipped(false)
    setReviewed(next?.reviewed ?? 0)
    setUnsaved(next?.unsaved ?? 0)
    setCram(next?.cram ?? false)
    setLastGrade(next?.lastGrade ?? null)
    setTouched(next !== null)
    setResumeNotice(next)
  }

  // Snapshot the due queue once so grading doesn't reshuffle mid-session.
  useEffect(() => {
    if (dueCards && queue === null) setQueue(dueCards)
  }, [dueCards, queue])

  // Mirror the live session into the resume store; drop the slot once the
  // session ends. Only sessions with interaction are kept, so merely rendering
  // another filter's study screen can't evict a real session from the store's
  // small LRU.
  useEffect(() => {
    const active = queue !== null && queue.length > 0 && idx < queue.length
    const progressed = touched || idx > 0 || reviewed > 0 || flipped || lastGrade !== null
    if (active && progressed) {
      saveStudySession(sessionKey, { queue, idx, reviewed, unsaved, cram, lastGrade } satisfies SessionSnapshot)
    } else {
      clearStudySession(sessionKey)
    }
  }, [sessionKey, queue, idx, flipped, reviewed, unsaved, cram, lastGrade, touched])

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
      const cardId = current.id
      const write = recordReviewSafe(cardId, card, log).catch((err) => {
        // Deleted on another device / via MCP mid-session: the grade has
        // nothing to apply to — say so instead of a scary "couldn't save",
        // and disarm the undo for it (Z would replay 'card not found' and
        // rewind onto the phantom). The id guard keeps a later grade's undo
        // intact; the store patch covers firing after unmount.
        if (isCardNotFound(err)) {
          toast.error(t('This card was deleted elsewhere — grade skipped.', '這張閃卡已在其他地方被刪除，這筆評分已略過。'))
          setLastGrade((g) => (g?.row.id === cardId ? null : g))
          patchStudySession<SessionSnapshot>(sessionKey, (s) =>
            s.lastGrade?.row.id === cardId ? { ...s, lastGrade: null } : s,
          )
          return
        }
        // Count the failure on the session it belongs to: setState only if the
        // filter hasn't changed (this instance may now show another session);
        // the store patch covers both that case and firing after unmount.
        // Known gap: leave AND return before this fires re-mounts a fresh
        // instance whose next mirror save overwrites the patch — the counter
        // can undercount there; the loud toast remains the primary signal.
        if (keyRef.current === sessionKey) setUnsaved((u) => u + 1)
        patchStudySession<SessionSnapshot>(sessionKey, (s) => ({ ...s, unsaved: s.unsaved + 1 }))
        toast.error(
          err instanceof Error
            ? t(`Couldn't save a review: ${err.message}`, `有一筆複習未能儲存：${err.message}`)
            : t('Failed to save a review', '有一筆複習未能儲存'),
          { duration: 6000 },
        )
      })
      // Keep the cached due lists truthful as we go: if the resume store
      // misses (expired/evicted), the queue re-seeds from this cache, and a
      // stale entry would resurrect an already-graded card — regrading it from
      // its pre-grade FSRS row. Also keeps /today's due count live. The
      // Again-requeued copy lives only in the local queue; a real refetch
      // re-includes it once its +1m due passes. Best-effort, not a guarantee:
      // a concurrent cache writer (the star-toggle's onError rollback, an
      // invalidation refetch snapshotted before this grade landed) can put the
      // entry back.
      qc.setQueriesData<CardRow[]>({ queryKey: ['due'] }, (rows) => rows?.filter((c) => c.id !== cardId))
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
    [current, idx, qc, sessionKey, t],
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
      .then(() => {
        // The grade pruned this card from the due caches; after a successful
        // undo it is due again, so let them refetch.
        void qc.invalidateQueries({ queryKey: ['due'] })
      })
      .catch(() => {
        toast.error(t('Couldn’t undo on the server — the grade may stick.', '伺服器端復原失敗，原評分可能仍生效。'))
      })
    if (requeued) setQueue((q) => (q ? q.slice(0, -1) : q))
    setReviewed((r) => Math.max(0, r - 1))
    setFlipped(false)
    setIdx(index)
  }, [lastGrade, qc, t])

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
        // The undo toast outlives this session two ways. Filter switched on
        // this same instance: the setState below would splice a foreign card
        // into the NEW session's live queue — the keyRef guard skips it and
        // the store patch repairs the right session. Screen unmounted: the
        // setState is a no-op and the patch again does the repair. (Known gap:
        // leave AND return within the toast's ~4s re-mounts an instance that
        // won't see the patch and whose next mirror save overwrites it — the
        // card then only returns on a later reseed; the delete is still
        // cancelled server-side either way.)
        if (keyRef.current === sessionKey) {
          setQueue((q) => {
            const base = q ?? []
            const next = [...base]
            next.splice(Math.min(at, base.length), 0, row)
            return next
          })
          setIdx(at)
          setFlipped(false)
        }
        patchStudySession<SessionSnapshot>(sessionKey, (s) => {
          const next = [...s.queue]
          next.splice(Math.min(at, next.length), 0, row)
          return { ...s, queue: next, idx: at }
        })
      },
      onSettled: () =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ['due'] }),
          qc.invalidateQueries({ queryKey: ['cards'] }),
          qc.invalidateQueries({ queryKey: ['cards-by-note'] }),
        ]),
    })
  }, [current, idx, qc, sessionKey, t])

  // Study-ahead: pull not-yet-due cards into a fresh queue (cramming).
  const startCram = useCallback(async () => {
    const keyAtStart = sessionKey
    setCramLoading(true)
    try {
      const ahead = await listAheadCards(deckId, tag, 30, importantOnly)
      // The filter can change while the fetch is in flight — don't seed (and
      // persist) the old filter's cards under the new key.
      if (keyRef.current !== keyAtStart) return
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
  }, [deckId, tag, importantOnly, sessionKey, t])

  // Toggle the current card's "important" flag mid-review — flag what matters as
  // you meet it. Update the snapshot queue too so the star reflects instantly.
  const toggleStar = useCallback(() => {
    if (!current) return
    const next = !current.starred
    setQueue((q) => (q ? q.map((c) => (c.id === current.id ? { ...c, starred: next } : c)) : q))
    setCardStarred.mutate({ cardId: current.id, starred: next })
  }, [current, setCardStarred])

  // Announce a resumed session once. Cleared before the toast so StrictMode's
  // re-run (and any re-render) can't repeat it; the id dedupes regardless.
  useEffect(() => {
    if (!resumeNotice) return
    setResumeNotice(null)
    toast(
      resumeNotice.cram
        ? t('Resumed your study-ahead session', '已從上次的超前學習繼續')
        : t('Resumed where you left off', '已從上次的進度繼續'),
      { id: 'study-resume' },
    )
  }, [resumeNotice, t])

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
        icon={<GraduationCap className="size-4" />}
        actions={
          <div className="flex items-center gap-1.5">
            <AiImportButton />
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
        {isLoading && queue === null ? (
          // Only gate on the query while there's no queue yet — a restored
          // session must render at once, even if the due cache was GC'd and
          // the (display-irrelevant) refetch is still in flight.
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
