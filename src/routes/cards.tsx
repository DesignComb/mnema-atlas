import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { GraduationCap, Layers, Sparkles, X } from 'lucide-react'
import { useCards, useDecks, useDueCards, useNotes, useSeedSample } from '@/lib/hooks'
import { buildDeckTree, flattenTree } from '@/lib/deck-tree'
import { FlashcardTile } from '@/components/cards/FlashcardTile'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { tagChipStyle } from '@/lib/tags'
import { cn } from '@/lib/utils'

function StateTile({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center shadow-soft">
      <p className={`text-xl font-semibold tabular-nums ${cls}`}>{n}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function CardsScreen() {
  const { data: cards } = useCards()
  const { data: due } = useDueCards()
  const { data: decks } = useDecks()
  const { data: notes } = useNotes()
  const seed = useSeedSample()
  const t = useT()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Selected tag filter (in the URL so it's shareable / survives refresh).
  const { tag: activeTag } = useSearch({ from: '/_app/cards' }) as { tag?: string }
  const selectTag = (tg: string | undefined) =>
    navigate({ to: '/cards', search: tg ? { tag: tg } : {} })

  // Tag overview → filter the browse list (and a Study jump from the filtered view).
  const tagTotal = new Map<string, number>()
  const tagDue = new Map<string, number>()
  cards?.forEach((c) => c.tags?.forEach((tg) => tagTotal.set(tg, (tagTotal.get(tg) ?? 0) + 1)))
  due?.forEach((c) => c.tags?.forEach((tg) => tagDue.set(tg, (tagDue.get(tg) ?? 0) + 1)))
  const tagList = Array.from(tagTotal.keys()).sort()

  // Filtered browse: every card carrying the selected tag, across all decks.
  const filtered = activeTag ? (cards ?? []).filter((c) => c.tags?.includes(activeTag)) : null
  const filteredDue = activeTag ? tagDue.get(activeTag) ?? 0 : 0
  const noteTitleById = new Map((notes ?? []).map((n) => [n.id, n.title]))

  const countByDeck = new Map<string, number>()
  cards?.forEach((c) => {
    const k = c.deck_id ?? 'none'
    countByDeck.set(k, (countByDeck.get(k) ?? 0) + 1)
  })
  const dueByDeck = new Map<string, number>()
  due?.forEach((c) => {
    const k = c.deck_id ?? 'none'
    dueByDeck.set(k, (dueByDeck.get(k) ?? 0) + 1)
  })
  const byState: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  cards?.forEach((c) => {
    byState[c.state] = (byState[c.state] ?? 0) + 1
  })

  const totalDue = due?.length ?? 0
  const looseCount = countByDeck.get('none') ?? 0
  // Tree order with depth, so nested decks read as folders here too.
  const deckList = flattenTree(buildDeckTree(decks ?? []))
  const isEmpty = (cards?.length ?? 0) === 0

  return (
    <>
      <PageHeader
        title={t('Flashcards', '閃卡')}
        subtitle={
          cards
            ? t(
                `${cards.length} card${cards.length === 1 ? '' : 's'} · ${totalDue} due`,
                `${cards.length} 張閃卡 · ${totalDue} 張到期`,
              )
            : undefined
        }
        icon={<Layers className="size-4" />}
        actions={
          totalDue > 0 ? (
            <Button asChild variant="brand" size="sm">
              <Link to="/study">
                <GraduationCap className="size-4" /> <span className="hidden sm:inline">{t('Study', '學習')} </span>({totalDue})
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2.5 px-4 py-4 sm:px-6 sm:py-6">
          {isEmpty ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title={t('No flashcards yet', '還沒有閃卡')}
              description={t(
                'Add a sample deck to see how it works, add cards from a note, or let a connected AI create them — they enter FSRS scheduling immediately.',
                '加入範例牌組看看效果、從筆記新增閃卡，或讓連接的 AI 為你建立——它們會立即進入 FSRS 排程。',
              )}
              action={
                <Button variant="brand" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
                  <Sparkles className="size-4" /> {t('Add a sample deck', '加入範例牌組')}
                </Button>
              }
            />
          ) : (
            <>
              {/* Learning-status overview */}
              <div className="mb-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StateTile label={t('New', '新卡')} n={byState[0]} cls="text-sky-600 dark:text-sky-300" />
                <StateTile label={t('Learning', '學習中')} n={byState[1] + byState[3]} cls="text-amber-600 dark:text-amber-300" />
                <StateTile label={t('Review', '複習')} n={byState[2]} cls="text-emerald-600 dark:text-emerald-300" />
                <StateTile label={t('Due now', '現在到期')} n={totalDue} cls="text-brand" />
              </div>

              {/* Filter by tag — click a tag to browse its cards across all decks. */}
              {tagList.length ? (
                <div className="mb-1.5">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {t('Filter by tag', '依標籤篩選')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tagList.map((tg) => {
                      const n = tagTotal.get(tg) ?? 0
                      const d = tagDue.get(tg) ?? 0
                      const active = tg === activeTag
                      return (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => selectTag(active ? undefined : tg)}
                          aria-pressed={active}
                          style={active ? tagChipStyle(tg, isDark) : undefined}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-85',
                            active
                              ? 'ring-1 ring-brand/40'
                              : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                          )}
                          title={t(`Filter “${tg}”`, `篩選「${tg}」`)}
                        >
                          {tg}
                          <span className="tabular-nums opacity-70">{d > 0 ? `${d}/${n}` : n}</span>
                          {active ? <X className="size-3" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Filtered browse: the selected tag's cards, with a Study jump. */}
              {activeTag ? (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span style={tagChipStyle(activeTag, isDark)} className="rounded-full border px-2 py-0.5 text-[12px]">
                        {activeTag}
                      </span>
                      <span className="text-muted-foreground">
                        {t(`${filtered?.length ?? 0} card${(filtered?.length ?? 0) === 1 ? '' : 's'}`, `${filtered?.length ?? 0} 張閃卡`)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => selectTag(undefined)}>
                        <X className="size-4" /> {t('Clear', '清除')}
                      </Button>
                      {filteredDue > 0 ? (
                        <Button asChild variant="brand" size="sm">
                          <Link to="/study" search={{ tag: activeTag }}>
                            <GraduationCap className="size-4" /> {t('Study', '學習')} ({filteredDue})
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {filtered?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filtered.map((c) => (
                        <FlashcardTile key={c.id} card={c} noteTitle={c.note_id ? noteTitleById.get(c.note_id) : undefined} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                      {t('No cards with this tag.', '沒有帶此標籤的閃卡。')}
                    </p>
                  )}
                </section>
              ) : (
              <>
              {deckList.map(({ deck: d, depth }) => {
                const n = countByDeck.get(d.id) ?? 0
                const dd = dueByDeck.get(d.id) ?? 0
                return (
                  <Link
                    key={d.id}
                    to="/decks/$deckId"
                    params={{ deckId: d.id }}
                    style={depth ? { marginLeft: depth * 16 } : undefined}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft transition hover:border-brand/40 hover:shadow-pop"
                  >
                    <Layers className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`${n} card${n === 1 ? '' : 's'}`, `${n} 張閃卡`)}
                      </p>
                    </div>
                    {dd > 0 ? (
                      <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand">
                        {t(`${dd} due`, `${dd} 張到期`)}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
              {looseCount > 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-sm text-muted-foreground">
                  <Layers className="size-4" />{' '}
                  {t(
                    `${looseCount} card${looseCount === 1 ? '' : 's'} not in any deck`,
                    `${looseCount} 張閃卡未歸入任何牌組`,
                  )}
                </div>
              ) : null}
              </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
