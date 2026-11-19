// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { getMarkdown, richNoteExtensions } from './rich-note-extensions'

let editor: Editor | null = null
afterEach(() => {
  editor?.destroy()
  editor = null
})

function roundTrip(md: string): string {
  editor = new Editor({ extensions: richNoteExtensions(), content: md })
  return getMarkdown(editor)
}

describe('trip note markdown round-trip', () => {
  it('keeps checklists as GFM task items', () => {
    expect(roundTrip('- [ ] 換日幣\n- [x] 護照')).toBe('- [ ] 換日幣\n- [x] 護照')
  })

  it('keeps headings, lists, emphasis, links and images', () => {
    const md = [
      '## 東京必吃',
      '',
      '- **一蘭** 拉麵',
      '- *Afuri*',
      '',
      '1. 第一站',
      '2. 第二站',
      '',
      '[地圖](https://maps.google.com/x)',
      '',
      '![](https://example.com/a.jpg)',
    ].join('\n')
    expect(roundTrip(md)).toBe(md)
  })

  it('checking a task in the editor serialises as [x]', () => {
    editor = new Editor({ extensions: richNoteExtensions(), content: '- [ ] passport' })
    let pos = -1
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === 'taskItem') pos = p
    })
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { checked: true }))
    expect(getMarkdown(editor)).toBe('- [x] passport')
  })

  it('does not render raw HTML from markdown', () => {
    expect(roundTrip('<script>alert(1)</script>\n\nhi')).not.toContain('<script>')
  })
})
