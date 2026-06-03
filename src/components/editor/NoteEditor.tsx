import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Bold, Code, Eye, Heading2, Italic, Link2, List, ListOrdered, Pencil, Quote, Strikethrough } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

type Mode = 'write' | 'preview'

/**
 * A faithful **markdown** note editor: you edit the raw markdown directly (the
 * textarea value IS the stored body — nothing re-serialises it, so hand-written
 * markdown round-trips byte-for-byte), with a syntax toolbar and a rendered
 * Preview tab. Controlled: `value` is the single source of truth.
 */
export function NoteEditor({
  value,
  onChange,
  placeholder = 'Start writing — markdown supported. Your notes become flashcards and graph nodes…',
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
}) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('write')
  const ref = useRef<HTMLTextAreaElement>(null)

  /** Wrap the current selection with `before`/`after` (bold, italic, code, …). */
  function wrap(before: string, after = before) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = value.slice(start, end)
    onChange(value.slice(0, start) + before + sel + after + value.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }

  /** Prefix the line(s) the cursor is on (heading, list, quote, …). */
  function linePrefix(prefix: string) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const tools = [
    { icon: Bold, label: t('Bold', '粗體'), run: () => wrap('**') },
    { icon: Italic, label: t('Italic', '斜體'), run: () => wrap('*') },
    { icon: Strikethrough, label: t('Strikethrough', '刪除線'), run: () => wrap('~~') },
    { icon: Heading2, label: t('Heading', '標題'), run: () => linePrefix('## ') },
    { icon: List, label: t('Bullet list', '項目符號'), run: () => linePrefix('- ') },
    { icon: ListOrdered, label: t('Numbered list', '編號清單'), run: () => linePrefix('1. ') },
    { icon: Quote, label: t('Quote', '引言'), run: () => linePrefix('> ') },
    { icon: Code, label: t('Inline code', '行內程式碼'), run: () => wrap('`') },
    { icon: Link2, label: t('Link', '連結'), run: () => wrap('[', '](url)') },
  ]

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card/80 px-1.5 py-1 backdrop-blur sm:-mx-1">
        {mode === 'write'
          ? tools.map((it) => (
              <button
                key={it.label}
                type="button"
                title={it.label}
                aria-label={it.label}
                onClick={it.run}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground sm:size-7"
              >
                <it.icon className="size-4" />
              </button>
            ))
          : <span className="px-1.5 text-[12px] text-muted-foreground">{t('Rendered preview', '預覽結果')}</span>}

        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
          {(['write', 'preview'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium transition',
                mode === m ? 'bg-brand text-brand-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'write' ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
              {m === 'write' ? t('Write', '編輯') : t('Preview', '預覽')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="min-h-[40vh] w-full resize-y rounded-lg border border-border bg-card/40 px-3.5 py-3 font-mono text-[13.5px] leading-relaxed text-foreground outline-none transition focus:border-brand placeholder:text-muted-foreground/40 sm:min-h-[50vh]"
        />
      ) : value.trim() ? (
        <MarkdownPreview markdown={value} />
      ) : (
        <p className="px-1 py-10 text-center text-sm text-muted-foreground/60">{t('Nothing to preview yet.', '還沒有可預覽的內容。')}</p>
      )}
    </div>
  )
}

/** Read-only TipTap render of markdown — used only for the Preview tab. */
function MarkdownPreview({ markdown }: { markdown: string }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Markdown.configure({ html: false })],
    content: markdown,
    editorProps: { attributes: { class: 'mnema-prose max-w-none px-1' } },
  })
  if (!editor) return null
  return <EditorContent editor={editor} />
}
