/**
 * Pure helpers for trip notes (備忘錄): iCloud-style "first line is the title",
 * list snippets, and the update RPC's conflict error.
 * Kept free of React/Supabase so they're unit-tested in isolation.
 */

/** Strip leading markdown markers (#, >, list bullets, checkboxes) and inline emphasis. */
function plainLine(line: string): string {
  return line
    .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s*)?|\d+\.\s+)/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim()
}

/** First non-empty line, as plain text — the note's title when none is set. */
export function deriveTitle(body: string): string {
  for (const line of body.split('\n')) {
    const p = plainLine(line)
    if (p) return p.slice(0, 120)
  }
  return ''
}

/** Plain-text preview of everything after the title line, for the note list. */
export function noteSnippet(body: string, max = 80): string {
  const lines = body.split('\n').map(plainLine).filter(Boolean)
  return lines.slice(1).join(' ').slice(0, max)
}

export function noteTitle(n: { title: string; body: string }): string {
  return n.title.trim() || deriveTitle(n.body)
}

/** True when an RPC error is update_trip_note's optimistic-concurrency 'conflict'. */
export function isNoteConflict(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === '40001' || e?.message === 'conflict'
}
