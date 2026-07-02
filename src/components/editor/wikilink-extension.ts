import { Node, mergeAttributes } from '@tiptap/core'
import type MarkdownIt from 'markdown-it'

/**
 * TipTap inline node for `[[title]]` wikilinks in the note markdown preview.
 *
 * Why a schema node (not the Link mark): the node renders its OWN `<a>`/`<span>`,
 * so it sidesteps every URL-sanitisation layer (markdown-it's `validateLink`,
 * TipTap Link's `isAllowedUri`) that would strip a custom `mnema-note:` href.
 * Resolved links render as a brand chip `<a>`; unresolved ones as muted, inert
 * text. Clicks are handled by the editor's `handleClickOn` (see NoteEditor) so
 * navigation stays client-side.
 *
 * Parsing: a markdown-it inline rule (registered via tiptap-markdown's
 * `parse.setup`) emits `<a data-wikilink="title">` which `parseHTML` picks up.
 * Serialising back to markdown re-emits `[[title]]` so bodies round-trip.
 */

export interface WikilinkOptions {
  /** Title → note id, or null when no note matches (renders as unresolved). */
  resolve: (title: string) => string | null
}

function wikilinkInlineRule(md: MarkdownIt) {
  // tiptap-markdown re-runs `parse.setup` on every parse against the same md
  // instance — register the rule only once so the ruler chain can't grow.
  const flag = md as MarkdownIt & { __mnemaWikilink__?: boolean }
  if (flag.__mnemaWikilink__) return
  flag.__mnemaWikilink__ = true

  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src
    const start = state.pos
    // Fast bail: need "[[" here.
    if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) return false
    const end = src.indexOf(']]', start + 2)
    if (end < 0) return false
    const title = src.slice(start + 2, end).trim()
    // No brackets inside, and non-empty — otherwise it isn't a wikilink.
    if (!title || title.includes('[') || title.includes(']')) return false
    if (!silent) {
      const token = state.push('wikilink', '', 0)
      token.content = title
      token.markup = '[[]]'
    }
    state.pos = end + 2
    return true
  })
  md.renderer.rules.wikilink = (tokens, idx) => {
    const title = md.utils.escapeHtml(tokens[idx].content)
    return `<a data-wikilink="${title}">${title}</a>`
  }
}

export const Wikilink = Node.create<WikilinkOptions>({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addOptions() {
    return { resolve: () => null }
  },

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-wikilink') ?? el.textContent ?? '',
        renderHTML: () => ({}), // title lives in data-wikilink / node text, set below
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },

  renderHTML({ node }) {
    const title = String(node.attrs.title ?? '')
    const id = this.options.resolve(title)
    if (id) {
      // A real href lets ⌘/Ctrl/middle-click open in a new tab; a plain click is
      // intercepted for client-side nav by the editor's handleClickOn.
      const base = import.meta.env.BASE_URL || '/'
      const href = `${base}notes/${id}`.replace(/([^:])\/{2,}/g, '$1/')
      return [
        'a',
        mergeAttributes({ class: 'wikilink', href, 'data-wikilink': title, 'data-note-id': id }),
        title,
      ]
    }
    return ['span', mergeAttributes({ class: 'wikilink-unresolved', 'data-wikilink': title }), title]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { title?: string } }) {
          state.write(`[[${node.attrs.title ?? ''}]]`)
        },
        parse: {
          setup(markdownit: MarkdownIt) {
            wikilinkInlineRule(markdownit)
          },
        },
      },
    }
  },
})
