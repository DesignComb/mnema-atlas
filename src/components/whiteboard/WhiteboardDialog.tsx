import { lazy, Suspense } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'
import type { SketchScene } from '@/lib/sketch'

// perfect-freehand + the canvas component are only needed when the board opens —
// keep them out of the main/landing bundle (same lazy-split as the note editor).
const Whiteboard = lazy(() => import('./Whiteboard').then((m) => ({ default: m.Whiteboard })))

/**
 * Full-screen shell for the whiteboard. Deliberately NOT the project's
 * DialogContent: a full-bleed drawing canvas fights the mobile bottom-sheet's
 * internal scroll + swipe-to-dismiss, so we render a plain full-screen Radix
 * dialog and let <Whiteboard> own every exit (its Close button + Escape are
 * dirty-aware and show a discard guard), so we suppress Radix's own
 * escape/outside close.
 */
export function WhiteboardDialog({
  open,
  onOpenChange,
  initialScene,
  busy,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialScene?: SketchScene | null
  busy?: boolean
  onSave: (blob: Blob, scene: SketchScene) => Promise<void> | void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col bg-black outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Whiteboard</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Draw a quick sketch and save it as an image.
          </DialogPrimitive.Description>
          <div className="min-h-0 flex-1">
            {open ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-white/70" />
                  </div>
                }
              >
                <Whiteboard
                  initialScene={initialScene}
                  busy={busy}
                  onSave={onSave}
                  onClose={() => onOpenChange(false)}
                />
              </Suspense>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
