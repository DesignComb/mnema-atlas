import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'tw.dco.mnema',
  appName: 'Mnema',
  // Vite builds the web app into dist/ (base must be '/', so don't set VITE_BASE
  // when building for Capacitor — see cap:sync script in package.json).
  webDir: 'dist',
  android: {
    // Serve the bundled app from https://localhost so secure-context APIs
    // (crypto, service-worker-free fetch, Supabase) behave like the web build.
    backgroundColor: '#fdfdfb',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Route fetch/XHR through the native HTTP stack so calls to the AI Worker
    // (mnema-ai.dco.tw) and Supabase aren't blocked by webview CORS — the APK's
    // origin is https://localhost, which those servers don't allowlist.
    CapacitorHttp: {
      enabled: true,
    },
    // Self-hosted OTA (Capgo manual mode): the app checks our Supabase Storage
    // manifest and, on the user's tap, downloads + swaps the web bundle. No cloud
    // account — see src/lib/ota.ts + scripts/ota-publish.mjs. autoUpdate off so
    // updates only apply when the user opts in; notifyAppReady() guards rollback.
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 10000,
    },
  },
}

export default config
