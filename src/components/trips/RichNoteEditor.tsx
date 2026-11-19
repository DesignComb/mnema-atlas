import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { Bold, Brush, Heading2, ImagePlus, Italic, List, ListChecks, ListOrdered, Loader2, Strikethrough } from 'lucide-react'
import { toast } from 'sonner'
import { cn, humanizeError } from '@/lib/utils'
import { uploadImage } from '@/lib/upload'
import { useT } from '@/lib/i18n'
import { WhiteboardDialog } from '@/components/whiteboard/WhiteboardDialog'
import { getMarkdown, richNoteExtensions } from './rich-note-extensions'

/**
 * iPhone-Notes-style editor for trip notes: you edit the rendered note
 * directly (headings, lists, tappable checklists, images) — no write/preview
 * split. Controlled by a **markdown** `value`, the same text MCP/REST read and
 * write, so a collaborator's or AI's save can be swapped in at any time.
 */
export function RichNoteEditor({
  value,
  onChange,
  editable = true,
  placeholder,
}: {
  value: string
  onChange?: (markdown: string) => void
  editable?: boolean
  placeholder?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [boardOpen, setBoardOpen] = useState(false)
  // The markdown we last emitted (or loaded). A `value` that differs came from
  // outside — a collaborator, "load latest" — and replaces the document.
  const lastMd = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // editorProps handlers are bound once at creation — reach the live editor via a ref.
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    extensions: richNoteExtensions(placeholder ?? ''),
    content: value,
    editable,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: cn(
          'mnema-prose mnema-rich max-w-none px-1 py-2 outline-none',
          editable && 'min-h-[55dvh] lg:min-h-[50vh]',
        ),
      },
      handlePaste(_view, event) {
        // Rich pastes (web/Word) carry text too — keep that; only bare images upload.
        if (event.clipboardData?.getData('text/plain').trim()) return false
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/') || !f.type)
        if (!files.length) return false
        event.preventDefault()
        void uploadAndInsert(files)
        return true
      },
      handleDrop(_view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? [])
        if (!files.length) return false
        event.preventDefault()
        void uploadAndInsert(files)
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = getMarkdown(e)
      if (md === lastMd.current) return
      lastMd.current = md
      onChangeRef.current?.(md)
    },
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor || value === lastMd.current) return
    lastMd.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  /** Upload images one by one and drop each in at the cursor once it's ready. */
  async function uploadAndInsert(files: File[]) {
    for (const file of files) {
      setUploading((n) => n + 1)
      try {
        const url = await uploadImage(file)
        const ed = editorRef.current
        if (!ed || ed.isDestroyed) return
        ed.chain().focus().setImage({ src: url }).run()
      } catch (e) {
        toast.error(humanizeError(e, ['Upload failed', '上傳失敗']))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  if (!editor) return null

  return (
    <div className="space-y-2">
      {editable ? (
        <>
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
          <Toolbar
            editor={editor}
            uploading={uploading}
            onImage={() => fileRef.current?.click()}
            onSketch={() => setBoardOpen(true)}
          />
          <WhiteboardDialog
            open={boardOpen}
            onOpenChange={setBoardOpen}
            onSave={async (blob) => {
              const ext = blob.type === 'image/png' ? 'png' : 'webp'
              await uploadAndInsert([
                new File([blob], `sketch-${crypto.randomUUID().slice(0, 8)}.${ext}`, { type: blob.type || 'image/webp' }),
              ])
              setBoardOpen(false)
            }}
          />
        </>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({
  editor,
  uploading,
  onImage,
  onSketch,
}: {
  editor: Editor
  uploading: number
  onImage: () => void
  onSketch: () => void
}) {
  const t = useT()
  // Re-render on selection/format changes so active states stay in sync.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
    }),
  })
  const chain = () => editor.chain().focus()
  const tools = [
    { icon: ListChecks, label: t('Checklist', '核取清單'), on: active.task, run: () => chain().toggleTaskList().run() },
    { icon: Heading2, label: t('Heading', '標題'), on: active.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { icon: Bold, label: t('Bold', '粗體'), on: active.bold, run: () => chain().toggleBold().run() },
    { icon: Italic, label: t('Italic', '斜體'), on: active.italic, run: () => chain().toggleItalic().run() },
    { icon: Strikethrough, label: t('Strikethrough', '刪除線'), on: active.strike, run: () => chain().toggleStrike().run() },
    { icon: List, label: t('Bullet list', '項目符號'), on: active.bullet, run: () => chain().toggleBulletList().run() },
    { icon: ListOrdered, label: t('Numbered list', '編號清單'), on: active.ordered, run: () => chain().toggleOrderedList().run() },
    { icon: ImagePlus, label: t('Add image', '加入圖片'), on: false, run: onImage },
    { icon: Brush, label: t('Sketch', '隨手畫'), on: false, run: onSketch },
  ]
  return (
    <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card/90 px-1 py-1 backdrop-blur">
      {tools.map((it) => (
        <button
          key={it.label}
          type="button"
          title={it.label}
          aria-label={it.label}
          aria-pressed={it.on}
          // Keep the editor's selection: a toolbar tap must not blur it first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={it.run}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40 sm:size-8',
            it.on ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <it.icon className="size-[18px] sm:size-4" />
        </button>
      ))}
      {uploading > 0 ? (
        <span className="flex shrink-0 items-center gap-1.5 px-1.5 text-[12px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> {t('Uploading…', '上傳中…')}
        </span>
      ) : null}
    </div>
  )
}
