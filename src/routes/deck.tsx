import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FilePlus2, FileText, GraduationCap, Layers, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCards, useCreateNote, useDecks, useDeleteDeck, useDueCards, useNotes } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { FlashcardTile } from '@/components/cards/FlashcardTile'
import { Button } from '@/components/ui/button'
import { relativeDue } from '@/lib/utils'

export function DeckScreen() {
  const { deckId } = useParams({ strict: false }) as { deckId: string }
  const { data: decks } = useDecks()
  const { data: notes } = useNotes(deckId)
  const { data: cards } = useCards(deckId)
  const { data: due } = useDueCards(deckId)
  const createNote = useCreateNote()
  const deleteDeck = useDeleteDeck()
  const navigate = useNavigate()
  const [cardOpen, setCardOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function removeDeck() {
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    try {
      await deleteDeck.mutateAsync(deckId)
      toast.success('Deck deleted — its notes & cards were kept, just unfiled')
      navigate({ to: '/cards' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete deck')
    }
  }

  const deck = decks?.find((d) => d.id === deckId)
  const dueCount = due?.length ?? 0
  const noteTitleById = new Map((notes ?? []).map((n) => [n.id, n.title]))

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
            <Button
              variant="ghost"
              size="sm"
              onClick={removeDeck}
              onBlur={() => setConfirmDel(false)}
              className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              title="Delete deck"
            >
              <Trash2 className="size-4" />
              {confirmDel ? 'Delete deck?' : null}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
          {/* Flashcards (primary) */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Flashcards {cards?.length ? <span className="text-muted-foreground">· {cards.length}</span> : null}
            </h3>
            {cards?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {cards.map((c) => (
                  <FlashcardTile key={c.id} card={c} noteTitle={c.note_id ? noteTitleById.get(c.note_id) : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Layers className="size-6" />}
                title="No flashcards in this deck"
                description="Add a card, or let a connected AI create them."
                action={
                  <Button variant="brand" size="sm" onClick={() => setCardOpen(true)}>
                    <Plus className="size-4" /> New card
                  </Button>
                }
              />
            )}
          </section>

          {/* Notes (secondary) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Notes {notes?.length ? <span className="text-muted-foreground">· {notes.length}</span> : null}
              </h3>
              <Button variant="ghost" size="sm" onClick={newNote}>
                <FilePlus2 className="size-4" /> Note
              </Button>
            </div>
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
              <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                No notes in this deck yet.
              </p>
            )}
          </section>
        </div>
      </div>
      <NewCardDialog open={cardOpen} onOpenChange={setCardOpen} deckId={deckId} />
    </>
  )
}
