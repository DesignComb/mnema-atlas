import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useCreateNote } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { MobileNavContext } from '@/lib/mobile-nav'
import { AppSidebar } from './AppSidebar'
import { CommandPalette } from './CommandPalette'
import { NewDeckDialog } from './NewDeckDialog'
import { QuickImportDialog } from '@/components/cards/QuickImportDialog'

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const closeNavRef = useRef<HTMLButtonElement>(null)

  // Close the mobile nav drawer whenever the route changes (e.g. tapping a deck).
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // Move focus into the drawer when it opens (a11y).
  useEffect(() => {
    if (navOpen) closeNavRef.current?.focus()
  }, [navOpen])

  // ⌘K / Ctrl-K toggles the command palette; Esc closes the mobile drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setImportOpen(true)
      }
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const newNote = useCallback(async () => {
    try {
      const note = await createNote.mutateAsync({ title: 'Untitled', body: '' })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create note')
    }
  }, [createNote, navigate])

  const sidebarProps = {
    onOpenCommand: () => setCmdOpen(true),
    onNewDeck: () => setDeckOpen(true),
    onOpenImport: () => setImportOpen(true),
  }

  return (
    <MobileNavContext.Provider value={{ openNav: () => setNavOpen(true) }}>
      <div
        className={cn(
          'flex h-dvh overflow-hidden bg-background text-foreground',
          pathname.startsWith('/trips') && 'theme-voyage',
        )}
      >
        {/* Desktop: persistent sidebar (lg+). */}
        <AppSidebar className="hidden w-64 lg:flex" {...sidebarProps} />

        {/* Mobile: slide-in drawer + dim overlay (below lg). */}
        <div
          aria-hidden
          onClick={() => setNavOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden',
            navOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Navigation menu', '導覽選單')}
          inert={!navOpen}
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[84%] max-w-xs transition-transform duration-200 ease-out lg:hidden',
            navOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
          )}
        >
          <AppSidebar className="flex w-full" inDrawer {...sidebarProps} />
          <button
            ref={closeNavRef}
            onClick={() => setNavOpen(false)}
            aria-label={t('Close menu', '關閉選單')}
            className="absolute right-3 top-3.5 z-10 rounded-md p-1.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>

        <CommandPalette
          open={cmdOpen}
          onOpenChange={setCmdOpen}
          onNewNote={() => void newNote()}
          onNewDeck={() => setDeckOpen(true)}
          onImport={() => setImportOpen(true)}
        />
        <NewDeckDialog open={deckOpen} onOpenChange={setDeckOpen} />
        <QuickImportDialog open={importOpen} onOpenChange={setImportOpen} />
      </div>
    </MobileNavContext.Provider>
  )
}
