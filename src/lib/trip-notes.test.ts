import { describe, expect, it } from 'vitest'
import { deriveTitle, isNoteConflict, noteSnippet, noteTitle } from './trip-notes'

describe('deriveTitle', () => {
  it('uses the first non-empty line without markdown markers', () => {
    expect(deriveTitle('\n\n## 東京 **必吃**\nramen')).toBe('東京 必吃')
    expect(deriveTitle('- [ ] 換日幣\n- [x] 護照')).toBe('換日幣')
    expect(deriveTitle('[Map](https://x.y) of Kyoto')).toBe('Map of Kyoto')
  })
  it('is empty for a blank body', () => {
    expect(deriveTitle('   \n ')).toBe('')
  })
})

describe('noteSnippet / noteTitle', () => {
  it('skips the title line', () => {
    expect(noteSnippet('Title\n\nline one\n- two')).toBe('line one two')
  })
  it('prefers an explicit title', () => {
    expect(noteTitle({ title: 'Visa', body: 'hello' })).toBe('Visa')
    expect(noteTitle({ title: ' ', body: 'hello' })).toBe('hello')
  })
})

describe('isNoteConflict', () => {
  it('matches the 40001 RPC error', () => {
    expect(isNoteConflict({ code: '40001', message: 'conflict' })).toBe(true)
    expect(isNoteConflict({ code: '42501', message: 'forbidden' })).toBe(false)
    expect(isNoteConflict(null)).toBe(false)
  })
})
