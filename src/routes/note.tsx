import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Check, Cloud, Layers, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCardsByNote, useDeleteNote, useNote, useUpdateNote } from '@/lib/hooks'
import { NoteEditor } from '@/components/editor/NoteEditor'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { FlashcardTile } from '@/components/cards/FlashcardTile'
import { AskAiDialog } from '@/components/cards/AskAiDialog'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'

type SaveStatus = 'idle' | 'saving' | 'saved'

export function NoteScreen() {
  const { noteId } = useParams({ strict: false }) as { noteId: string }
  const { data: note, isLoading } = useNote(noteId)
  const { data: noteCards } = useCardsByNote(noteId)
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [cardOpen, setCardOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const loadedId = useRef<string | null>(null)

  // Initialise local state once per note.
  useEffect(() => {
    if (note && loadedId.current !== note.id) {
      setTitle(note.title)
      setBody(note.body)
      loadedId.current = note.id
      setStatus('idle')
    }
  }, [note])

  // Debounced autosave.
  useEffect(() => {
    if (!note || loadedId.current !== note.id) return
    if (title === note.title && body === note.body) return
    setStatus('saving')
    const t = setTimeout(async () => {
      try {
        await updateNote.mutateAsync({ note_id: note.id, title: title.trim() || 'Untitled', body })
        setStatus('saved')
      } catch (err) {
        setStatus('idle')
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    }, 700)
    return () => clearTimeout(t)
  }, [title, body, note, updateNote])

  if (isLoading) {
    return (
      <>
        <PageHeader title="Note" />
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
          <div className="h-9 w-2/3 animate-pulse rounded bg-card" />
          <div className="h-64 animate-pulse rounded bg-card/60" />
        </div>
      </>
    )
  }

  if (!note) {
    return <PageHeader title="Note not found" subtitle="It may have been deleted." />
  }

  return (
    <>
      <PageHeader
        title={title || 'Untitled'}
        subtitle={<SaveIndicator status={status} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> Add flashcard
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAskOpen(true)}>
              <Sparkles className="size-4" /> Ask AI
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onBlur={() => setConfirmDel(false)}
              className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              title="Delete note"
              onClick={async () => {
                if (!confirmDel) {
                  setConfirmDel(true)
                  return
                }
                try {
                  await deleteNote.mutateAsync(note.id)
                  toast.success('Note deleted')
                  navigate({ to: '/notes' })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete note')
                }
              }}
            >
              <Trash2 className="size-4" />
              {confirmDel ? 'Delete note?' : null}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="mb-4 w-full bg-transparent font-serif text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <NoteEditor key={note.id} initialMarkdown={note.body} onChange={setBody} />

          {noteCards && noteCards.length > 0 ? (
            <section className="mt-10 space-y-3 border-t border-border pt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="size-4 text-muted-foreground" /> Flashcards from this note
                <span className="font-normal text-muted-foreground">· {noteCards.length}</span>
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {noteCards.map((c) => (
                  <FlashcardTile key={c.id} card={c} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
      <NewCardDialog
        open={cardOpen}
        onOpenChange={setCardOpen}
        noteId={note.id}
        deckId={note.deck_id ?? undefined}
      />
      <AskAiDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        prompt={`Make concise spaced-repetition flashcards from the note below. Reply with ONLY a fenced code block tagged mnema containing JSON like {"cards":[{"front":"...","back":"...","note":"${title || 'Untitled'}"}]}.\n\nNote "${title || 'Untitled'}":\n${body}`}
      />
    </>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    )
  if (status === 'saved')
    return (
      <span className="flex items-center gap-1.5 text-brand">
        <Check className="size-3" /> Saved
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Cloud className="size-3" /> Autosaves as you type
    </span>
  )
}
