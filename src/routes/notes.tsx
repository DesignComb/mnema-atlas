import { Link, useNavigate } from '@tanstack/react-router'
import { Download, FilePlus2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateNote, useNotes } from '@/lib/hooks'
import { AiChip, useNewSince } from '@/components/common/AiChip'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { downloadText, relativeDue, humanizeError, untitledLabel } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

export function NotesScreen() {
  const { data: notes, isLoading } = useNotes()
  const createNote = useCreateNote()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const isNew = useNewSince('notes')

  async function newNote() {
    try {
      const note = await createNote.mutateAsync({ title: untitledLabel(), body: '' })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to create note', '建立筆記失敗']))
    }
  }

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
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : notes?.length ? (
            <div className="grid gap-2">
              {notes.map((n) => (
                <Link
                  key={n.id}
                  to="/notes/$noteId"
                  params={{ noteId: n.id }}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40 hover:shadow-pop"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span className="truncate">{n.title}</span>
                      {n.created_via === 'mcp' ? <AiChip isNew={isNew(n.created_at)} /> : null}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
                        {n.body.replace(/[#*_>`[\]]/g, '').slice(0, 140)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {relativeDue(n.updated_at, undefined, lang)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title={t('No notes yet', '還沒有筆記')}
              description={t(
                'Write your first study note, or connect an AI to generate notes and flashcards for you.',
                '寫下你的第一則學習筆記，或連接 AI 為你自動產生筆記與字卡。',
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
