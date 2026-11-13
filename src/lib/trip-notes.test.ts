import { describe, expect, it } from 'vitest'
import { deriveTitle, isNoteConflict, noteSnippet, noteTitle, setChecklistLine, splitChecklist } from './trip-notes'

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

describe('splitChecklist', () => {
  it('separates checklist lines with their source line numbers', () => {
    const segs = splitChecklist('# Pack\n- [ ] passport\n- [x] yen\nafter')
    expect(segs).toEqual([
      { kind: 'markdown', text: '# Pack' },
      { kind: 'check', line: 1, checked: false, text: 'passport' },
      { kind: 'check', line: 2, checked: true, text: 'yen' },
      { kind: 'markdown', text: 'after' },
    ])
  })
  it('ignores checkboxes inside fenced code', () => {
    const segs = splitChecklist('```\n- [ ] code\n```')
    expect(segs).toEqual([{ kind: 'markdown', text: '```\n- [ ] code\n```' }])
  })
})

describe('setChecklistLine', () => {
  it('toggles exactly one line', () => {
    const body = 'x\n  - [ ] a\n- [X] b'
    expect(setChecklistLine(body, 1, true)).toBe('x\n  - [x] a\n- [X] b')
    expect(setChecklistLine(body, 2, false)).toBe('x\n  - [ ] a\n- [ ] b')
  })
  it('leaves the body alone when the line is no longer a checkbox', () => {
    expect(setChecklistLine('plain\nline', 1, true)).toBe('plain\nline')
    expect(setChecklistLine('a', 5, true)).toBe('a')
  })
})

describe('isNoteConflict', () => {
  it('matches the 40001 RPC error', () => {
    expect(isNoteConflict({ code: '40001', message: 'conflict' })).toBe(true)
    expect(isNoteConflict({ code: '42501', message: 'forbidden' })).toBe(false)
    expect(isNoteConflict(null)).toBe(false)
  })
})
