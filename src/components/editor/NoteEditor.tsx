import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import { Bold, Code, Eye, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Pencil, Quote, Strikethrough } from 'lucide-react'
import { toast } from 'sonner'
import { cn, humanizeError } from '@/lib/utils'
import { uploadImage } from '@/lib/upload'
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
  defaultMode = 'write',
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  /** Initial tab — pass 'preview' for notes with content (reading first). */
  defaultMode?: Mode
}) {
  const t = useT()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  // Latest value for async (post-upload) edits — the closure value would be stale.
  const valueRef = useRef(value)
  valueRef.current = value

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

  /** Insert `snippet` at the cursor (replacing any selection), cursor lands after it. */
  function insertAtCursor(snippet: string) {
    const ta = ref.current
    const v = valueRef.current
    const start = ta?.selectionStart ?? v.length
    const end = ta?.selectionEnd ?? v.length
    onChange(v.slice(0, start) + snippet + v.slice(end))
    if (ta)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start + snippet.length, start + snippet.length)
      })
  }

  /** Swap a placeholder for its final text without disturbing the user's cursor. */
  function replaceSnippet(find: string, replacement: string) {
    const v = valueRef.current
    const idx = v.indexOf(find)
    if (idx === -1) {
      // The user edited the placeholder away mid-upload — append rather than lose the image.
      if (replacement) onChange(v + (v && !v.endsWith('\n') ? '\n' : '') + replacement)
      return
    }
    onChange(v.slice(0, idx) + replacement + v.slice(idx + find.length))
    const ta = ref.current
    if (ta && document.activeElement === ta) {
      const pos = ta.selectionStart
      const next = pos <= idx ? pos : Math.max(idx, pos + replacement.length - find.length)
      requestAnimationFrame(() => ta.setSelectionRange(next, next))
    }
  }

  /**
   * Upload image file(s) and insert `![](url)` markdown. GitHub-style: a unique
   * placeholder holds the spot immediately, so typing during the upload can't
   * shift the insert position. Goes through `onChange` like typing, so the
   * parent's autosave picks every step up.
   */
  async function uploadAndInsert(files: File[]) {
    for (const file of files.filter((f) => f.type.startsWith('image/'))) {
      const token = `![uploading-${crypto.randomUUID().slice(0, 8)}…]()`
      insertAtCursor(token)
      setUploading((n) => n + 1)
      try {
        // Let React commit the placeholder before an instantly-rejecting upload
        // (bad type/size) tries to remove it — otherwise valueRef is stale.
        await new Promise((r) => setTimeout(r, 0))
        const url = await uploadImage(file)
        replaceSnippet(token, `![](${url})`)
      } catch (e) {
        replaceSnippet(token, '')
        toast.error(humanizeError(e, ['Upload failed', '上傳失敗']))
      } finally {
        setUploading((n) => n - 1)
      }
    }
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
    { icon: ImagePlus, label: t('Add image', '加入圖片'), run: () => fileRef.current?.click() },
  ]

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadAndInsert(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
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

        {uploading > 0 ? (
          <span className="flex items-center gap-1.5 px-1.5 text-[12px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {t('Uploading image…', '圖片上傳中…')}
          </span>
        ) : null}

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
          onPaste={(e) => {
            // Rich-content pastes (Excel/Word/web pages) ship BOTH text and a
            // bitmap of the selection — keep the text. Only true image pastes
            // (screenshots, copied image files) carry no text/plain.
            if (e.clipboardData.getData('text/plain').trim()) return
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
            if (!files.length) return
            e.preventDefault()
            void uploadAndInsert(files)
          }}
          onDragOver={(e) => {
            // Only claim file drags — in-textarea text drags keep their native behaviour.
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            setDragOver(false)
            if (!e.dataTransfer.files.length) return
            e.preventDefault()
            void uploadAndInsert(Array.from(e.dataTransfer.files))
          }}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            'min-h-[40vh] w-full resize-y rounded-lg border border-border bg-card/40 px-3.5 py-3 font-mono text-[13.5px] leading-relaxed text-foreground outline-none transition focus:border-brand placeholder:text-muted-foreground/40 sm:min-h-[50vh]',
            dragOver && 'border-brand bg-brand-muted/40',
          )}
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
    // Image: StarterKit has no image node, so without it `![](url)` markdown
    // (incl. our own uploads) silently vanishes from the preview.
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Image, Markdown.configure({ html: false })],
    content: markdown,
    editorProps: { attributes: { class: 'mnema-prose max-w-none px-1' } },
  })
  if (!editor) return null
  return <EditorContent editor={editor} />
}
