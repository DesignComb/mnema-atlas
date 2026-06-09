import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { I18nProvider } from '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import { WidgetSync } from '@/components/WidgetSync'
import { OtaUpdater } from '@/components/OtaUpdater'
import { FcmRegister } from '@/components/FcmRegister'
import { notifyReady } from '@/lib/ota'
import './index.css'

// Tell Capgo the bundle booted, as early as possible (before the provider tree
// renders) so a slow first paint never trips the 10s auto-rollback. No-op on web.
void notifyReady()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider delayDuration={200}>
              <RouterProvider router={router} />
              <WidgetSync />
              <OtaUpdater />
              <FcmRegister />
              <Toaster position="bottom-right" toastOptions={{ className: 'font-sans' }} richColors />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)

// Register the PWA service worker (production only — avoids dev caching pain).
// Skipped inside the Capacitor native shell: the app is served from bundled
// assets, so the web SW would only add a stale-cache layer and isn't needed for
// install/push (native uses its own plugins). Capacitor injects a global flag.
const isNative = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
