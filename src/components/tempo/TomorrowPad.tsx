import { useEffect, useRef, useState } from 'react'
import { Check, Cloud, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { useT } from '@/lib/i18n'
import { humanizeError } from '@/lib/utils'

// A single, persistent free-text scratchpad — "what I'll do tomorrow", jotted
// the night before. No time, no checkboxes: it's just one Note, reused.
//
// The note is resolved by its stable title, NOT only by a localStorage id, so it
// stays a SINGLE note across devices, cache clears, and private windows (an id
// that fails to persist would otherwise spawn a fresh note every visit). The
// localStorage id is kept purely as a fast path to skip the list scan.
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

  // Resolve (or create) the scratchpad note on mount. `cancelled` (set by the
  // cleanup) makes StrictMode's mount→unmount→remount land on the second run
  // instead of getting stuck, and avoids setState after unmount.
  useEffect(() => {
    let cancelled = false
    const adopt = (note: { id: string; body: string }) => {
      localStorage.setItem(STORE_KEY, note.id)
      setNoteId(note.id)
      setBody(note.body)
      savedRef.current = note.body
      setLoading(false)
    }
    async function resolve() {
      try {
        // 1. Fast path: the id we cached last time still resolves.
        const stored = localStorage.getItem(STORE_KEY)
        if (stored) {
          const note = await api.getNote(stored)
          if (cancelled) return
          if (note) return adopt(note)
        }
        // 2. Stable path: find the existing pad by title (newest-edited first,
        //    since listNotes orders by updated_at desc). This is what stops a
        //    new "Tomorrow" note being spawned when the cached id is gone.
        const existing = (await api.listNotes()).find((n) => n.title === NOTE_TITLE)
        if (cancelled) return
        if (existing) return adopt(existing)
        // 3. None exists yet — create the one and only pad.
        const created = await api.createNote({ title: NOTE_TITLE, body: '' })
        if (cancelled) return
        adopt(created)
      } catch (e) {
        if (cancelled) return
        setLoading(false)
        toast.error(humanizeError(e, ['Failed to open the pad', '開啟便箋失敗']))
      }
    }
    void resolve()
    return () => {
      cancelled = true
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
