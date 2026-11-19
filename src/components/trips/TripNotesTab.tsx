import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, NotebookPen, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import type { ItineraryTree, TripNote } from '@/lib/api'
import { useCreateTripNote, useDeleteTripNote, useTripNotes, useUpdateTripNote } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { useI18n, useT } from '@/lib/i18n'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import { cn, humanizeError, relativeDue } from '@/lib/utils'
import { deriveTitle, isNoteConflict, noteSnippet, noteTitle } from '@/lib/trip-notes'
import { RichNoteEditor } from '@/components/trips/RichNoteEditor'
import { EmptyState } from '@/components/app-shell/PageHeader'
import { AiChip } from '@/components/common/AiChip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SAVE_DEBOUNCE_MS = 1000
const noteKey = (id: string) => `trip-note:${id}`

/**
 * 備忘錄 — iCloud-Notes-style shared notes for one trip. Owner + editors write,
 * viewers read. Collaboration is "take turns": autosave carries the version it
 * was based on, and a collaborator's newer save surfaces a reload/overwrite
 * banner instead of being silently clobbered (see update_trip_note, 0050).
 */
export function TripNotesTab({ trip, canEdit }: { trip: ItineraryTree; canEdit: boolean }) {
  const t = useT()
  const { data: notes = [], isLoading } = useTripNotes(trip.id)
  const hidden = useHiddenKeys()
  const create = useCreateTripNote()
  const del = useDeleteTripNote()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const visible = notes
    .filter((n) => !hidden.has(noteKey(n.id)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at))
  const q = query.trim().toLowerCase()
  const shown = q ? visible.filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(q)) : visible
  const selected = visible.find((n) => n.id === selectedId) ?? null

  async function newNote() {
    try {
      const n = await create.mutateAsync({ itinerary_id: trip.id, body: '' })
      setQuery('')
      setSelectedId(n.id)
    } catch (err) {
      toast.error(humanizeError(err, ['Could not create note', '無法新增備忘錄']))
    }
  }

  function remove(n: TripNote) {
    if (selectedId === n.id) setSelectedId(null)
    undoableDelete({
      key: noteKey(n.id),
      message: t('Note deleted', '已刪除備忘錄'),
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Could not delete the note', '無法刪除備忘錄'),
      commit: () => del.mutateAsync({ id: n.id, itineraryId: trip.id }),
    })
  }

  if (!isLoading && !visible.length) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-6" />}
        title={t('No notes yet', '還沒有備忘錄')}
        description={
          canEdit
            ? t('Jot down visas, must-eats, transit tips — everyone on the trip can edit.', '記下簽證、必吃清單、交通攻略——同行的人都能一起編輯。')
            : undefined
        }
        action={
          canEdit ? (
            <Button variant="brand" onClick={newNote} disabled={create.isPending}>
              <Plus /> {t('New note', '新增備忘錄')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
      {/* List — hidden on mobile while a note is open */}
      <div className={cn('space-y-2', selected && 'hidden lg:block')}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search notes', '搜尋備忘錄')}
              className="pl-8"
            />
          </div>
          {canEdit ? (
            <Button
              variant="brand"
              size="icon"
              onClick={newNote}
              disabled={create.isPending}
              aria-label={t('New note', '新增備忘錄')}
              title={t('New note', '新增備忘錄')}
            >
              <Plus />
            </Button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {shown.length ? (
            shown.map((n) => (
              <NoteRow key={n.id} note={n} active={n.id === selectedId} onClick={() => setSelectedId(n.id)} />
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isLoading ? t('Loading…', '載入中…') : t('No matching notes', '找不到符合的備忘錄')}
            </p>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className={cn(!selected && 'hidden lg:block')}>
        {selected ? (
          <NotePane
            key={selected.id}
            note={selected}
            canEdit={canEdit}
            onBack={() => setSelectedId(null)}
            onDelete={() => remove(selected)}
          />
        ) : (
          <div className="flex h-full min-h-60 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            {t('Select a note', '選一則備忘錄')}
          </div>
        )}
      </div>
    </div>
  )
}

function useEditorName() {
  const t = useT()
  const { user } = useAuth()
  return (id: string | null, name: string | null) =>
    id && id === user?.id ? t('You', '你') : name || t('Someone', '某人')
}

function NoteRow({ note, active, onClick }: { note: TripNote; active: boolean; onClick: () => void }) {
  const t = useT()
  const { lang } = useI18n()
  const who = useEditorName()
  const title = noteTitle(note)
  const snippet = noteSnippet(note.body)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full border-b border-border/60 px-3 py-2.5 text-left transition last:border-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active && 'bg-brand-muted hover:bg-brand-muted',
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.pinned ? <Pin className="size-3.5 shrink-0 text-brand" aria-label={t('Pinned', '已釘選')} /> : null}
        <span className={cn('truncate text-sm font-semibold', title ? 'text-foreground' : 'text-muted-foreground')}>
          {title || t('New note', '新備忘錄')}
        </span>
        {note.created_via === 'mcp' ? <AiChip className="ml-auto" /> : null}
      </div>
      {snippet ? <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{snippet}</p> : null}
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
        {who(note.updated_by, note.updated_by_name)} · {relativeDue(note.updated_at, new Date(), lang)}
      </p>
    </button>
  )
}

type SaveStatus = 'saved' | 'dirty' | 'saving'

function NotePane({
  note,
  canEdit,
  onBack,
  onDelete,
}: {
  note: TripNote
  canEdit: boolean
  onBack: () => void
  onDelete: () => void
}) {
  const t = useT()
  const { lang } = useI18n()
  const who = useEditorName()
  const qc = useQueryClient()
  const update = useUpdateTripNote()

  const [draft, setDraft] = useState(note.body)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [conflict, setConflict] = useState(false)
  // Refs mirror state for async save callbacks (closures would be stale).
  const draftRef = useRef(draft)
  draftRef.current = draft
  const baseRef = useRef(note.updated_at) // the version our draft is based on
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pendingRef = useRef(false)
  const conflictRef = useRef(false)
  conflictRef.current = conflict
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetch = () => qc.invalidateQueries({ queryKey: ['trip-notes', note.itinerary_id] })

  async function save(patch: { body?: string; pinned?: boolean }, expected: string | undefined) {
    savingRef.current = true
    setStatus('saving')
    try {
      const n = await update.mutateAsync({
        note_id: note.id,
        ...(patch.body !== undefined ? { body: patch.body, title: deriveTitle(patch.body) } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        expected_updated_at: expected,
      })
      baseRef.current = n.updated_at
      // Only clear dirty if nothing was typed while this save was in flight.
      if (patch.body !== undefined && draftRef.current === patch.body) dirtyRef.current = false
      setStatus(dirtyRef.current ? 'dirty' : 'saved')
    } catch (err) {
      if (isNoteConflict(err)) {
        setConflict(true)
        void refetch()
      } else {
        toast.error(humanizeError(err, ['Could not save the note', '無法儲存備忘錄']))
      }
      setStatus(dirtyRef.current ? 'dirty' : 'saved')
    } finally {
      savingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        flush()
      }
    }
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!dirtyRef.current || conflictRef.current) return
    if (savingRef.current) {
      pendingRef.current = true
      return
    }
    void save({ body: draftRef.current }, baseRef.current)
  }

  function edit(next: string) {
    if (next === draftRef.current) return
    setDraft(next)
    draftRef.current = next
    dirtyRef.current = true
    setStatus('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }

  // A collaborator (or AI) saved a newer version: adopt it when we have nothing
  // unsaved; otherwise surface the conflict instead of overwriting either side.
  useEffect(() => {
    if (savingRef.current || note.updated_at === baseRef.current) return
    if (!dirtyRef.current) {
      setDraft(note.body)
      draftRef.current = note.body
      baseRef.current = note.updated_at
    } else {
      setConflict(true)
    }
  }, [note.updated_at, note.body])

  // Leaving the note (switch / back / tab change): best-effort save of unsaved text.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (!dirtyRef.current || conflictRef.current) return
      const body = draftRef.current
      api
        .updateTripNote({ note_id: note.id, body, title: deriveTitle(body), expected_updated_at: baseRef.current })
        .then(() => refetch())
        .catch((err) =>
          toast.error(
            isNoteConflict(err)
              ? t('Not saved — someone else updated that note first.', '未儲存——其他人已先更新了那則備忘錄。')
              : humanizeError(err, ['Could not save the note', '無法儲存備忘錄']),
          ),
        )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  function loadLatest() {
    if (timer.current) clearTimeout(timer.current)
    setDraft(note.body)
    draftRef.current = note.body
    baseRef.current = note.updated_at
    dirtyRef.current = false
    setConflict(false)
    setStatus('saved')
  }

  function overwrite() {
    setConflict(false)
    conflictRef.current = false
    void save({ body: draftRef.current }, undefined)
  }

  const statusLabel =
    status === 'saving' ? t('Saving…', '儲存中…') : status === 'dirty' ? t('Unsaved', '未儲存') : t('Saved', '已儲存')

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-soft sm:p-4">
      <div className="flex items-center gap-1.5">
        <Button variant="subtle" size="icon-sm" onClick={onBack} className="lg:hidden" aria-label={t('Back', '返回')}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1 text-[12px] text-muted-foreground">
          <span>
            {who(note.updated_by, note.updated_by_name)} · {relativeDue(note.updated_at, new Date(), lang)}
          </span>
          {canEdit ? (
            <span className="ml-2 inline-flex items-center gap-1">
              {status === 'saved' ? <Check className="size-3" /> : null}
              {statusLabel}
            </span>
          ) : null}
        </div>
        {note.created_via === 'mcp' ? <AiChip /> : null}
        {canEdit ? (
          <>
            <Button
              variant="subtle"
              size="icon-sm"
              onClick={() => void save({ pinned: !note.pinned }, baseRef.current)}
              aria-label={note.pinned ? t('Unpin', '取消釘選') : t('Pin', '釘選')}
              title={note.pinned ? t('Unpin', '取消釘選') : t('Pin', '釘選')}
            >
              {note.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button
              variant="subtle"
              size="icon-sm"
              onClick={onDelete}
              className="hover:text-destructive"
              aria-label={t('Delete note', '刪除備忘錄')}
              title={t('Delete note', '刪除備忘錄')}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
      </div>

      {conflict ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand/40 bg-brand-muted px-3 py-2 text-[13px] text-foreground">
          <span className="flex-1">
            {t(
              `${who(note.updated_by, note.updated_by_name)} just updated this note.`,
              `${who(note.updated_by, note.updated_by_name)} 剛更新了這則備忘錄。`,
            )}
          </span>
          <Button size="sm" variant="outline" onClick={loadLatest}>
            {t('Load latest', '載入最新版')}
          </Button>
          <Button size="sm" variant="ghost" onClick={overwrite}>
            {t('Keep mine', '仍用我的版本覆蓋')}
          </Button>
        </div>
      ) : null}

      {canEdit || draft.trim() ? (
        <RichNoteEditor
          value={draft}
          onChange={canEdit ? edit : undefined}
          editable={canEdit}
          placeholder={t('The first line becomes the title…', '第一行就是標題……')}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('This note is empty.', '這則備忘錄是空的。')}</p>
      )}
    </div>
  )
}
