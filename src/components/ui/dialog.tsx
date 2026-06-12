import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/* ── Mobile bottom-sheet swipe-to-dismiss ──
   Below `sm` DialogContent presents as a bottom sheet; this hook lets a
   downward swipe dismiss it. Native touch events (not motion/drag) so we never
   fight Radix focus management or the content's own vertical scrolling:
   - the gesture only arms when the sheet's scroller is at scrollTop 0
   - touches that start in inputs, horizontal scrollers, or mid-scroll nested
     scrollers are left alone
   - past ~120px of pull (or a quick flick) it "clicks" a hidden Radix Close so
     the normal onOpenChange path runs; otherwise the sheet springs back. */
const CLOSE_DISTANCE = 120 // px of finger travel that commits the dismiss
const CLOSE_VELOCITY = 0.5 // px/ms — a flick commits sooner
const RESISTANCE = 0.85 // the sheet follows the finger at 85%

function useSheetSwipeDismiss(
  el: HTMLDivElement | null,
  closeRef: React.RefObject<HTMLButtonElement | null>,
) {
  React.useEffect(() => {
    if (!el) return
    const phone = window.matchMedia('(max-width: 639px)')
    const coarse = window.matchMedia('(pointer: coarse)')

    let armed = false
    let dragging = false
    let startY = 0
    let dy = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0

    const ignoreTarget = (target: EventTarget | null): boolean => {
      let node = target instanceof Element ? target : null
      if (node?.closest('input, textarea, select, [contenteditable="true"]')) return true
      while (node && node !== el) {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node)
          // Elements that own their own gesture (SortableList grips are touch-none):
          // their drags must never double as a sheet pull.
          if (style.touchAction === 'none') return true
          if (node.scrollWidth > node.clientWidth + 1 && /(auto|scroll)/.test(style.overflowX)) return true
          if (node.scrollTop > 0 && /(auto|scroll)/.test(style.overflowY)) return true
        }
        node = node.parentElement
      }
      return false
    }

    const springBack = () => {
      el.style.transition = 'transform 200ms ease'
      el.style.transform = 'translate3d(0,0,0)'
      const clear = () => {
        el.style.transition = ''
        el.style.transform = ''
        el.removeEventListener('transitionend', clear)
      }
      el.addEventListener('transitionend', clear)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (dragging) {
        // A second finger landed mid-pull — cancel cleanly instead of wedging
        // the sheet at its dragged offset with no path back.
        dragging = false
        armed = false
        springBack()
        return
      }
      armed = false
      if (e.touches.length !== 1) return
      if (!phone.matches || !coarse.matches) return
      if (el.scrollTop > 0 || ignoreTarget(e.target)) return
      armed = true
      startY = lastY = e.touches[0].clientY
      lastT = e.timeStamp
      dy = 0
      velocity = 0
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!armed) return
      const y = e.touches[0].clientY
      const delta = y - startY
      if (!dragging) {
        if (delta < -8 || el.scrollTop > 0) {
          armed = false // user is scrolling the content, not pulling the sheet
          return
        }
        if (delta <= 8) return // not decisive yet
        dragging = true
        el.style.transition = 'none'
      }
      if (e.cancelable) e.preventDefault() // we own the gesture: no scroll-chaining / pull-to-refresh
      const dt = e.timeStamp - lastT
      if (dt > 0) velocity = (y - lastY) / dt
      lastY = y
      lastT = e.timeStamp
      dy = Math.max(0, delta)
      el.style.transform = `translate3d(0, ${Math.round(dy * RESISTANCE)}px, 0)`
    }

    const onTouchEnd = () => {
      if (!armed) return
      armed = false
      if (!dragging) return
      dragging = false
      if (dy > CLOSE_DISTANCE || (dy > 24 && velocity > CLOSE_VELOCITY)) {
        // Keep the inline transform: the slide-out exit animation takes over
        // from the dragged position, then Radix unmounts the node.
        closeRef.current?.click()
      } else {
        springBack()
      }
    }

    const onTouchCancel = () => {
      armed = false
      if (dragging) {
        dragging = false
        springBack()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [el, closeRef])
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  // State (not a ref) so the swipe effect re-runs when Radix mounts/unmounts the node.
  const [contentEl, setContentEl] = React.useState<HTMLDivElement | null>(null)
  const composedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setContentEl(node)
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  useSheetSwipeDismiss(contentEl, closeRef)

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-foreground/15 backdrop-blur-[2px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <DialogPrimitive.Content
        ref={composedRef}
        className={cn(
          // Phones (below sm): bottom sheet — full width, anchored to the bottom
          // edge, rounded top, scrolls internally, safe-area padding under the footer.
          'fixed inset-x-0 bottom-0 top-auto z-50 grid max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto overscroll-contain',
          'rounded-t-2xl rounded-b-none border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop',
          // Desktop (sm+): the centered card, exactly as before.
          'sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:p-6',
          // Motion: fade always; slide-up sheet on phones, zoom on desktop — the
          // movement sits behind motion-safe so reduce-motion users get a plain fade.
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'motion-safe:max-sm:data-[state=open]:slide-in-from-bottom motion-safe:max-sm:data-[state=closed]:slide-out-to-bottom',
          'max-sm:data-[state=open]:duration-300 max-sm:data-[state=open]:ease-out max-sm:data-[state=closed]:duration-200',
          'motion-safe:sm:data-[state=open]:zoom-in-95 motion-safe:sm:data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {/* Grabber — phones only */}
        <div
          aria-hidden="true"
          className="mx-auto -mb-1 -mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden"
        />
        {children}
        {/* Swipe-to-dismiss closes through the normal Radix path by clicking this hidden Close. */}
        <DialogPrimitive.Close ref={closeRef} className="hidden" tabIndex={-1} aria-hidden="true" />
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground opacity-70 transition hover:bg-accent hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 sm:right-4 sm:top-4 sm:p-1">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 pt-2', className)} {...props} />
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'
