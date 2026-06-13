import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Cloud, Copy, Download, Layers, Loader2, MoreHorizontal, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { useCardsByNote, useDecks, useDeleteNote, useNote, useSetNoteDeck, useSetNoteStarred, useUpdateNote } from '@/lib/hooks'
import { buildDeckTree, flattenTree, indentLabel } from '@/lib/deck-tree'
import { downloadText, safeFilename, humanizeError } from '@/lib/utils'
import { TagEditor } from '@/components/editor/TagEditor'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// TipTap is heavy (~0.5 MB) and only the note editor needs it — split it into
// its own chunk so the note shell (title, deck, cards) paints immediately.
const NoteEditor = lazy(() =>
  import('@/components/editor/NoteEditor').then((m) => ({ default: m.NoteEditor })),
)
import { AiChip } from '@/components/common/AiChip'
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
  const { data: decks } = useDecks()
  const updateNote = useUpdateNote()
  const setNoteDeck = useSetNoteDeck()
  const setStarred = useSetNoteStarred()
  const deleteNote = useDeleteNote()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [cardOpen, setCardOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const loadedId = useRef<string | null>(null)
  // Last values actually persisted to the server. The autosave effect diffs
  // against THIS (not the react-query `note` object, which churns a new
  // reference on every refetch) so a completed save reliably lands on "Saved"
  // instead of being re-triggered into a stuck "Saving…".
  const savedRef = useRef<{ title: string; body: string } | null>(null)
  // Latest values for the unmount-time "discard abandoned blank note" cleanup.
  const discardedRef = useRef(false)
  const latest = useRef({ title: '', body: '', cards: 0 })
  latest.current = { title, body, cards: noteCards?.length ?? 0 }

  // Initialise local state once per note.
  useEffect(() => {
    if (note && loadedId.current !== note.id) {
      setTitle(note.title)
      setBody(note.body)
      savedRef.current = { title: note.title, body: note.body }
      loadedId.current = note.id
      setStatus('idle')
    }
  }, [note])

  // On leave, silently discard a note that was never filled in — so a stray
  // "New note" click doesn't litter the library with empty "Untitled" notes.
  useEffect(() => {
    return () => {
      const id = loadedId.current
      const { title: tt, body: bb, cards } = latest.current
      const blank = (!tt.trim() || tt.trim() === 'Untitled') && !bb.trim() && cards === 0
      if (id && blank && !discardedRef.current) {
        api
          .deleteNote(id)
          .then(() => {
            qc.invalidateQueries({ queryKey: ['notes'] })
            qc.invalidateQueries({ queryKey: ['graph'] })
          })
          .catch(() => {})
      }
    }
  }, [qc])

  // Debounced autosave. Deps are only the user-driven values + the note id
  // (stable across refetches), so the effect fires on real edits — never on the
  // post-save refetch or the mutation's isPending churn.
  useEffect(() => {
    const saved = savedRef.current
    if (!note || loadedId.current !== note.id || !saved) return
    const tt = title.trim() || 'Untitled'
    if (tt === saved.title && body === saved.body) {
      if (status === 'saving') setStatus('saved')
      return
    }
    setStatus('saving')
    const timer = setTimeout(() => {
      updateNote.mutate(
        { note_id: note.id, title: tt, body },
        {
          onSuccess: () => {
            savedRef.current = { title: tt, body }
            setStatus('saved')
          },
          onError: (err) => {
            setStatus('idle')
            toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
          },
        },
      )
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, note?.id])

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
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={note.starred}
              aria-label={note.starred ? t('Unstar note', '移除星號') : t('Star note', '加上星號')}
              title={note.starred ? t('Unstar', '移除星號') : t('Star', '加上星號')}
              onClick={() => setStarred.mutate({ noteId: note.id, starred: !note.starred })}
            >
              <Star className={note.starred ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground'} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('Add flashcard', '新增閃卡')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAskOpen(true)}>
              <Sparkles className="size-4" /> <span className="hidden sm:inline">{t('Ask AI', '問 AI')}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={t('Export', '匯出')} title={t('Export', '匯出')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    const md = `# ${title.trim() || t('Untitled', '未命名')}\n\n${body}`
                    downloadText(`${safeFilename(title || 'note')}.md`, md)
                  }}
                >
                  <Download /> {t('Download .md', '下載 .md')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      await navigator.clipboard.writeText(body)
                      toast.success(t('Copied markdown', '已複製 Markdown'))
                    } catch {
                      toast.error(t('Copy failed', '複製失敗'))
                    }
                  }}
                >
                  <Copy /> {t('Copy markdown', '複製 Markdown')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  discardedRef.current = true
                  await deleteNote.mutateAsync(note.id)
                  toast.success(t('Note deleted', '已刪除筆記'))
                  navigate({ to: '/notes' })
                } catch (err) {
                  toast.error(humanizeError(err, ['Failed to delete note', '刪除筆記失敗']))
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
            className="mb-3 w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-3xl"
          />
          {/* Deck — move this note between decks (or out of all of them). */}
          <div className="mb-2 flex items-center gap-2">
            <Layers className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              value={note.deck_id ?? ''}
              onChange={(e) => setNoteDeck.mutate({ noteId: note.id, deckId: e.target.value || null })}
              className="max-w-[60%] truncate rounded-md border border-border bg-card px-2 py-1 text-[13px] text-muted-foreground outline-none transition hover:text-foreground focus:border-brand"
            >
              <option value="">{t('No deck', '無牌組')}</option>
              {flattenTree(buildDeckTree(decks ?? [])).map(({ deck: d, depth }) => (
                <option key={d.id} value={d.id}>
                  {indentLabel(d.name, depth)}
                </option>
              ))}
            </select>
            {setNoteDeck.isPending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
            {note.created_via === 'mcp' ? <AiChip /> : null}
          </div>
          {/* Tags — colour & cluster this note in the graph. */}
          <div className="mb-6">
            <TagEditor noteId={note.id} tags={note.tags ?? []} />
          </div>
          <Suspense fallback={<div className="mt-2 h-64 animate-pulse rounded-lg bg-card/60" />}>
            <NoteEditor
              key={note.id}
              value={body}
              onChange={setBody}
              // Reading is the common case — open written notes in Preview;
              // blank/new notes land in Write (nothing to preview yet).
              defaultMode={note.body.trim() ? 'preview' : 'write'}
              placeholder={t(
                'Start writing — markdown supported. Your notes become flashcards and graph nodes…',
                '開始書寫 — 支援 Markdown。你的筆記會變成閃卡與圖譜節點…',
              )}
            />
          </Suspense>

          {noteCards && noteCards.length > 0 ? (
            <section className="mt-10 space-y-3 border-t border-border pt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="size-4 text-muted-foreground" /> {t('Flashcards from this note', '此筆記的閃卡')}
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
