/**
 * Pure helpers for deck nesting (Notion-like folders).
 *
 * Decks carry `parent_deck_id`; these helpers turn the flat list from the
 * server into a render-ready tree. All functions are defensive about bad data:
 * orphans (parent id points at a missing deck) are promoted to roots, and a
 * cycle in the data (should be impossible — set_deck_parent is cycle-guarded
 * server-side) is tolerated rather than looping forever.
 */

export interface DeckLike {
  id: string
  name: string
  parent_deck_id: string | null
  sort_order: number
}

export interface DeckNode<T extends DeckLike = DeckLike> {
  deck: T
  children: DeckNode<T>[]
}

/** Sibling order everywhere: sort_order first (reorder_decks writes it), name as tiebreak. */
export function compareDecks(a: DeckLike, b: DeckLike): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name)
}

/**
 * Build the deck tree. Children are sorted by sort_order (name tiebreak).
 * - A deck whose parent id doesn't exist in `decks` is treated as a root.
 * - If the data ever contains a cycle, its members are still emitted (the
 *   first one reached becomes a root and the back-edge is dropped).
 */
export function buildDeckTree<T extends DeckLike>(decks: T[]): DeckNode<T>[] {
  const byId = new Map(decks.map((d) => [d.id, d]))
  const childrenOf = new Map<string | null, T[]>()
  for (const d of decks) {
    // Orphans (missing parent) become roots so no deck can silently vanish.
    const parent = d.parent_deck_id !== null && byId.has(d.parent_deck_id) ? d.parent_deck_id : null
    const list = childrenOf.get(parent)
    if (list) list.push(d)
    else childrenOf.set(parent, [d])
  }

  const visited = new Set<string>()
  const build = (d: T): DeckNode<T> => {
    visited.add(d.id)
    const kids = (childrenOf.get(d.id) ?? []).filter((c) => !visited.has(c.id)) // breaks cycles
    return { deck: d, children: kids.sort(compareDecks).map(build) }
  }

  const roots = (childrenOf.get(null) ?? []).sort(compareDecks).map(build)
  // Defensive: members of a cycle are unreachable from any root — promote them.
  for (const d of [...decks].sort(compareDecks)) {
    if (!visited.has(d.id)) roots.push(build(d))
  }
  return roots
}

/** Depth-first flatten — the order you'd render an indented list/select in. */
export function flattenTree<T extends DeckLike>(
  nodes: DeckNode<T>[],
  depth = 0,
): { deck: T; depth: number }[] {
  const out: { deck: T; depth: number }[] = []
  for (const n of nodes) {
    out.push({ deck: n.deck, depth })
    out.push(...flattenTree(n.children, depth + 1))
  }
  return out
}

/** Every descendant of `id` (children, grandchildren, …) — NOT including `id` itself. */
export function descendantIds(decks: DeckLike[], id: string): Set<string> {
  const childIds = new Map<string, string[]>()
  for (const d of decks) {
    if (d.parent_deck_id === null) continue
    const list = childIds.get(d.parent_deck_id)
    if (list) list.push(d.id)
    else childIds.set(d.parent_deck_id, [d.id])
  }
  const out = new Set<string>()
  const queue = [...(childIds.get(id) ?? [])]
  while (queue.length) {
    const cur = queue.pop()!
    if (cur === id || out.has(cur)) continue // cycle tolerance
    out.add(cur)
    const kids = childIds.get(cur)
    if (kids) queue.push(...kids)
  }
  return out
}

/** Ancestor chain of `id`, root-first (for breadcrumbs). Empty for top-level decks. */
export function ancestors<T extends DeckLike>(decks: T[], id: string): T[] {
  const byId = new Map(decks.map((d) => [d.id, d]))
  const chain: T[] = []
  const seen = new Set<string>([id])
  let cur = byId.get(id)?.parent_deck_id ?? null
  while (cur !== null && !seen.has(cur)) {
    const d = byId.get(cur)
    if (!d) break // orphaned chain — stop at the gap
    seen.add(cur)
    chain.unshift(d)
    cur = d.parent_deck_id
  }
  return chain
}

/** Indent an option label for native <select>s (plain spaces collapse there). */
export function indentLabel(name: string, depth: number): string {
  return depth > 0 ? `${'   '.repeat(depth)}${name}` : name
}
