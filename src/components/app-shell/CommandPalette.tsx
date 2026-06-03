import { useEffect, useState, type ReactNode } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FilePlus2, FolderPlus, GraduationCap, Home, Loader2, Plug, Search, Share2, Sparkles } from 'lucide-react'
import { useDecks, useNotes } from '@/lib/hooks'
import { searchNotes } from '@/lib/api'
import { useT } from '@/lib/i18n'

export function CommandPalette({
  open,
  onOpenChange,
  onNewNote,
  onNewDeck,
  onImport,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onNewNote: () => void
  onNewDeck: () => void
  onImport: () => void
}) {
  const navigate = useNavigate()
  const { data: decks } = useDecks()
  const { data: notes } = useNotes()
  const t = useT()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  // Clear the box each time the palette closes.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Debounce → full-text note search (matches BODY too, unlike the old
  // client-side title filter). cmdk's own filter is disabled below so a
  // body-only match isn't hidden because its title doesn't contain the query.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 180)
    return () => clearTimeout(id)
  }, [query])

  const searching = debounced.length >= 2
  const { data: hits, isFetching } = useQuery({
    queryKey: ['note-search', debounced],
    queryFn: () => searchNotes(debounced, 20),
    enabled: open && searching,
    staleTime: 30_000,
  })

  const q = query.trim().toLowerCase()
  const match = (...text: string[]) => !q || text.some((s) => s.toLowerCase().includes(q))

  const noteList = searching ? (hits ?? []) : (notes ?? []).slice(0, 8)
  const deckList = (decks ?? []).filter((d) => match(d.name))

  function run(fn: () => void) {
    onOpenChange(false)
    fn()
  }

  const actions = [
    { key: 'new-note', en: 'New note', zh: '新增筆記', icon: <FilePlus2 className="size-4" />, fn: onNewNote },
    { key: 'new-deck', en: 'New deck', zh: '新增牌組', icon: <FolderPlus className="size-4" />, fn: onNewDeck },
    { key: 'import', en: 'Import from AI', zh: '從 AI 匯入', icon: <Sparkles className="size-4" />, fn: onImport },
    { key: 'study', en: 'Start studying', zh: '開始學習', icon: <GraduationCap className="size-4" />, fn: () => navigate({ to: '/study' }) },
  ].filter((a) => match(a.en, a.zh))

  const goto = [
    { key: 'today', en: 'Today', zh: '今天', icon: <Home className="size-4" />, to: '/today' as const },
    { key: 'graph', en: 'Graph', zh: '圖譜', icon: <Share2 className="size-4" />, to: '/graph' as const },
    { key: 'connect', en: 'Connect an AI', zh: '連接 AI', icon: <Plug className="size-4" />, to: '/settings/integrations' as const },
  ].filter((g) => match(g.en, g.zh))

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      shouldFilter={false}
      className="fixed left-1/2 top-[12%] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:top-[18%]"
      overlayClassName="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t('Search notes, decks, or run a command…', '搜尋筆記、牌組或執行指令…')}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {searching && isFetching ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2 sm:max-h-80">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          {searching && isFetching ? t('Searching…', '搜尋中…') : t('No results.', '沒有結果。')}
        </Command.Empty>

        {actions.length ? (
          <Command.Group heading={t('Actions', '動作')} className="cmdk-group">
            {actions.map((a) => (
              <Item key={a.key} value={`action-${a.key}`} onSelect={() => run(a.fn)} icon={a.icon}>
                {t(a.en, a.zh)}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {goto.length ? (
          <Command.Group heading={t('Go to', '前往')} className="cmdk-group">
            {goto.map((g) => (
              <Item key={g.key} value={`goto-${g.key}`} onSelect={() => run(() => navigate({ to: g.to }))} icon={g.icon}>
                {t(g.en, g.zh)}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {deckList.length ? (
          <Command.Group heading={t('Decks', '牌組')} className="cmdk-group">
            {deckList.map((d) => (
              <Item
                key={d.id}
                value={`deck-${d.id}`}
                onSelect={() => run(() => navigate({ to: '/decks/$deckId', params: { deckId: d.id } }))}
              >
                {d.name}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {noteList.length ? (
          <Command.Group heading={searching ? t('Matching notes', '符合的筆記') : t('Notes', '筆記')} className="cmdk-group">
            {noteList.map((n) => (
              <Item
                key={n.id}
                value={`note-${n.id}`}
                onSelect={() => run(() => navigate({ to: '/notes/$noteId', params: { noteId: n.id } }))}
              >
                {n.title || t('Untitled', '未命名')}
              </Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  )
}

function Item({
  children,
  icon,
  value,
  onSelect,
}: {
  children: ReactNode
  icon?: ReactNode
  value: string
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </Command.Item>
  )
}
