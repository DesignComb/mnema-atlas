import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Unit tests only (Vitest). Playwright specs live in ./e2e as *.spec.ts and are
// excluded here so the two runners never collide.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
  },
})
