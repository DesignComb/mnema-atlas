import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FileText, Pencil } from 'lucide-react'
import type { CardRow } from '@/lib/database.types'
import { relativeDue } from '@/lib/utils'
import { NewCardDialog } from './NewCardDialog'

/** FSRS state → label + colour, so each card shows its learning status at a glance. */
const STATE_META: Record<number, { label: string; cls: string }> = {
  0: { label: 'New', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  1: { label: 'Learning', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  2: { label: 'Review', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  3: { label: 'Relearning', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
}

export function FlashcardTile({ card, noteTitle }: { card: CardRow; noteTitle?: string }) {
  const [editing, setEditing] = useState(false)
  const meta = STATE_META[card.state] ?? STATE_META[0]
  return (
    <div className="group relative rounded-xl border border-border bg-card p-3.5 shadow-soft">
      <button
        onClick={() => setEditing(true)}
        className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 transition hover:text-brand group-hover:opacity-100"
        title="Edit card"
      >
        <Pencil className="size-3.5" />
      </button>
      <p className="line-clamp-2 pr-7 font-serif text-sm font-medium text-foreground">{card.front}</p>
      <p className="mt-1 line-clamp-2 font-serif text-[13px] text-muted-foreground">{card.back}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
        <span className="text-[11px] text-muted-foreground/80">due {relativeDue(card.due)}</span>
        {card.reps > 0 ? (
          <span className="text-[11px] text-muted-foreground/70">· {card.reps} review{card.reps === 1 ? '' : 's'}</span>
        ) : null}
        {card.lapses > 0 ? <span className="text-[11px] text-muted-foreground/70">· {card.lapses} lapse{card.lapses === 1 ? '' : 's'}</span> : null}
        {card.created_via !== 'ui' ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">via {card.created_via}</span>
        ) : null}
        {noteTitle && card.note_id ? (
          <Link
            to="/notes/$noteId"
            params={{ noteId: card.note_id }}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:text-brand"
          >
            <FileText className="size-2.5" /> {noteTitle}
          </Link>
        ) : null}
      </div>
      <NewCardDialog open={editing} onOpenChange={setEditing} card={card} />
    </div>
  )
}
