import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { tagChipStyle } from '@/lib/tags'

/** Controlled tag-chip input (no data layer) — reused by notes and cards. */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
  listId = 'mnema-tags',
}: {
  tags: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  listId?: string
}) {
  const t = useT()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const name = raw.trim().replace(/,/g, '').slice(0, 40)
    setDraft('')
    if (!name || tags.includes(name)) return
    onChange([...tags, name])
  }
  const remove = (name: string) => onChange(tags.filter((x) => x !== name))

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
          <button
            type="button"
            onClick={() => remove(name)}
            className="opacity-60 transition hover:opacity-100"
            aria-label={t('Remove tag', '移除標籤')}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        list={listId}
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
      <datalist id={listId}>
        {suggestions.filter((tg) => !tags.includes(tg)).map((tg) => (
          <option key={tg} value={tg} />
        ))}
      </datalist>
    </div>
  )
}
