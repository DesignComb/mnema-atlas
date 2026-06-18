import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Brush, Clock, Download, FilePlus2, FileText, Star, Tag, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateNote, useDeleteNote, useNotes, useSetNoteStarred, useSketchSave } from '@/lib/hooks'
import { AiChip, useNewSince } from '@/components/common/AiChip'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { downloadText, relativeDue, humanizeError, untitledLabel, cn } from '@/lib/utils'
import { tagColor } from '@/lib/tags'
import { useI18n } from '@/lib/i18n'
import { WhiteboardDialog } from '@/components/whiteboard/WhiteboardDialog'
import { firstImageUrl, parseScene, type SketchScene } from '@/lib/sketch'
import { removeUploadedImage } from '@/lib/upload'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import type { NoteRow } from '@/lib/database.types'

type NotesView = 'tags' | 'recent' | 'sketches'
const VIEW_KEY = 'mnema:notes-view'

function readView(): NotesView {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'recent' || v === 'sketches' ? v : 'tags'
  } catch {
    return 'tags'
  }
}

/** Starred first, then one section per tag (A→Z), untagged last. A note with
 *  several tags appears under each — sections are lenses, not folders. */
function groupByTag(notes: NoteRow[]) {
  const starred = notes.filter((n) => n.starred)
  const byTag = new Map<string, NoteRow[]>()
  const untagged: NoteRow[] = []
  for (const n of notes) {
    const tags = n.tags ?? []
    if (tags.length === 0) untagged.push(n)
    else for (const tag of tags) byTag.set(tag, [...(byTag.get(tag) ?? []), n])
  }
  const sections = [...byTag.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return { starred, sections, untagged }
}

export function NotesScreen() {
  const { data: notes, isLoading } = useNotes()
  const createNote = useCreateNote()
  const setStarred = useSetNoteStarred()
  const deleteNote = useDeleteNote()
  const sketchSave = useSketchSave()
  const hidden = useHiddenKeys()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const isNew = useNewSince('notes')
  const [view, setView] = useState<NotesView>(readView)
  const [boardOpen, setBoardOpen] = useState(false)
  const [editing, setEditing] = useState<{ noteId: string; body: string; scene: SketchScene | null } | null>(null)

  // Selected tag filter (in the URL so it's shareable / survives refresh).
  const { tag: activeTag } = useSearch({ from: '/_app/notes' }) as { tag?: string }
  const selectTag = (tg: string | undefined) => navigate({ to: '/notes', search: tg ? { tag: tg } : {} })

  // All tags + counts, for the filter chip row.
  const tagCount = new Map<string, number>()
  notes?.forEach((n) => n.tags?.forEach((tg) => tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1)))
  const tagList = [...tagCount.keys()].sort((a, b) => a.localeCompare(b))
  const filtered = activeTag ? (notes ?? []).filter((n) => n.tags?.includes(activeTag)) : null

  function switchView(v: NotesView) {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* storage unavailable — view just won't persist */
    }
  }

  async function newNote() {
    try {
      const note = await createNote.mutateAsync({ title: untitledLabel(), body: '' })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to create note', '建立筆記失敗']))
    }
  }

  function openNewSketch() {
    setEditing(null)
    setBoardOpen(true)
  }
  function openEditSketch(n: NoteRow) {
    setEditing({ noteId: n.id, body: n.body, scene: parseScene(n.sketch_scene) })
    setBoardOpen(true)
  }
  // onSave throws on failure → the board surfaces the error and stays open.
  async function handleBoardSave(blob: Blob, scene: SketchScene) {
    if (editing) {
      await sketchSave.update(editing.noteId, editing.body, blob, scene)
      toast.success(t('Drawing updated', '已更新塗鴉'))
    } else {
      await sketchSave.create(blob, scene)
      toast.success(t('Sketch saved', '已儲存塗鴉'))
      switchView('sketches')
    }
    setBoardOpen(false)
    setEditing(null)
  }
  function deleteSketch(n: NoteRow) {
    const body = n.body
    undoableDelete({
      key: `note:${n.id}`,
      message: t('Sketch deleted', '已刪除塗鴉'),
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Failed to delete', '刪除失敗'),
      commit: async () => {
        await deleteNote.mutateAsync(n.id)
        const url = firstImageUrl(body)
        if (url) await removeUploadedImage(url)
      },
    })
  }

  const row = (n: NoteRow) => (
    <NoteRowItem
      n={n}
      lang={lang}
      isNew={n.created_via === 'mcp' ? isNew(n.created_at) : false}
      onToggleStar={() => setStarred.mutate({ noteId: n.id, starred: !n.starred })}
    />
  )

  const grouped = view === 'tags' && notes?.length ? groupByTag(notes) : null

  return (
    <>
      <PageHeader
        title={t('Notes', '筆記')}
        subtitle={
          notes
            ? t(`${notes.length} note${notes.length === 1 ? '' : 's'}`, `${notes.length} 則筆記`)
            : undefined
        }
        actions={
          <div className="flex items-center gap-1.5">
            {notes && notes.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const md = notes.map((n) => `# ${n.title}\n\n${n.body ?? ''}`).join('\n\n---\n\n')
                  downloadText('mnema-notes.md', md)
                }}
              >
                <Download className="size-4" /> <span className="hidden sm:inline">{t('Export all', '全部匯出')}</span>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={openNewSketch}>
              <Brush className="size-4" /> <span className="hidden sm:inline">{t('Sketch', '塗鴉')}</span>
            </Button>
            <Button variant="brand" size="sm" onClick={newNote} disabled={createNote.isPending}>
              <FilePlus2 className="size-4" /> <span className="hidden sm:inline">{t('New note', '新增筆記')}</span>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          {notes && notes.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3">
              {/* View switch — hidden while filtering by a single tag. */}
              {!activeTag ? (
                <div
                  role="tablist"
                  aria-label={t('Notes view', '筆記檢視')}
                  className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
                >
                  {(
                    [
                      ['tags', Tag, t('By tag', '依標籤')],
                      ['recent', Clock, t('Recent', '最近')],
                      ['sketches', Brush, t('Sketches', '塗鴉')],
                    ] as const
                  ).map(([key, Icon, label]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={view === key}
                      onClick={() => switchView(key)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition',
                        view === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Filter by tag — click a tag to see only its notes. */}
              {tagList.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {tagList.map((tg) => {
                    const active = tg === activeTag
                    return (
                      <button
                        key={tg}
                        type="button"
                        onClick={() => selectTag(active ? undefined : tg)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-85',
                          active ? 'border-brand/40 ring-1 ring-brand/30 text-foreground' : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                        )}
                        title={t(`Filter “${tg}”`, `篩選「${tg}」`)}
                      >
                        <span className="size-2 rounded-full" style={{ background: tagColor(tg) }} />
                        {tg}
                        <span className="tabular-nums opacity-70">{tagCount.get(tg) ?? 0}</span>
                        {active ? <X className="size-3" /> : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : notes?.length ? (
            activeTag ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="size-2 rounded-full" style={{ background: tagColor(activeTag) }} />
                    <span>{activeTag}</span>
                    <span className="font-normal text-muted-foreground">· {filtered?.length ?? 0}</span>
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => selectTag(undefined)}>
                    <X className="size-4" /> {t('Clear', '清除')}
                  </Button>
                </div>
                {filtered?.length ? (
                  <div className="grid gap-2">
                    {filtered.map((n) => (
                      <div key={n.id}>{row(n)}</div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                    {t('No notes with this tag.', '沒有帶此標籤的筆記。')}
                  </p>
                )}
              </section>
            ) : view === 'sketches' ? (
              <SketchGrid
                notes={notes}
                hidden={hidden}
                lang={lang}
                isNew={isNew}
                onOpen={openEditSketch}
                onDelete={deleteSketch}
                onNew={openNewSketch}
              />
            ) : grouped ? (
              <div className="space-y-6">
                {grouped.starred.length > 0 ? (
                  <NoteSection
                    title={t('Starred', '已加星號')}
                    icon={<Star className="size-3.5 fill-warning text-warning" />}
                    count={grouped.starred.length}
                  >
                    {grouped.starred.map((n) => (
                      <div key={`star:${n.id}`}>{row(n)}</div>
                    ))}
                  </NoteSection>
                ) : null}
                {grouped.sections.map(([tag, rows]) => (
                  <NoteSection
                    key={tag}
                    title={tag}
                    icon={<span className="size-2 rounded-full" style={{ background: tagColor(tag) }} />}
                    count={rows.length}
                  >
                    {rows.map((n) => (
                      <div key={`${tag}:${n.id}`}>{row(n)}</div>
                    ))}
                  </NoteSection>
                ))}
                {grouped.untagged.length > 0 ? (
                  <NoteSection
                    title={t('Untagged', '未標籤')}
                    icon={<span className="size-2 rounded-full bg-muted-foreground/40" />}
                    count={grouped.untagged.length}
                  >
                    {grouped.untagged.map((n) => (
                      <div key={`untagged:${n.id}`}>{row(n)}</div>
                    ))}
                  </NoteSection>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-2">
                {notes.map((n) => (
                  <div key={n.id}>{row(n)}</div>
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title={t('No notes yet', '還沒有筆記')}
              description={t(
                'Write your first study note, or connect an AI to generate notes and flashcards for you.',
                '寫下你的第一則學習筆記，或連接 AI 為你自動產生筆記與閃卡。',
              )}
              action={
                <Button variant="brand" size="sm" onClick={newNote}>
                  <FilePlus2 className="size-4" /> {t('New note', '新增筆記')}
                </Button>
              }
            />
          )}
        </div>
      </div>
      <WhiteboardDialog
        open={boardOpen}
        onOpenChange={(v) => {
          setBoardOpen(v)
          if (!v) setEditing(null)
        }}
        initialScene={editing?.scene ?? null}
        onSave={handleBoardSave}
      />
    </>
  )
}

function NoteSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {icon}
        <span className="normal-case tracking-normal">{title}</span>
        <span className="font-normal">· {count}</span>
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  )
}

function NoteRowItem({
  n,
  lang,
  isNew,
  onToggleStar,
}: {
  n: NoteRow
  lang: 'en' | 'zh'
  isNew: boolean
  onToggleStar: () => void
}) {
  const { t } = useI18n()
  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: n.id }}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40 hover:shadow-pop"
    >
      {n.kind === 'sketch' && firstImageUrl(n.body) ? (
        <img
          src={firstImageUrl(n.body)!}
          alt=""
          loading="lazy"
          decoding="async"
          className="mt-0.5 size-10 shrink-0 rounded-md border border-border bg-card object-cover"
        />
      ) : n.kind === 'sketch' ? (
        <Brush className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
      ) : (
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="truncate">{n.title}</span>
          {n.created_via === 'mcp' ? <AiChip isNew={isNew} /> : null}
        </p>
        {n.kind === 'sketch' ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('Sketch', '塗鴉')}</p>
        ) : n.body ? (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
            {n.body.replace(/[#*_>`[\]]/g, '').slice(0, 140)}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{relativeDue(n.updated_at, undefined, lang)}</span>
      <button
        type="button"
        aria-pressed={n.starred}
        aria-label={n.starred ? t('Unstar note', '移除星號') : t('Star note', '加上星號')}
        title={n.starred ? t('Unstar', '移除星號') : t('Star', '加上星號')}
        onClick={(e) => {
          // Inside the row Link — the star must never navigate.
          e.preventDefault()
          e.stopPropagation()
          onToggleStar()
        }}
        className="-m-1 shrink-0 rounded-md p-1.5 transition hover:bg-accent"
      >
        <Star
          className={cn(
            'size-4',
            n.starred ? 'fill-warning text-warning' : 'text-muted-foreground/40 hover:text-warning',
          )}
        />
      </button>
    </Link>
  )
}

/** Gallery of saved sketches — thumbnail opens the board to keep editing. */
function SketchGrid({
  notes,
  hidden,
  lang,
  isNew,
  onOpen,
  onDelete,
  onNew,
}: {
  notes: NoteRow[]
  hidden: ReadonlySet<string>
  lang: 'en' | 'zh'
  isNew: (iso: string) => boolean
  onOpen: (n: NoteRow) => void
  onDelete: (n: NoteRow) => void
  onNew: () => void
}) {
  const { t } = useI18n()
  const sketches = notes.filter((n) => n.kind === 'sketch' && !hidden.has(`note:${n.id}`))

  if (!sketches.length) {
    return (
      <EmptyState
        icon={<Brush className="size-6" />}
        title={t('No sketches yet', '還沒有塗鴉')}
        description={t(
          'Tap Sketch to doodle on a quick whiteboard — it saves as an image you can browse and keep editing.',
          '點「塗鴉」在隨手小白板上畫畫 —— 會存成圖片，日後可瀏覽，也能再打開繼續畫。',
        )}
        action={
          <Button variant="brand" size="sm" onClick={onNew}>
            <Brush className="size-4" /> {t('Sketch', '塗鴉')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sketches.map((n) => {
        const url = firstImageUrl(n.body)
        return (
          <div
            key={n.id}
            className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-soft transition hover:border-brand/40 hover:shadow-pop"
          >
            <button
              type="button"
              onClick={() => onOpen(n)}
              title={t('Edit drawing', '編輯塗鴉')}
              className="block w-full"
            >
              {url ? (
                <img
                  src={url}
                  alt={n.title}
                  loading="lazy"
                  decoding="async"
                  className="bg-dots aspect-video w-full object-contain"
                />
              ) : (
                <div className="bg-dots flex aspect-video w-full items-center justify-center">
                  <Brush className="size-6 text-muted-foreground/50" />
                </div>
              )}
            </button>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="truncate text-[13px] font-medium text-foreground">{n.title}</span>
              {n.created_via === 'mcp' ? <AiChip isNew={isNew(n.created_at)} /> : null}
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {relativeDue(n.updated_at, undefined, lang)}
              </span>
            </div>
            {/* Touch: always visible; desktop: reveal on hover/focus. */}
            <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Link
                to="/notes/$noteId"
                params={{ noteId: n.id }}
                title={t('Open as note', '以筆記開啟')}
                className="rounded-md bg-card/90 p-1.5 text-muted-foreground shadow-soft backdrop-blur transition hover:text-foreground"
              >
                <FileText className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => onDelete(n)}
                title={t('Delete', '刪除')}
                aria-label={t('Delete sketch', '刪除塗鴉')}
                className="rounded-md bg-card/90 p-1.5 text-muted-foreground shadow-soft backdrop-blur transition hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
