import { describe, expect, it } from 'vitest'
import { buildTitleIndex, hasWikilink, normalizeTitle, splitWikilinks } from './wikilink'

describe('normalizeTitle', () => {
  it('trims, collapses whitespace, lower-cases', () => {
    expect(normalizeTitle('  React 19   Notes ')).toBe('react 19 notes')
  })
  it('leaves CJK titles intact apart from trimming', () => {
    expect(normalizeTitle(' FSRS 間隔重複原理 ')).toBe('fsrs 間隔重複原理')
  })
})

describe('splitWikilinks', () => {
  it('returns a single text segment when there are no links', () => {
    expect(splitWikilinks('plain text')).toEqual([{ type: 'text', value: 'plain text' }])
  })

  it('splits text around a link', () => {
    expect(splitWikilinks('see [[Redis]] please')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', title: 'Redis' },
      { type: 'text', value: ' please' },
    ])
  })

  it('handles adjacent links without merging them', () => {
    expect(splitWikilinks('[[a]][[b]]')).toEqual([
      { type: 'link', title: 'a' },
      { type: 'link', title: 'b' },
    ])
  })

  it('trims the title inside the brackets', () => {
    expect(splitWikilinks('[[  spaced  ]]')).toEqual([{ type: 'link', title: 'spaced' }])
  })

  it('treats empty brackets as literal text', () => {
    expect(splitWikilinks('a [[]] b')).toEqual([{ type: 'text', value: 'a [[]] b' }])
  })

  it('does not span across a single bracket pair', () => {
    // Inner text can't contain brackets, so this stays literal.
    expect(splitWikilinks('[[a')).toEqual([{ type: 'text', value: '[[a' }])
  })
})

describe('hasWikilink', () => {
  it('detects a link', () => {
    expect(hasWikilink('x [[y]] z')).toBe(true)
  })
  it('is false for plain text', () => {
    expect(hasWikilink('no links here')).toBe(false)
  })
})

describe('buildTitleIndex', () => {
  it('maps normalized titles to ids, first note winning a clash', () => {
    const idx = buildTitleIndex([
      { id: '1', title: 'React 19 Notes' },
      { id: '2', title: 'react 19   notes' },
      { id: '3', title: 'Redis' },
    ])
    expect(idx.get('react 19 notes')).toBe('1')
    expect(idx.get('redis')).toBe('3')
    expect(idx.size).toBe(2)
  })
})
