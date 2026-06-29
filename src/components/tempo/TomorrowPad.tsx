import { useEffect, useRef, useState } from 'react'
import { Check, Cloud, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { useT } from '@/lib/i18n'
import { humanizeError } from '@/lib/utils'

// A single, persistent free-text scratchpad — "what I'll do tomorrow", jotted
// the night before. No time, no checkboxes: it's just one Note, reused. The
// note id is remembered per-device in localStorage; if it's missing (first run)
// or stale (the note was deleted elsewhere), we create a fresh one.
const STORE_KEY = 'mnema:tomorrow-note'
const NOTE_TITLE = 'Tomorrow · 明天'

type Status = 'idle' | 'saving' | 'saved'

export function TomorrowPad() {
  const t = useT()
  const [noteId, setNoteId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  // Last value persisted to the server — the autosave effect diffs against this.
  const savedRef = useRef('')
  // Guards the resolve effect against React 18 StrictMode's double-invoke (which
  // would otherwise create two notes on first visit).
  const resolving = useRef(false)

  // Resolve (or create) the scratchpad note exactly once on mount.
  useEffect(() => {
    let alive = true
    async function resolve() {
      if (resolving.current) return
      resolving.current = true
      try {
        const stored = localStorage.getItem(STORE_KEY)
        if (stored) {
          const note = await api.getNote(stored)
          if (note && alive) {
            setNoteId(note.id)
            setBody(note.body)
            savedRef.current = note.body
            setLoading(false)
            return
          }
          // Stored id no longer resolves (note deleted) — drop it and recreate.
          localStorage.removeItem(STORE_KEY)
        }
        const created = await api.createNote({ title: NOTE_TITLE, body: '' })
        if (!alive) return
        localStorage.setItem(STORE_KEY, created.id)
        setNoteId(created.id)
        setBody('')
        savedRef.current = ''
        setLoading(false)
      } catch (e) {
        if (!alive) return
        setLoading(false)
        toast.error(humanizeError(e, ['Failed to open the pad', '開啟便箋失敗']))
      } finally {
        resolving.current = false
      }
    }
    void resolve()
    return () => {
      alive = false
    }
  }, [])

  // Debounced autosave — fires only on real edits, never on the initial load.
  useEffect(() => {
    if (loading || !noteId) return
    if (body === savedRef.current) {
      if (status === 'saving') setStatus('saved')
      return
    }
    setStatus('saving')
    const timer = setTimeout(() => {
      api
        .updateNote({ note_id: noteId, body })
        .then(() => {
          savedRef.current = body
          setStatus('saved')
        })
        .catch((e) => {
          setStatus('idle')
          toast.error(humanizeError(e, ['Failed to save', '儲存失敗']))
        })
    }, 700)
    return () => clearTimeout(timer)
    // `status` is read but intentionally not a dep — it must not re-trigger saves.
  }, [body, noteId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          {t('Jot down what you want to do tomorrow.', '寫下你明天想做的事。')}
        </p>
        <SaveIndicator status={loading ? 'idle' : status} />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={loading}
        autoFocus
        placeholder={t('Start typing…', '開始打字…')}
        className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3.5 text-[15px] leading-relaxed text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/50 focus:border-brand/50 disabled:opacity-60"
      />
    </div>
  )
}

function SaveIndicator({ status }: { status: Status }) {
  const t = useT()
  if (status === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> {t('Saving…', '儲存中…')}
      </span>
    )
  if (status === 'saved')
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-brand">
        <Check className="size-3" /> {t('Saved', '已儲存')}
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <Cloud className="size-3" /> {t('Autosaves as you type', '輸入時自動儲存')}
    </span>
  )
}
