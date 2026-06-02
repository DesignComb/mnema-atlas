import { useState } from 'react'
import { Plus, UserPlus, X } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { tagChipStyle } from '@/lib/tags'

/**
 * People picker for activity assignees — add (type a name), remove (× a chip),
 * or select from the trip's travellers (tap a suggestion). Controlled, no data
 * layer; chip colours are derived from the name so a person looks consistent.
 */
export function PeopleInput({
  people,
  onChange,
  suggestions = [],
}: {
  people: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
}) {
  const t = useT()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const name = raw.trim().replace(/,/g, '').slice(0, 40)
    setDraft('')
    if (!name || people.includes(name)) return
    onChange([...people, name])
  }
  const remove = (name: string) => onChange(people.filter((x) => x !== name))
  const unused = suggestions.filter((s) => !people.includes(s))

  return (
    <div className="space-y-2">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5">
        <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
        {people.map((name) => (
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
              aria-label={t('Remove', '移除')}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && people.length) {
              remove(people[people.length - 1])
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={people.length ? t('Add…', '加…') : t('Add someone…', '加上同行的人…')}
          className="min-w-[80px] flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {unused.length ? (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => add(name)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[12px] text-muted-foreground transition hover:border-brand/40 hover:bg-brand-muted hover:text-brand"
            >
              <Plus className="size-3" /> {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
