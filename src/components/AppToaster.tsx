import { useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'

const desktopMq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null

function subscribe(onChange: () => void) {
  desktopMq?.addEventListener('change', onChange)
  return () => desktopMq?.removeEventListener('change', onChange)
}

/**
 * Sonner toaster with a responsive position: bottom-right on desktop, top-center
 * on phones so toasts (incl. tappable Undo actions) never sit over the bottom
 * tab bar / FAB in the right-thumb swipe path. closeButton so any toast can be
 * dismissed without waiting it out.
 */
export function AppToaster() {
  const isDesktop = useSyncExternalStore(subscribe, () => desktopMq?.matches ?? true)
  return (
    <Toaster
      position={isDesktop ? 'bottom-right' : 'top-center'}
      closeButton
      richColors
      toastOptions={{ className: 'font-sans' }}
    />
  )
}
