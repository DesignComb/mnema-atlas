import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FilePlus2, FileText, GraduationCap, Layers, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCards, useCreateNote, useDecks, useDueCards, useNotes } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { Button } from '@/components/ui/button'
import { relativeDue } from '@/lib/utils'

export function DeckScreen() {
  const { deckId } = useParams({ strict: false }) as { deckId: string }
  const { data: decks } = useDecks()
  const { data: notes } = useNotes(deckId)
  const { data: cards } = useCards(deckId)
  const { data: due } = useDueCards(deckId)
  const createNote = useCreateNote()
  const navigate = useNavigate()
  const [cardOpen, setCardOpen] = useState(false)

  const deck = decks?.find((d) => d.id === deckId)
  const dueCount = due?.length ?? 0

  async function newNote() {
    try {
      const note = await createNote.mutateAsync({ title: 'Untitled', body: '', deck_id: deckId })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create note')
    }
  }

  return (
    <>
      <PageHeader
        title={deck?.name ?? 'Deck'}
        subtitle={deck?.description ?? undefined}
        icon={<Layers className="size-4" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> Card
            </Button>
            <Button variant="outline" size="sm" onClick={newNote}>
              <FilePlus2 className="size-4" /> Note
            </Button>
            {dueCount > 0 ? (
              <Button asChild variant="brand" size="sm">
                <Link to="/study/$deckId" params={{ deckId }}>
                  <GraduationCap className="size-4" /> Study ({dueCount})
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
          {/* Notes */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Notes</h3>
            {notes?.length ? (
              <div className="grid gap-2">
                {notes.map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="size-6" />}
                title="No notes in this deck"
                description="Add a note here, or let an AI assistant create them via MCP."
                action={
                  <Button variant="brand" size="sm" onClick={newNote}>
                    <FilePlus2 className="size-4" /> New note
                  </Button>
                }
              />
            )}
          </section>

          {/* Cards */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Flashcards {cards?.length ? <span className="text-muted-foreground">· {cards.length}</span> : null}
              </h3>
            </div>
            {cards?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {cards.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-3.5 shadow-soft">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{c.front}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{c.back}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground/80">due {relativeDue(c.due)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                No flashcards yet.
              </p>
            )}
          </section>
        </div>
      </div>
      <NewCardDialog open={cardOpen} onOpenChange={setCardOpen} deckId={deckId} />
    </>
  )
}
