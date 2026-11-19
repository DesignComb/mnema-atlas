import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Markdown } from 'tiptap-markdown'

/**
 * tiptap-markdown only marks bullet/ordered lists "tight", so task lists would
 * serialise with a blank line between every item. Same attribute, for taskList.
 */
const TightTaskLists = Extension.create({
  name: 'tightTaskLists',
  addGlobalAttributes() {
    return [
      {
        types: ['taskList'],
        attributes: {
          tight: {
            default: true,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-tight') === 'true' || !el.querySelector('p'),
            renderHTML: (attrs: Record<string, unknown>) => (attrs.tight ? { 'data-tight': 'true' } : {}),
          },
        },
      },
    ]
  },
})

/**
 * The one TipTap setup for trip notes' WYSIWYG editor (iPhone-Notes style).
 * Storage stays markdown — what MCP/REST read and write — so `- [ ] x` is a
 * real checkbox here and plain GFM to an AI. Shared with the round-trip test.
 */
export function richNoteExtensions(placeholder = '') {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Links open in a new tab and aren't hijacked while editing.
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    Image,
    TaskList,
    TaskItem.configure({ nested: true }),
    TightTaskLists,
    Placeholder.configure({ placeholder }),
    Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-', linkify: true, breaks: false }),
  ]
}

/** Markdown out of a tiptap-markdown editor (typed accessor — the storage is untyped). */
export function getMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
}
