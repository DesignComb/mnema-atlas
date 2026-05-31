import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { useNotes, useSetNoteTags } from '@/lib/hooks'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { tagChipStyle } from '@/lib/tags'

/** Inline tag chips + add-input for a note. Tags colour & cluster the graph. */
export function TagEditor({ noteId, tags }: { noteId: string; tags: string[] }) {
  const t = useT()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const setTags = useSetNoteTags()
  const { data: notes } = useNotes()
  const [draft, setDraft] = useState('')

  // Suggestions = every tag already used anywhere (so spelling stays consistent).
  const all = Array.from(new Set((notes ?? []).flatMap((n) => n.tags ?? []))).sort()

  const commit = (next: string[]) => setTags.mutate({ noteId, tags: next })
  function add(raw: string) {
    const name = raw.trim().replace(/,/g, '').slice(0, 40)
    setDraft('')
    if (!name || tags.includes(name)) return
    commit([...tags, name])
  }
  const remove = (name: string) => commit(tags.filter((x) => x !== name))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="size-3.5 shrink-0 text-muted-foreground" />
      {tags.map((name) => (
        <span
          key={name}
          style={tagChipStyle(name, isDark)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium"
        >
          {name}
          <button onClick={() => remove(name)} className="opacity-60 transition hover:opacity-100" aria-label={t('Remove tag', '移除標籤')}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        list="mnema-tags"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            remove(tags[tags.length - 1])
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={tags.length ? t('Add tag…', '加標籤…') : t('Add tags…', '加上標籤…')}
        className="min-w-[90px] flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
      />
      <datalist id="mnema-tags">
        {all.filter((tg) => !tags.includes(tg)).map((tg) => (
          <option key={tg} value={tg} />
        ))}
      </datalist>
    </div>
  )
}
