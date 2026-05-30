import { Link } from '@tanstack/react-router'
import { GraduationCap, Layers, Sparkles } from 'lucide-react'
import { useCards, useDecks, useDueCards } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'

export function CardsScreen() {
  const { data: cards } = useCards()
  const { data: due } = useDueCards()
  const { data: decks } = useDecks()

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

  const totalDue = due?.length ?? 0
  const looseCount = countByDeck.get('none') ?? 0
  const deckList = decks ?? []
  const isEmpty = (cards?.length ?? 0) === 0

  return (
    <>
      <PageHeader
        title="Flashcards"
        subtitle={cards ? `${cards.length} card${cards.length === 1 ? '' : 's'} · ${totalDue} due` : undefined}
        icon={<Layers className="size-4" />}
        actions={
          totalDue > 0 ? (
            <Button asChild variant="brand" size="sm">
              <Link to="/study">
                <GraduationCap className="size-4" /> Study ({totalDue})
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
              title="No flashcards yet"
              description="Add cards from a note, or let an AI assistant create them via MCP. They enter FSRS scheduling immediately."
            />
          ) : (
            <>
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
                        {n} card{n === 1 ? '' : 's'}
                      </p>
                    </div>
                    {dd > 0 ? (
                      <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand">
                        {dd} due
                      </span>
                    ) : null}
                  </Link>
                )
              })}
              {looseCount > 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-sm text-muted-foreground">
                  <Layers className="size-4" /> {looseCount} card{looseCount === 1 ? '' : 's'} not in any deck
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  )
}
