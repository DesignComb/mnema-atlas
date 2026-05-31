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
import { useT } from '@/lib/i18n'

type SaveStatus = 'idle' | 'saving' | 'saved'

export function NoteScreen() {
  const t = useT()
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
    const timer = setTimeout(async () => {
      try {
        await updateNote.mutateAsync({ note_id: note.id, title: title.trim() || 'Untitled', body })
        setStatus('saved')
      } catch (err) {
        setStatus('idle')
        toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [title, body, note, updateNote, t])

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('Note', '筆記')} />
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
          <div className="h-9 w-2/3 animate-pulse rounded bg-card" />
          <div className="h-64 animate-pulse rounded bg-card/60" />
        </div>
      </>
    )
  }

  if (!note) {
    return <PageHeader title={t('Note not found', '找不到筆記')} subtitle={t('It may have been deleted.', '它可能已被刪除。')} />
  }

  return (
    <>
      <PageHeader
        title={title || t('Untitled', '未命名')}
        subtitle={<SaveIndicator status={status} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('Add flashcard', '新增字卡')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAskOpen(true)}>
              <Sparkles className="size-4" /> <span className="hidden sm:inline">{t('Ask AI', '問 AI')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onBlur={() => setConfirmDel(false)}
              className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
              title={t('Delete note', '刪除筆記')}
              onClick={async () => {
                if (!confirmDel) {
                  setConfirmDel(true)
                  return
                }
                try {
                  await deleteNote.mutateAsync(note.id)
                  toast.success(t('Note deleted', '已刪除筆記'))
                  navigate({ to: '/notes' })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('Failed to delete note', '刪除筆記失敗'))
                }
              }}
            >
              <Trash2 className="size-4" />
              {confirmDel ? t('Delete note?', '確定刪除筆記？') : null}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Untitled', '未命名')}
            className="mb-4 w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-3xl"
          />
          <NoteEditor key={note.id} initialMarkdown={note.body} onChange={setBody} />

          {noteCards && noteCards.length > 0 ? (
            <section className="mt-10 space-y-3 border-t border-border pt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="size-4 text-muted-foreground" /> {t('Flashcards from this note', '此筆記的字卡')}
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
  const t = useT()
  if (status === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> {t('Saving…', '儲存中…')}
      </span>
    )
  if (status === 'saved')
    return (
      <span className="flex items-center gap-1.5 text-brand">
        <Check className="size-3" /> {t('Saved', '已儲存')}
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Cloud className="size-3" /> {t('Autosaves as you type', '輸入時自動儲存')}
    </span>
  )
}
