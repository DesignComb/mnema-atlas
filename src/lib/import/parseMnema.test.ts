import { describe, it, expect } from 'vitest'
import { parseMnema } from './parseMnema'

const fence = (json: string) => '```mnema\n' + json + '\n```'

describe('parseMnema', () => {
  it('parses a fenced block with surrounding prose', () => {
    const text =
      'Sure, here you go:\n\n' +
      fence('{ "deck": "JLPT", "cards": [{ "front": "a", "back": "b" }] }') +
      '\n\nHope it helps!'
    const r = parseMnema(text)
    expect(r.ok).toBe(true)
    expect(r.data?.deck).toBe('JLPT')
    expect(r.data?.cards.length).toBe(1)
  })

  it('forgives smart quotes and trailing commas', () => {
    // “/” = curly double quotes
    const text = fence(
      '{ “deck”: “N2”, “notes”: [{ “title”: “t”, “body”: “b”, }], }',
    )
    const r = parseMnema(text)
    expect(r.ok).toBe(true)
    expect(r.data?.notes[0]?.title).toBe('t')
  })

  it('parses bare JSON without a fence', () => {
    const r = parseMnema('{ "cards": [{ "front": "x", "back": "y" }] }')
    expect(r.ok).toBe(true)
  })

  it('links a card to a note by title (resolution happens at import)', () => {
    const r = parseMnema(
      fence('{ "notes": [{ "title": "T" }], "cards": [{ "front": "f", "back": "b", "note": "T" }] }'),
    )
    expect(r.ok).toBe(true)
    expect(r.data?.cards[0]?.note).toBe('T')
  })

  it('rejects an empty payload (no notes or cards)', () => {
    expect(parseMnema(fence('{ "deck": "x" }')).ok).toBe(false)
  })

  it('errors when no block is found', () => {
    expect(parseMnema('just some text, no json').ok).toBe(false)
  })
})
