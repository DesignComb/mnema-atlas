import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FilePlus2, FileText, GraduationCap, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCards, useCreateNote, useDecks, useDeleteDeck, useDueCards, useNotes } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { NewDeckDialog } from '@/components/app-shell/NewDeckDialog'
import { FlashcardTile } from '@/components/cards/FlashcardTile'
import { Button } from '@/components/ui/button'
import { relativeDue } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

export function DeckScreen() {
  const { deckId } = useParams({ strict: false }) as { deckId: string }
  const { data: decks } = useDecks()
  const { data: notes } = useNotes(deckId)
  const { data: cards } = useCards(deckId)
  const { data: due } = useDueCards(deckId)
  const createNote = useCreateNote()
  const deleteDeck = useDeleteDeck()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [cardOpen, setCardOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function removeDeck() {
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    try {
      await deleteDeck.mutateAsync(deckId)
      toast.success(
        t('Deck deleted — its notes & cards were kept, just unfiled', '已刪除牌組——筆記與字卡都會保留，只是不再歸檔'),
      )
      navigate({ to: '/cards' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to delete deck', '刪除牌組失敗'))
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
      toast.error(err instanceof Error ? err.message : t('Failed to create note', '建立筆記失敗'))
    }
  }

  return (
    <>
      <PageHeader
        title={deck?.name ?? t('Deck', '牌組')}
        subtitle={deck?.description ?? undefined}
        icon={<Layers className="size-4" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('Card', '字卡')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={newNote}>
              <FilePlus2 className="size-4" /> <span className="hidden sm:inline">{t('Note', '筆記')}</span>
            </Button>
            {dueCount > 0 ? (
              <Button asChild variant="brand" size="sm">
                <Link to="/study/$deckId" params={{ deckId }}>
                  <GraduationCap className="size-4" /> <span className="hidden sm:inline">{t('Study', '複習')} </span>({dueCount})
                </Link>
              </Button>
            ) : null}
            {deck ? (
              <Button variant="ghost" size="sm" onClick={() => setRenameOpen(true)} title={t('Rename deck', '重新命名牌組')}>
                <Pencil className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={removeDeck}
              onBlur={() => setConfirmDel(false)}
              className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              title={t('Delete deck', '刪除牌組')}
            >
              <Trash2 className="size-4" />
              {confirmDel ? t('Delete deck?', '確定刪除牌組？') : null}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-4 sm:px-6 sm:py-6">
          {/* Flashcards (primary) */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('Flashcards', '字卡')}{' '}
              {cards?.length ? <span className="text-muted-foreground">· {cards.length}</span> : null}
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
                title={t('No flashcards in this deck', '此牌組還沒有字卡')}
                description={t('Add a card, or let a connected AI create them.', '新增一張字卡，或讓連接的 AI 為你建立。')}
                action={
                  <Button variant="brand" size="sm" onClick={() => setCardOpen(true)}>
                    <Plus className="size-4" /> {t('New card', '新增字卡')}
                  </Button>
                }
              />
            )}
          </section>

          {/* Notes (secondary) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t('Notes', '筆記')}{' '}
                {notes?.length ? <span className="text-muted-foreground">· {notes.length}</span> : null}
              </h3>
              <Button variant="ghost" size="sm" onClick={newNote}>
                <FilePlus2 className="size-4" /> {t('Note', '筆記')}
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
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at, undefined, lang)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                {t('No notes in this deck yet.', '此牌組還沒有筆記。')}
              </p>
            )}
          </section>
        </div>
      </div>
      <NewCardDialog open={cardOpen} onOpenChange={setCardOpen} deckId={deckId} />
      {deck ? <NewDeckDialog open={renameOpen} onOpenChange={setRenameOpen} deck={deck} /> : null}
    </>
  )
}
