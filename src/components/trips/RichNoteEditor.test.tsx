// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The toolbar's whiteboard pulls in a canvas-heavy bundle; irrelevant here.
vi.mock('@/components/whiteboard/WhiteboardDialog', () => ({ WhiteboardDialog: () => null }))
vi.mock('@/lib/upload', () => ({ uploadImage: vi.fn() }))

import { I18nProvider } from '@/lib/i18n'
import { RichNoteEditor } from './RichNoteEditor'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function render(value: string, onChange?: (md: string) => void, editable = true) {
  act(() =>
    root.render(
      <I18nProvider>
        <RichNoteEditor value={value} onChange={onChange} editable={editable} />
      </I18nProvider>,
    ),
  )
}
const pm = () => host.querySelector('.ProseMirror') as HTMLElement & { editor?: unknown }

describe('RichNoteEditor', () => {
  it('renders markdown checklists as checkboxes', () => {
    render('- [ ] passport\n- [x] yen')
    const boxes = host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
    expect(boxes).toHaveLength(2)
    expect(boxes[1].checked).toBe(true)
  })

  it('swapping in an outside value updates the doc without emitting onChange', () => {
    const onChange = vi.fn()
    render('first', onChange)
    render('## second', onChange)
    expect(pm().querySelector('h2')?.textContent).toBe('second')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits markdown when the user ticks a checkbox', () => {
    const onChange = vi.fn()
    render('- [ ] passport', onChange)
    const box = host.querySelector<HTMLInputElement>('input[type=checkbox]')!
    act(() => {
      box.checked = true
      box.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith('- [x] passport')
  })

  it('read-only mode hides the toolbar and is not editable', () => {
    render('hello', undefined, false)
    expect(pm().getAttribute('contenteditable')).toBe('false')
    expect(host.querySelector('[aria-label="Bold"], [aria-label="粗體"]')).toBeNull()
  })
})
