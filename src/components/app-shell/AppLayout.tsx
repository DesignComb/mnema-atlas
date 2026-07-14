import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateNote, useDueReminders } from '@/lib/hooks'
import { cn, humanizeError, untitledLabel } from '@/lib/utils'
import { ShellContext } from '@/lib/mobile-nav'
import { useSwipeNav } from '@/lib/swipe-nav'
import { saveLastRoute } from '@/lib/last-route'
import { ProductTour, hasSeenTour, markTourSeen } from '@/lib/tour'
import { AppSidebar } from './AppSidebar'
import { SpaceRail } from './SpaceRail'
import { BottomTabs } from './BottomTabs'
import { SpacesSheet } from './SpacesSheet'
import { ProfileSheet } from './ProfileSheet'
import { CaptureDialog } from './CaptureDialog'
import { CommandPalette } from './CommandPalette'
import { NewDeckDialog } from './NewDeckDialog'
import { QuickImportDialog } from '@/components/cards/QuickImportDialog'

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [spacesOpen, setSpacesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const mainRef = useRef<HTMLElement>(null)
  useSwipeNav(mainRef)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const fullPath = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr })
  useDueReminders()

  // Remember where the user is so opening the app resumes here (see router index).
  useEffect(() => {
    saveLastRoute(fullPath)
  }, [fullPath])

  // Close the mobile sheets whenever the route changes (e.g. picking a space).
  useEffect(() => {
    setSpacesOpen(false)
    setProfileOpen(false)
  }, [pathname])

  // ⌘K / Ctrl-K toggles the command palette; ⌘I opens import. (Sheets handle
  // Escape themselves via Radix Dialog.)
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // First run: auto-launch the product tour once. The delay lets the shell paint
  // so the chrome the tour spotlights is measurable; the flag makes it one-time.
  useEffect(() => {
    if (hasSeenTour()) return
    const id = setTimeout(() => setTourOpen(true), 900)
    return () => clearTimeout(id)
  }, [])

  const closeTour = useCallback(() => {
    markTourSeen()
    setTourOpen(false)
  }, [])

  const newNote = useCallback(async () => {
    try {
      const note = await createNote.mutateAsync({ title: untitledLabel(), body: '' })
      navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to create note', '建立筆記失敗']))
    }
  }, [createNote, navigate])

  const sidebarProps = {
    onOpenCommand: () => setCmdOpen(true),
    onNewDeck: () => setDeckOpen(true),
  }

  return (
    <ShellContext.Provider
      value={{
        openProfile: () => setProfileOpen(true),
        openCommand: () => setCmdOpen(true),
        openImport: () => setImportOpen(true),
        startTour: () => setTourOpen(true),
      }}
    >
      <div
        // Pad past the device status bar (top) so content isn't drawn under it on
        // edge-to-edge Android / notched phones (viewport-fit=cover makes env() real).
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        className={cn(
          'flex h-dvh overflow-hidden bg-background text-foreground',
          pathname.startsWith('/trips') && 'theme-voyage',
          pathname.startsWith('/tempo') && 'theme-tempo',
          pathname.startsWith('/galleon') && 'theme-galleon',
          pathname.startsWith('/health') && 'theme-health',
          pathname.startsWith('/kitchen') && 'theme-kitchen',
        )}
      >
        {/* Desktop: far-left space rail (1-tap switch) + the contextual sidebar (lg+). */}
        <SpaceRail onCapture={() => setCaptureOpen(true)} />
        <AppSidebar className="hidden w-60 lg:flex" {...sidebarProps} />

        <main
          ref={mainRef}
          className="flex min-w-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          <Outlet />
        </main>

        {/* Mobile: bottom tab bar — anchor spaces + Capture FAB + Spaces overflow. */}
        <BottomTabs onCapture={() => setCaptureOpen(true)} onOpenSpaces={() => setSpacesOpen(true)} />

        <SpacesSheet open={spacesOpen} onOpenChange={setSpacesOpen} />
        <ProfileSheet
          open={profileOpen}
          onOpenChange={setProfileOpen}
          onOpenCommand={() => setCmdOpen(true)}
        />
        <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
        <CommandPalette
          open={cmdOpen}
          onOpenChange={setCmdOpen}
          onNewNote={() => void newNote()}
          onNewDeck={() => setDeckOpen(true)}
          onImport={() => setImportOpen(true)}
        />
        <NewDeckDialog open={deckOpen} onOpenChange={setDeckOpen} />
        <QuickImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <ProductTour run={tourOpen} onClose={closeTour} />
      </div>
    </ShellContext.Provider>
  )
}
