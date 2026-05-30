import { Link, useNavigate } from '@tanstack/react-router'
import { FilePlus2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateNote, useNotes } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { relativeDue } from '@/lib/utils'

export function NotesScreen() {
  const { data: notes, isLoading } = useNotes()
  const createNote = useCreateNote()
  const navigate = useNavigate()

  async function newNote() {
    try {
      const note = await createNote.mutateAsync({ title: 'Untitled', body: '' })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create note')
    }
  }

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={notes ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : undefined}
        actions={
          <Button variant="brand" size="sm" onClick={newNote} disabled={createNote.isPending}>
            <FilePlus2 className="size-4" /> New note
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
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
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
                        {n.body.replace(/[#*_>`[\]]/g, '').slice(0, 140)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {relativeDue(n.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="No notes yet"
              description="Write your first study note, or connect an AI assistant via MCP to generate notes and flashcards for you."
              action={
                <Button variant="brand" size="sm" onClick={newNote}>
                  <FilePlus2 className="size-4" /> New note
                </Button>
              }
            />
          )}
        </div>
      </div>
    </>
  )
}
