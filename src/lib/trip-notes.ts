/**
 * Pure helpers for trip notes (備忘錄): iCloud-style "first line is the title",
 * list snippets, and tappable `- [ ]` checklist lines in the rendered view.
 * Kept free of React/Supabase so they're unit-tested in isolation.
 */

const CHECK_RE = /^(\s*[-*+]\s+\[)( |x|X)(\]\s?)(.*)$/

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

export type NoteSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'check'; line: number; checked: boolean; text: string }

/**
 * Split a body into markdown runs and individual checklist lines (with their
 * 0-based line index), so the view can render checkboxes as real buttons and
 * map a tap back to exactly one source line. Fenced code blocks are never split.
 */
export function splitChecklist(body: string): NoteSegment[] {
  const out: NoteSegment[] = []
  let buf: string[] = []
  let inFence = false
  const flush = () => {
    if (buf.length) out.push({ kind: 'markdown', text: buf.join('\n') })
    buf = []
  }
  body.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const m = inFence ? null : CHECK_RE.exec(line)
    if (m) {
      flush()
      out.push({ kind: 'check', line: i, checked: m[2] !== ' ', text: m[4] })
    } else {
      buf.push(line)
    }
  })
  flush()
  return out
}

/**
 * Set the checkbox on source line `line` to `checked`. Returns the body
 * unchanged when that line isn't a checklist line (e.g. a collaborator's
 * edit moved it), so a stale tap can never corrupt unrelated text.
 */
export function setChecklistLine(body: string, line: number, checked: boolean): string {
  const lines = body.split('\n')
  const m = CHECK_RE.exec(lines[line] ?? '')
  if (!m) return body
  lines[line] = `${m[1]}${checked ? 'x' : ' '}${m[3]}${m[4]}`
  return lines.join('\n')
}

/** True when an RPC error is update_trip_note's optimistic-concurrency 'conflict'. */
export function isNoteConflict(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === '40001' || e?.message === 'conflict'
}
