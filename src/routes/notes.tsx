import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Clock, Download, FilePlus2, FileText, Star, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateNote, useNotes, useSetNoteStarred } from '@/lib/hooks'
import { AiChip, useNewSince } from '@/components/common/AiChip'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { downloadText, relativeDue, humanizeError, untitledLabel, cn } from '@/lib/utils'
import { tagColor } from '@/lib/tags'
import { useI18n } from '@/lib/i18n'
import type { NoteRow } from '@/lib/database.types'

type NotesView = 'tags' | 'recent'
const VIEW_KEY = 'mnema:notes-view'

function readView(): NotesView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'recent' ? 'recent' : 'tags'
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
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const isNew = useNewSince('notes')
  const [view, setView] = useState<NotesView>(readView)

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
            <Button variant="brand" size="sm" onClick={newNote} disabled={createNote.isPending}>
              <FilePlus2 className="size-4" /> <span className="hidden sm:inline">{t('New note', '新增筆記')}</span>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          {notes && notes.length > 0 ? (
            // View switch — by-tag is the default lens; Recent is the flat stack.
            <div
              role="tablist"
              aria-label={t('Notes view', '筆記檢視')}
              className="mb-4 inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
            >
              {(
                [
                  ['tags', Tag, t('By tag', '依標籤')],
                  ['recent', Clock, t('Recent', '最近')],
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

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : notes?.length ? (
            grouped ? (
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
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="truncate">{n.title}</span>
          {n.created_via === 'mcp' ? <AiChip isNew={isNew} /> : null}
        </p>
        {n.body ? (
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
