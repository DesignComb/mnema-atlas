import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Load gitignored local env (test creds + keys) into process.env without
// clobbering anything CI already provides.
for (const rel of ['.env.test', 'worker/.dev.vars', '.env.local']) {
  const p = fileURLToPath(new URL(rel, import.meta.url))
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Authed e2e only runs when a test account + the keys are available (local, or
// CI secrets). Otherwise just the public-surface suite runs — CI stays green.
const AUTHED = !!(
  process.env.E2E_TEST_EMAIL &&
  process.env.SUPABASE_SECRET_KEY &&
  (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY) &&
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  projects: [
    {
      name: 'public',
      testMatch: ['**/landing.spec.ts', '**/navigation.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    ...(AUTHED
      ? [
          { name: 'setup', testMatch: /auth\.setup\.ts/ },
          {
            name: 'authed',
            testMatch: /.*\.authed\.spec\.ts/,
            dependencies: ['setup'],
            teardown: 'cleanup',
            use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
          },
          { name: 'cleanup', testMatch: /auth\.teardown\.ts/ },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
