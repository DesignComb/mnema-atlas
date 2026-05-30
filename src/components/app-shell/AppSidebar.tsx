import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  Layers,
  LogOut,
  Plug,
  Plus,
  Search,
  Share2,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useDecks } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV = [
  { to: '/', label: 'Today', icon: Home, exact: true },
  { to: '/notes', label: 'Notes', icon: FileText, exact: false },
  { to: '/cards', label: 'Flashcards', icon: Layers, exact: false },
  { to: '/graph', label: 'Graph', icon: Share2, exact: false },
  { to: '/study', label: 'Study', icon: GraduationCap, exact: false },
] as const

export function AppSidebar({
  onOpenCommand,
  onNewDeck,
  onOpenImport,
}: {
  onOpenCommand: () => void
  onNewDeck: () => void
  onOpenImport: () => void
}) {
  const { user, signOut } = useAuth()
  const { data: decks } = useDecks()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
          <BookOpenCheck className="size-4" />
        </div>
        <span className="font-serif text-[17px] font-semibold tracking-tight text-foreground">Mnema Atlas</span>
      </div>

      {/* Search / Cmd-K */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2 rounded-md border border-transparent bg-sidebar-accent/60 px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:border-border hover:bg-card"
        >
          <Search className="size-3.5" />
          <span>Search…</span>
          <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-1">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
                active
                  ? 'bg-brand-muted text-brand'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Decks */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Decks
        </span>
        <button
          onClick={onNewDeck}
          className="rounded p-0.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          title="New deck"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-0.5 pb-4">
          {decks?.length ? (
            decks.map((deck) => {
              const active = pathname === `/decks/${deck.id}`
              return (
                <Link
                  key={deck.id}
                  to="/decks/$deckId"
                  params={{ deckId: deck.id }}
                  className={cn(
                    'group flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'bg-sidebar-accent text-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                  )}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-brand/50" />
                  <span className="truncate">{deck.name}</span>
                </Link>
              )
            })
          ) : (
            <p className="px-2.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground/70">
              No decks yet. Create one, or let an AI assistant add content via MCP.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-sidebar-accent">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{user?.email}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onOpenImport()}>
              <Sparkles /> Import from AI
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/connect">
                <Plug /> Connect an AI
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/keys">
                <KeyRound /> API keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/tools">
                <Wrench /> Tools
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
