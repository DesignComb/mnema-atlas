import { describe, it, expect } from 'vitest'
import {
  ancestors,
  buildDeckTree,
  descendantIds,
  flattenTree,
  indentLabel,
  type DeckLike,
} from '@/lib/deck-tree'

const deck = (id: string, parent: string | null = null, sort = 0, name = id): DeckLike => ({
  id,
  name,
  parent_deck_id: parent,
  sort_order: sort,
})

const ids = (nodes: ReturnType<typeof buildDeckTree>): string[] => nodes.map((n) => n.deck.id)

describe('buildDeckTree', () => {
  it('returns a flat list of roots when nothing is nested', () => {
    const tree = buildDeckTree([deck('b', null, 1), deck('a', null, 0)])
    expect(ids(tree)).toEqual(['a', 'b'])
    expect(tree.every((n) => n.children.length === 0)).toBe(true)
  })

  it('nests children under parents, sorted by sort_order then name', () => {
    const tree = buildDeckTree([
      deck('root', null, 0),
      deck('c2', 'root', 1, 'zeta'),
      deck('c1', 'root', 0, 'alpha'),
      deck('c3', 'root', 1, 'beta'), // same sort_order as c2 — name tiebreak
      deck('g1', 'c1', 0),
    ])
    expect(ids(tree)).toEqual(['root'])
    expect(ids(tree[0].children)).toEqual(['c1', 'c3', 'c2'])
    expect(ids(tree[0].children[0].children)).toEqual(['g1'])
  })

  it('treats a deck whose parent is missing as a root (orphan tolerance)', () => {
    const tree = buildDeckTree([deck('a', null, 0), deck('lost', 'gone-id', 1)])
    expect(ids(tree)).toEqual(['a', 'lost'])
  })

  it('supports arbitrary depth', () => {
    const chain = [deck('d0'), deck('d1', 'd0'), deck('d2', 'd1'), deck('d3', 'd2'), deck('d4', 'd3')]
    let node = buildDeckTree(chain)[0]
    for (let i = 1; i <= 4; i++) {
      expect(node.children).toHaveLength(1)
      node = node.children[0]
      expect(node.deck.id).toBe(`d${i}`)
    }
    expect(node.children).toHaveLength(0)
  })

  it('does not loop or drop decks when the data contains a cycle', () => {
    // a → b → a (impossible via the cycle-guarded RPC, but be defensive)
    const tree = buildDeckTree([deck('a', 'b', 0), deck('b', 'a', 1), deck('top', null, 0)])
    const flat = flattenTree(tree)
    expect(flat.map((f) => f.deck.id).sort()).toEqual(['a', 'b', 'top'])
  })

  it('tolerates a self-parented deck', () => {
    const tree = buildDeckTree([deck('selfie', 'selfie', 0)])
    expect(ids(tree)).toEqual(['selfie'])
    expect(tree[0].children).toHaveLength(0)
  })
})

describe('flattenTree', () => {
  it('flattens depth-first with depths', () => {
    const flat = flattenTree(
      buildDeckTree([deck('a', null, 0), deck('a1', 'a', 0), deck('a1x', 'a1', 0), deck('b', null, 1)]),
    )
    expect(flat.map((f) => [f.deck.id, f.depth])).toEqual([
      ['a', 0],
      ['a1', 1],
      ['a1x', 2],
      ['b', 0],
    ])
  })

  it('returns [] for an empty tree', () => {
    expect(flattenTree(buildDeckTree([]))).toEqual([])
  })
})

describe('descendantIds', () => {
  const decks = [
    deck('a'),
    deck('a1', 'a'),
    deck('a2', 'a'),
    deck('a1x', 'a1'),
    deck('b'),
  ]

  it('collects all transitive descendants, excluding the deck itself', () => {
    expect(descendantIds(decks, 'a')).toEqual(new Set(['a1', 'a2', 'a1x']))
    expect(descendantIds(decks, 'a1')).toEqual(new Set(['a1x']))
  })

  it('is empty for a leaf or unknown id', () => {
    expect(descendantIds(decks, 'b').size).toBe(0)
    expect(descendantIds(decks, 'nope').size).toBe(0)
  })

  it('does not infinite-loop on a cycle', () => {
    const cyclic = [deck('a', 'b'), deck('b', 'a'), deck('c', 'b')]
    expect(descendantIds(cyclic, 'a')).toEqual(new Set(['b', 'c']))
  })
})

describe('ancestors', () => {
  const decks = [deck('a'), deck('a1', 'a'), deck('a1x', 'a1')]

  it('returns the chain root-first', () => {
    expect(ancestors(decks, 'a1x').map((d) => d.id)).toEqual(['a', 'a1'])
  })

  it('is empty for top-level or unknown decks', () => {
    expect(ancestors(decks, 'a')).toEqual([])
    expect(ancestors(decks, 'nope')).toEqual([])
  })

  it('stops at a missing link instead of throwing', () => {
    const broken = [deck('child', 'gone'), deck('other')]
    expect(ancestors(broken, 'child')).toEqual([])
  })

  it('does not infinite-loop on a cycle', () => {
    const cyclic = [deck('a', 'b'), deck('b', 'a')]
    expect(ancestors(cyclic, 'a').map((d) => d.id)).toEqual(['b'])
  })
})

describe('indentLabel', () => {
  it('leaves depth 0 untouched and indents with non-breaking spaces', () => {
    expect(indentLabel('Root', 0)).toBe('Root')
    expect(indentLabel('Child', 1)).toBe('   Child')
    expect(indentLabel('Grand', 2)).toBe(' '.repeat(6) + 'Grand')
  })
})
