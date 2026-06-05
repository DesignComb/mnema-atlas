import { describe, it, expect } from 'vitest'
import { relativeDue, safeFilename } from '@/lib/utils'

const now = new Date('2026-06-05T12:00:00Z')

describe('relativeDue', () => {
  it('formats a few hours in the future (en)', () => {
    expect(relativeDue(new Date('2026-06-05T14:00:00Z'), now)).toBe('in 2 hrs')
  })
  it('formats days in the past (en)', () => {
    expect(relativeDue(new Date('2026-06-02T12:00:00Z'), now)).toBe('3 days ago')
  })
  it('keeps a single day singular', () => {
    expect(relativeDue(new Date('2026-06-06T12:00:00Z'), now)).toBe('in 1 day')
  })
  it('follows the zh toggle, not the OS locale', () => {
    expect(relativeDue(new Date('2026-06-05T14:00:00Z'), now, 'zh')).toBe('2 小時後')
  })
})

describe('safeFilename', () => {
  it('replaces filesystem-illegal characters', () => {
    expect(safeFilename('a/b:c*?d')).toBe('a-b-c-d')
  })
  it('collapses whitespace', () => {
    expect(safeFilename('  hello   world  ')).toBe('hello world')
  })
  it('falls back when nothing usable remains', () => {
    expect(safeFilename('   ')).toBe('untitled')
  })
})
