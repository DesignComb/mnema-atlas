import { Fragment, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useNotes } from '@/lib/hooks'
import { buildTitleIndex, normalizeTitle, splitWikilinks } from '@/lib/wikilink'

/**
 * Resolve `[[title]]` → note id, by title (the AI has no UUIDs, so wikilinks
 * reference notes the same way the import path does). Reads the cached notes
 * list; the index is rebuilt only when that list changes.
 */
export function useNoteResolver(): (title: string) => string | null {
  const { data: notes } = useNotes()
  const index = useMemo(() => buildTitleIndex(notes ?? []), [notes])
  return useMemo(() => (title: string) => index.get(normalizeTitle(title)) ?? null, [index])
}

/**
 * Render a plain-text string with `[[title]]` references turned into links.
 * Used for flashcard front/back (which are plain text, not markdown). A resolved
 * link navigates to the note; an unresolved one shows muted and inert.
 *
 * `stopPropagation` on the link keeps a tap from also triggering an enclosing
 * click target (e.g. the review card's flip area).
 */
export function Wikilinked({ text, className }: { text: string; className?: string }) {
  const resolve = useNoteResolver()
  const segments = useMemo(() => splitWikilinks(text), [text])

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <Fragment key={i}>{seg.value}</Fragment>
        const id = resolve(seg.title)
        if (!id)
          return (
            <span key={i} className="wikilink-unresolved" title={seg.title}>
              {seg.title}
            </span>
          )
        return (
          <Link
            key={i}
            to="/notes/$noteId"
            params={{ noteId: id }}
            className={cn('wikilink')}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.title}
          </Link>
        )
      })}
    </span>
  )
}
