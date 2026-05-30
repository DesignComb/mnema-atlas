import { useEffect, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Check, Cloud, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useNote, useUpdateNote } from '@/lib/hooks'
import { NoteEditor } from '@/components/editor/NoteEditor'
import { NewCardDialog } from '@/components/cards/NewCardDialog'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'

type SaveStatus = 'idle' | 'saving' | 'saved'

export function NoteScreen() {
  const { noteId } = useParams({ strict: false }) as { noteId: string }
  const { data: note, isLoading } = useNote(noteId)
  const updateNote = useUpdateNote()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [cardOpen, setCardOpen] = useState(false)
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
          <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
            <Plus className="size-4" /> Add flashcard
          </Button>
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
        </div>
      </div>
      <NewCardDialog
        open={cardOpen}
        onOpenChange={setCardOpen}
        noteId={note.id}
        deckId={note.deck_id ?? undefined}
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
