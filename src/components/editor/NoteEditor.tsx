import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Code,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** tiptap-markdown augments editor.storage at runtime; type the accessor. */
function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

/**
 * WYSIWYG note editor that reads & writes **markdown** (via tiptap-markdown),
 * so notes round-trip cleanly with the MCP/REST write path.
 *
 * Mount one editor per note (`key={noteId}` at the call site) so content
 * initialises once from the loaded body — no fragile value-sync effect.
 */
export function NoteEditor({
  initialMarkdown,
  onChange,
  placeholder = 'Start writing — your notes become flashcards and graph nodes…',
}: {
  initialMarkdown: string
  onChange: (markdown: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'mnema-prose min-h-[40vh] max-w-none px-1 focus:outline-none sm:min-h-[50vh]',
      },
    },
    onUpdate: ({ editor }) => onChange(getMarkdown(editor)),
  })

  if (!editor) return null

  return (
    <div className="space-y-3">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const items = [
    { icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
    { icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
    { icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), label: 'Strike' },
    { icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), label: 'Heading' },
    { icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet list' },
    { icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Numbered list' },
    { icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Quote' },
    { icon: Code, run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Code block' },
  ]
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card/80 px-1.5 py-1 backdrop-blur sm:-mx-1">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          title={it.label}
          onClick={it.run}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground sm:size-7',
            it.active && 'bg-brand-muted text-brand',
          )}
        >
          <it.icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
