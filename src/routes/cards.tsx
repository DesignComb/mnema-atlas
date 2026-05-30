import { Link } from '@tanstack/react-router'
import { GraduationCap, Layers, Sparkles } from 'lucide-react'
import { useCards, useDecks, useDueCards, useSeedSample } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

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
  const seed = useSeedSample()
  const t = useT()

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
  const deckList = decks ?? []
  const isEmpty = (cards?.length ?? 0) === 0

  return (
    <>
      <PageHeader
        title={t('Flashcards', '字卡')}
        subtitle={
          cards
            ? t(
                `${cards.length} card${cards.length === 1 ? '' : 's'} · ${totalDue} due`,
                `${cards.length} 張字卡 · ${totalDue} 張到期`,
              )
            : undefined
        }
        icon={<Layers className="size-4" />}
        actions={
          totalDue > 0 ? (
            <Button asChild variant="brand" size="sm">
              <Link to="/study">
                <GraduationCap className="size-4" /> {t('Study', '複習')} ({totalDue})
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2.5 px-6 py-6">
          {isEmpty ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title={t('No flashcards yet', '還沒有字卡')}
              description={t(
                'Add a sample deck to see how it works, add cards from a note, or let a connected AI create them — they enter FSRS scheduling immediately.',
                '加入範例牌組看看效果、從筆記新增字卡，或讓連接的 AI 為你建立——它們會立即進入 FSRS 排程。',
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
              <div className="mb-1.5 grid grid-cols-4 gap-2">
                <StateTile label={t('New', '新卡')} n={byState[0]} cls="text-sky-600 dark:text-sky-300" />
                <StateTile label={t('Learning', '學習中')} n={byState[1] + byState[3]} cls="text-amber-600 dark:text-amber-300" />
                <StateTile label={t('Review', '複習')} n={byState[2]} cls="text-emerald-600 dark:text-emerald-300" />
                <StateTile label={t('Due now', '現在到期')} n={totalDue} cls="text-brand" />
              </div>
              {deckList.map((d) => {
                const n = countByDeck.get(d.id) ?? 0
                const dd = dueByDeck.get(d.id) ?? 0
                return (
                  <Link
                    key={d.id}
                    to="/decks/$deckId"
                    params={{ deckId: d.id }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft transition hover:border-brand/40 hover:shadow-pop"
                  >
                    <Layers className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`${n} card${n === 1 ? '' : 's'}`, `${n} 張字卡`)}
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
                    `${looseCount} 張字卡未歸入任何牌組`,
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  )
}
