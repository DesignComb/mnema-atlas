import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/. The deploy workflow sets
  // VITE_BASE accordingly; locally it stays "/".
  base: process.env.VITE_BASE || '/',
  // Stamp the web build so the running app can tell whether the OTA manifest
  // (Capgo self-hosted) points at something newer. Set by scripts/_build-web.mjs
  // for the APK builtin and OTA bundles; "dev" locally (OTA check no-ops).
  define: { __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || 'dev') },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
