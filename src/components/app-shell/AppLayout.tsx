import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateNote } from '@/lib/hooks'
import { AppSidebar } from './AppSidebar'
import { CommandPalette } from './CommandPalette'
import { NewDeckDialog } from './NewDeckDialog'

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const navigate = useNavigate()
  const createNote = useCreateNote()

  // ⌘K / Ctrl-K toggles the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar onOpenCommand={() => setCmdOpen(true)} onNewDeck={() => setDeckOpen(true)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onNewNote={() => void newNote()}
        onNewDeck={() => setDeckOpen(true)}
      />
      <NewDeckDialog open={deckOpen} onOpenChange={setDeckOpen} />
    </div>
  )
}
