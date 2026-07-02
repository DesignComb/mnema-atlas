/**
 * `[[Note title]]` wikilinks — the shared, framework-free core.
 *
 * Notes and flashcards both let you reference another note with Obsidian-style
 * double brackets. The AI (via MCP) has no note UUIDs, so — like the AI-import
 * path (title-as-ref) — a wikilink resolves by **title**, not id. This module is
 * the pure tokenizer + title normaliser; the React glue (resolver hook, the
 * flashcard renderer, the TipTap node) lives alongside their surfaces.
 */

/** One piece of a body: literal text, or a `[[…]]` reference by title. */
export type WikilinkSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; title: string }

// Inner text may not contain brackets — keeps `[[a]] [[b]]` from greedily merging.
const WIKILINK_RE = /\[\[([^[\]]+?)\]\]/g

/**
 * Fold a title to a comparison key: trimmed, inner whitespace collapsed, lower-cased.
 * So `[[  React 19  Notes ]]` matches a note titled "React 19 Notes". (CJP titles
 * are unaffected by case-folding; the whitespace collapse still helps.)
 */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Split a body into text / wikilink segments in order. Empty `[[]]` (no title
 * after trimming) is left as literal text — it isn't a real reference.
 */
export function splitWikilinks(text: string): WikilinkSegment[] {
  const out: WikilinkSegment[] = []
  let last = 0
  for (const m of text.matchAll(WIKILINK_RE)) {
    const title = m[1].trim()
    if (!title) continue // `[[ ]]` — not a link
    const at = m.index ?? 0
    if (at > last) out.push({ type: 'text', value: text.slice(last, at) })
    out.push({ type: 'link', title })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/** True if the body contains at least one `[[title]]` reference. */
export function hasWikilink(text: string): boolean {
  return splitWikilinks(text).some((s) => s.type === 'link')
}

/** Build a normalized-title → note-id lookup. Earlier notes win on title clashes. */
export function buildTitleIndex(notes: { id: string; title: string }[]): Map<string, string> {
  const idx = new Map<string, string>()
  for (const n of notes) {
    const key = normalizeTitle(n.title)
    if (key && !idx.has(key)) idx.set(key, n.id)
  }
  return idx
}
