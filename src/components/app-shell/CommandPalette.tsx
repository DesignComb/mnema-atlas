import type { ReactNode } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from '@tanstack/react-router'
import { FilePlus2, FolderPlus, GraduationCap, Home, Plug, Search, Share2, Sparkles } from 'lucide-react'
import { useDecks, useNotes } from '@/lib/hooks'
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

  function run(fn: () => void) {
    onOpenChange(false)
    fn()
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-[18%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      overlayClassName="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3.5">
        <Search className="size-4 text-muted-foreground" />
        <Command.Input
          placeholder={t('Search notes, decks, or run a command…', '搜尋筆記、牌組或執行指令…')}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          {t('No results.', '沒有結果。')}
        </Command.Empty>

        <Command.Group heading={t('Actions', '動作')} className="cmdk-group">
          <Item onSelect={() => run(onNewNote)} icon={<FilePlus2 className="size-4" />}>
            {t('New note', '新增筆記')}
          </Item>
          <Item onSelect={() => run(onNewDeck)} icon={<FolderPlus className="size-4" />}>
            {t('New deck', '新增牌組')}
          </Item>
          <Item onSelect={() => run(onImport)} icon={<Sparkles className="size-4" />}>
            {t('Import from AI', '從 AI 匯入')}
          </Item>
          <Item onSelect={() => run(() => navigate({ to: '/study' }))} icon={<GraduationCap className="size-4" />}>
            {t('Start studying', '開始學習')}
          </Item>
        </Command.Group>

        <Command.Group heading={t('Go to', '前往')} className="cmdk-group">
          <Item onSelect={() => run(() => navigate({ to: '/' }))} icon={<Home className="size-4" />}>
            {t('Today', '今天')}
          </Item>
          <Item onSelect={() => run(() => navigate({ to: '/graph' }))} icon={<Share2 className="size-4" />}>
            {t('Graph', '圖譜')}
          </Item>
          <Item
            onSelect={() => run(() => navigate({ to: '/settings/integrations' }))}
            icon={<Plug className="size-4" />}
          >
            {t('Connect an AI', '連接 AI')}
          </Item>
        </Command.Group>

        {decks?.length ? (
          <Command.Group heading={t('Decks', '牌組')} className="cmdk-group">
            {decks.map((d) => (
              <Item
                key={d.id}
                onSelect={() => run(() => navigate({ to: '/decks/$deckId', params: { deckId: d.id } }))}
              >
                {d.name}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {notes?.length ? (
          <Command.Group heading={t('Notes', '筆記')} className="cmdk-group">
            {notes.slice(0, 12).map((n) => (
              <Item
                key={n.id}
                onSelect={() => run(() => navigate({ to: '/notes/$noteId', params: { noteId: n.id } }))}
              >
                {n.title}
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
  onSelect,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect: () => void
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </Command.Item>
  )
}
