import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowRight, FileText, GraduationCap, Layers, Sparkles } from 'lucide-react'
import { useDecks, useDueCards, useNotes } from '@/lib/hooks'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { relativeDue } from '@/lib/utils'

export function HomeScreen() {
  const { data: due } = useDueCards()
  const { data: notes } = useNotes()
  const { data: decks } = useDecks()

  const dueCount = due?.length ?? 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <PageHeader title="Today" subtitle={today} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
          {/* Review hero */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-muted/70 to-card p-6 shadow-soft"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-brand">Spaced repetition</p>
                <h2 className="font-serif text-2xl text-foreground">
                  {dueCount > 0 ? (
                    <>
                      {dueCount} card{dueCount === 1 ? '' : 's'} due
                    </>
                  ) : (
                    'All caught up 🌿'
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {dueCount > 0
                    ? 'Review them now to keep your memory fresh.'
                    : 'Nothing to review right now. Add notes or come back later.'}
                </p>
              </div>
              <GraduationCap className="size-12 shrink-0 text-brand/30" />
            </div>
            {dueCount > 0 ? (
              <Button asChild variant="brand" className="mt-4">
                <Link to="/study">
                  Start review <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </motion.section>

          {/* Stat tiles */}
          <section className="grid grid-cols-3 gap-3">
            <StatTile icon={<Layers className="size-4" />} label="Decks" value={decks?.length ?? 0} />
            <StatTile icon={<FileText className="size-4" />} label="Notes" value={notes?.length ?? 0} />
            <StatTile icon={<GraduationCap className="size-4" />} label="Due now" value={dueCount} />
          </section>

          {/* Recent notes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Recent notes</h3>
              <Link to="/notes" className="text-xs font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {notes?.length ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {notes.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/50"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-brand" />
                No notes yet — press <kbd className="rounded border border-border bg-card px-1.5 text-xs">⌘K</kbd>{' '}
                to create one, or connect an AI assistant to fill them in for you.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
