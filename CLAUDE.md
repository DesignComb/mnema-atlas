# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

mnema-atlas is a bilingual (en/zh) React 19 + Vite + Supabase "life OS" — one app shell hosting several top-level **Spaces** (Study notes/decks/flashcards, Travel/Trips, Tempo tasks, Galleon money, Health, Kitchen, plus a note Graph). Its defining architectural idea: **every write — from the React UI, the MCP server, and the REST API — goes through the *same* Postgres `SECURITY DEFINER` RPC**, so AI-added content is byte-identical to UI-added content. A shared Zod layer (`shared/schemas.ts`) is imported by both the app and the Cloudflare Worker so the three surfaces (UI, MCP, REST) cannot drift. Product DNA is **BYO-AI**: users connect their *own* external AI via the Worker's write-path; there is no in-app AI generation.

## Commands

> Windows + PowerShell is the default shell. The frontend (root) and the Cloudflare Worker (`worker/`) are **separate npm packages** — `npm install` in each; they run on different ports.

```powershell
# Install
npm install                  # frontend (root package.json)
cd worker; npm install       # worker (worker/package.json)

# Dev (two servers, run separately)
npm run dev                  # frontend — Vite on http://localhost:5173 (port pinned in vite.config.ts)
cd worker; npm run dev       # worker — wrangler dev, http://localhost:8787 (MCP + REST)

# Typecheck — the ONLY static check (there is NO lint/format anywhere)
npm run typecheck            # tsc --noEmit (frontend)
cd worker; npm run typecheck # tsc --noEmit (worker)
```

There is **no ESLint/Prettier/Biome** config or script — the `eslint-disable` comments in source are inert. CI runs `typecheck` + `test` (`.github/workflows/test.yml`).

```powershell
# Unit tests (Vitest) — picks up src/**/*.test.{ts,tsx} + shared/**/*.test.ts (env: node)
npm test                                 # vitest run (one-shot)
npm run test:watch                       # watch mode
npx vitest run src/path/file.test.ts     # single FILE
npx vitest run -t "test name"            # single test by NAME (substring/regex)
npx vitest run src/foo.test.ts -t "case" # combine file + name
```
Playwright `e2e/*.spec.ts` are excluded from Vitest so the two runners never collide. Aliases: `@` → `src/`, `@shared` → `shared/`.

```powershell
# E2E (Playwright) — baseURL is http://localhost:4173 (its webServer runs build + preview --strictPort), NOT :5173
npm run test:e2e                              # all projects
npx playwright test e2e/landing.spec.ts       # one file
npx playwright test -g "title substring"      # one test by title
npx playwright test --project=public          # public-surface project only
npx playwright install --with-deps chromium   # first-time browser install
```
- The **`public`** project (`landing.spec.ts`, `navigation.spec.ts`) always runs — no creds — so CI stays green.
- **Authed** projects register only when `E2E_TEST_EMAIL` + `SUPABASE_SECRET_KEY` + a publishable/anon key + a Supabase URL are present (`playwright.config.ts` loads `.env.test`, `worker/.dev.vars`, `.env.local` without clobbering existing env). `setup` (`e2e/auth.setup.ts`) mints a session via an **admin magic link** (service key) → OTP verify with the anon key → writes the supabase-js localStorage entry to `e2e/.auth/state.json` (no Google OAuth UI). `cleanup` (`e2e/auth.teardown.ts`) deletes the test account's rows + files.
- Bootstrap the account first: `node scripts/setup-test-user.mjs` (idempotent; writes `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` to `.env.test`).

```powershell
# Supabase / DB (local stack: API 54321, db 54322, studio 54323)
npm run db:start   # supabase start
npm run db:reset   # supabase db reset (re-applies supabase/migrations + seed)
npm run db:push    # supabase db push → the LINKED remote (supabase link --project-ref <ref>)
npm run db:types   # gen types → src/lib/database.types.ts
```
Out-of-band remote migrations: `node scripts/apply-migrations.mjs 0027 0028 …` applies the named `supabase/migrations/NNNN_*.sql` to the remote via the Supabase Management API (reads an `sbp_` token from `.env.local`/`worker/.dev.vars`, then verifies expected tables/functions). It **requires** explicit migration-number args — it does NOT apply "all pending".

```powershell
# Capacitor / Android + release
npm run cap:sync     # scripts/build-web.mjs (stamped web build) → cap sync android
npm run cap:open     # cap open android
npm run cap:apk      # gradlew.bat assembleDebug (debug APK)
npm run ota:publish  # scripts/ota-publish.mjs "notes"  — WEB-only update
npm run apk:release  # scripts/apk-release.mjs "notes"  — NATIVE release

# Worker deploy (publishes to mnema-ai.dco.tw)
cd worker; npm run deploy   # wrangler deploy
```
- **`cap:sync`** stamps `BUILD_VERSION = max(now, latest published OTA version)` (a fresh APK is never seen as a downgrade), builds with `VITE_BASE` cleared (base `/`, required for Capacitor), then `cap sync android`. `BUILD_VERSION` flows into `__BUILD_VERSION__` via `vite.config.ts`.
- **`ota:publish`** (web-only): builds a stamped bundle, zips/sha256s `dist/`, uploads `bundle-<ver>.zip` + `manifest.json` to the public Supabase Storage `ota` bucket; the app polls `manifest.json` (Capgo self-hosted, `autoUpdate: false`).
- **`apk:release`** (native — plugins/manifest/widgets): bumps `versionCode +1` / `versionName "1.<code>"` in `android/app/build.gradle`, runs `cap:sync`, builds `assembleDebug`, creates a `gh release` tagged `apk-YYYYMMDD-HHMM` (APK asset renamed `mnema.apk`, `--latest`), uploads `apk-manifest.json` to the same bucket. Requires the **`gh` CLI logged in**; `--dry-run` bumps+builds only. Commit the `build.gradle` bump afterward.
- `ota:publish` and `apk:release` are **not** interchangeable. Several release scripts parse env out of `worker/.dev.vars`/`.env.local` by regex **including commented-out lines** — keys can be parked behind a `#`.

### Required env vars
- **Frontend (`VITE_*`, browser-safe) in `.env.local`:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MCP_URL`, `VITE_REST_URL`. Optional: `VITE_VAPID_PUBLIC_KEY`, `VITE_BASE` (set only by the GitHub Pages deploy — leave unset for Capacitor).
- **Worker (server-only, NEVER browser):** `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service/secret key — **bypasses RLS**). Local: `worker/.dev.vars`; prod: `wrangler secret put <NAME>`. Push: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (web-push disabled until both set); `VAPID_PUBLIC_KEY` + `WORKER_PUBLIC_URL` are committed `[vars]` in `worker/wrangler.toml`. Optional `CRON_SECRET`. The Cron Trigger block in `wrangler.toml` is commented out (needs a workers.dev subdomain — API error 10063).
- **E2E (`.env.test`, written by `setup-test-user.mjs`):** `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.

## Data architecture & the shared write path

The single most important concept: **there is one write code path**, reused by UI, MCP, and REST. The trust boundary is the RPC, not the API key.

```
shared/schemas.ts (Zod)  ──single source of truth, imported by app + worker──┐
        │                                                                    │
   ┌────┴─────┐  supabase.rpc(name,{p_user_id:null,…})          ┌────────────┴────┐
   │ React UI │  (anon/publishable key, RLS-bound)              │ Worker tools.ts │  MCP + REST
   │  api.ts  │                                                 │ callRpc(env,uid,…) │ (service key, BYPASSES RLS)
   └────┬─────┘                                                 └────────┬────────┘
        └────────────►  public.<rpc>(p_user_id, …) ◄────────────────────┘
                        SECURITY DEFINER + app.resolve_uid()
                        stamps the RESOLVED user_id, then INSERT/UPDATE
```

- **`app.resolve_uid(p_user_id)`** (`supabase/migrations/0001_init.sql:24`) is the security spine. With a JWT subject (`auth.uid()`, the browser) the caller may only act as themselves — a different `p_user_id` raises `forbidden` (`42501`). With no JWT (worker service-role call) `p_user_id` is **required** and trusted.
- So the **browser always passes `p_user_id: null`** (the owner defaults to `auth.uid()`; passing a real id is redundant, a different id is rejected). The **worker passes the resolved user id** the API key gave it: `serviceClient(env).rpc(name, { p_user_id: userId, …args })` (`worker/src/db.ts:23`). A leaked publishable key cannot spoof another user; the worker physically cannot forge an id its key didn't resolve to.
- **Worker user resolution:** REST + MCP authenticate with a Bearer key (prefix `mk_`). `worker/src/auth.ts` SHA-256-hashes the plaintext and calls `verify_api_key` (granted to `service_role` only), which stamps `last_used_at`, enforces `revoked_at`/`expires_at`, and returns `(user_id, scopes)`. Keys carry **scopes**: an add-only key lacks `edit`, so tools marked `requiresScope: 'edit'` (mutate/delete) are rejected in both transports.

### Reads vs writes
- **Writes are always an RPC.** Since `0011_p0_hardening.sql` the direct insert/update/delete RLS policies were **dropped**, so direct table writes with the publishable key are physically impossible — only the RLS-bypassing RPCs can write. Do NOT add a `supabase.from().insert()` in the UI; route it through an RPC.
- **Reads:** the **UI reads tables directly** via `supabase.from(...).select()`, scoped by per-table `_select` RLS (`(select auth.uid()) = user_id`, `authenticated` only; `0001_init.sql:222`). The **worker**, having bypassed RLS, must scope reads itself with `ownedSelect(env, userId, table, cols)` which appends `.eq('user_id', userId)` (`worker/src/db.ts:29`) — a raw unscoped `serviceClient().from(table)` read would leak every user's data. Some reads are RPCs too (`get_graph`, `search_notes`, `get_itinerary`, `list_tasks`, …) to return whole trees in one round-trip.

### Provenance & migrations
- `created_via text` (`'ui' | 'rest' | 'mcp'`, CHECK-constrained) distinguishes AI-added rows without a separate table. UI hard-codes `'ui'`; the worker passes `ctx.via`. (`notes.created_via` was accepted-but-discarded until `0040_note_provenance_deck_nesting.sql` wired it through.)
- `supabase/migrations/NNNN_*.sql` are numbered, **append-only**; each defines tables + their RPCs together (`0001` study core, `0008` itineraries, `0013` trip v2, `0014` tempo/tasks, `0016`–`0022`/`0029` Galleon, `0024` captures, `0027` health, `0028` kitchen). All RPCs are `SECURITY DEFINER` with `set search_path = ''`, so **every identifier must be fully qualified** (`public.x`, `app.x`, `extensions.x`). New functions default to `EXECUTE` for `PUBLIC`, so each migration MUST end with `revoke all on function … from public; grant execute … to authenticated, service_role;` (`0001_init.sql:610`) — forgetting this silently exposes the function to anon.

### Adding a new write tool (all three surfaces) — touch these 5 places in order
1. **`shared/schemas.ts`** — add `createXInput` (+ exported `CreateXInput`). This is the contract.
2. **New `supabase/migrations/NNNN_*.sql`** — `public.create_x(p_user_id uuid, …)`: `SECURITY DEFINER`, `set search_path = ''`, first line `v_uid uuid := app.resolve_uid(p_user_id);`, fully-qualified names, then the `revoke`/`grant` block. (Append-only — never edit a shipped migration.)
3. **`src/lib/api.ts`** — thin wrapper: `unwrap(await supabase.rpc('create_x', { p_user_id: null, p_…: input…, p_created_via: 'ui' }))`.
4. **`src/lib/hooks.ts`** — `useMutation({ mutationFn: api.createX, onSuccess: () => qc.invalidateQueries({ queryKey: … }) })`.
5. **`worker/src/tools.ts`** — append a `ToolDef` (its `run` must return a `ToolResult` of `{ summary, data }`, so wrap the RPC result): `{ name, description, schema: createXInput, readOnly: false, requiresScope?: 'edit', run: async (ctx, a) => { const r = await callRpc(ctx.env, ctx.userId, 'create_x', { p_…: a…, p_created_via: ctx.via }); return { summary: …, data: r } } }`. One registry feeds both MCP and REST — no per-surface wiring.

## Frontend architecture

React 19 + Vite SPA. `src/main.tsx` mounts a fixed provider stack — `ThemeProvider` → `I18nProvider` → `QueryClientProvider` → `AuthProvider` → `TooltipProvider` → `MotionConfig` → `RouterProvider` — plus side-effect singletons (`WidgetSync`, `OtaUpdater`, `FcmRegister`, `AppToaster`). The PWA service worker registers only in `PROD` **and** only on web (skipped when `window.Capacitor.isNativePlatform()`); native uses bundled assets + its own push/OTA plugins.

### The "Spaces" mental model
The app is one shell hosting several top-level **Spaces**, each with its own wordmark, hue, icon, and sub-nav. **`src/components/app-shell/spaces.ts`** is the single source of truth (`SPACES` array) for the desktop rail, mobile bottom tabs, the Spaces sheet, and the sidebar header. The six Spaces: `study` (`/today`, "Mnema Atlas"), `travel` (`/trips`, "Mnema Voyage"), `tempo` (`/tempo`, "Mnema Tempo"), `galleon` (`/galleon`, "Mnema Galleon"), `health` (`/health`, "Mnema Vitals"), `kitchen` (`/kitchen`, "Mnema Kitchen"). `activeSpace(pathname)` maps any path back to a Space (Study is the catch-all). Each Space's hue is a `.theme-*` class toggled by `AppLayout` based on `pathname.startsWith(...)`, so active UI just uses shared `bg-brand`/`text-brand` tokens.

Adding a Space is **not** a one-file edit despite the SSOT: you must also add the type-checked `Record<SpaceKey,…>` entry in `AppSidebar.tsx` (SPACE_SIDEBAR — won't compile without it), update `APP_PREFIXES` in `last-route.ts`, and the `theme-*` className map in `AppLayout`.

### Route tree (TanStack Router)
Built imperatively in `src/router.tsx` (not file-based): `rootRoute` → public routes + a single pathless `_app` layout route that gates auth.
- **Public (no session):** `/` (`LandingScreen`; if a session exists, `beforeLoad` redirects to `getLastRoute() ?? '/today'`), `/login` (→ `/`), `/faq`, `/self-host`, `s/$token` (read-only shared-trip).
- **`_app` (auth-gated):** `id: '_app'` pathless route whose `beforeLoad` calls `supabase.auth.getSession()` and `throw redirect({ to: '/' })` when absent; its component is `AppLayout`. Children: `today` (`?review`), `notes` (`?tag`), `notes/$noteId`, `decks`, `decks/$deckId`, `cards` (`?tag`), `trips`, `trips/$tripId` (`?tab`), `tempo`, `galleon`, `health`, `kitchen`, `study` (`?tag`), `study/$deckId`, `graph`, `guide`, `settings/integrations` (+ `settings/keys|connect|tools` redirects).
- Created with `defaultPreload: 'intent'`, `scrollRestoration: true`, a `defaultErrorComponent` (`RouteErrorScreen` — crashed routes show a recovery card, never a white screen), and `basepath: import.meta.env.BASE_URL`.

**Per-Space search params avoid collision** — each Space owns a *distinct* param name validated by its route's `validateSearch`, so sibling params survive `search: (prev) => ({...prev, …})` merges:
- Tempo → `?view` (`today|upcoming|all|calendar|habits|capture|lists`) + `?list`/`?new`/`?capture`. `all` is canonicalised to a **cleared** param (the SubNav active-check treats `undefined` as "All tasks"; setting `view: 'all'` explicitly breaks the highlight — `router.tsx:138`).
- Galleon → `?section` · Health → `?section` (different routes, so no clash) · Kitchen → `?ksection` (named uniquely so it can't collide with Health's `section`) + `?recipe` · Trip detail → `?tab` (`itinerary|bookings|budget|packing`). Reuse the Space's existing param; don't invent a new one.

**Code-splitting is deliberate:** light/common screens (Landing, today, Notes, Deck, Cards) are eager; heavy/rare leaves (Trips, Trip, Tempo, Galleon, Health, Kitchen, Note, Study, Graph, Guide, Integrations, public FAQ/self-host/shared-trip) are `lazyRouteComponent(() => import(...), 'ExportName')`. Don't statically import TipTap, react-force-graph, or motion-heavy bundles into eager routes — a `/` visitor must never download them.

### Data layer: api.ts ⟶ hooks.ts (components never call Supabase for writes)
1. **`src/lib/api.ts`** — typed RPC wrappers. Reads use RLS-scoped `supabase.from(...).select(...)`; writes go through Postgres RPCs (the same path the Worker exposes as MCP/REST). A shared `unwrap<T>()` throws `res.error`, returns `res.data`. Typed by `@shared/schemas` + `database.types.ts`.
2. **`src/lib/hooks.ts`** — the React Query surface. `useQuery` reads call `api.*`; `useMutation` writes call `api.*` then `onSuccess` invalidates the affected keys. A central `qk` key-factory namespaces keys; per-Space `bump*` helpers (`bumpTrips`, `bumpTasks`, `bumpHealth`, `bumpKitchen`, `bumpGalleon`, `bumpCaptures`) invalidate that Space's whole key family at once.

Components **never call `supabase` directly for writes**; the few legit in-component reads are narrow exceptions (`useDueReminders` poll, `useItineraryRealtime` channel, command-palette `searchNotes`). Hot paths use optimistic `onMutate`/`onError` rollback (`flipTaskStatus`, note-star toggle, shopping check-off, `useSetUserLayout` which also mirrors to localStorage). `queryClient` (`src/lib/queryClient.ts`): `staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 1`. Error UX is per-call (`toast.error(humanizeError(e, [en, zh]))`) — there's no global mutation-error handler.

### Navigation: desktop vs mobile
Navigation chrome lives in `AppLayout`, which also wires `⌘K`/`Ctrl-K` (command palette), `⌘I` (import), the Capture dialog, and `useSwipeNav(mainRef)`.
- **Desktop (`lg+`):** fixed far-left **`SpaceRail`** (one-tap Space switch + global Capture button) + a contextual **`AppSidebar`** (`hidden w-60 lg:flex`) that flips by `activeSpace` — Study shows the nested deck tree (`DeckTreeNav`, drag-reorderable), Tempo shows views + the user's lists, a trip-detail page swaps to that trip's `?tab` sections.
- **Mobile (`<lg`):** the old drawer is retired. **`BottomTabs`** (fixed bar: `anchor: true` Spaces — study/tempo/galleon — split around a raised Capture FAB, plus a permanent "Spaces" tab; a `motion` "liquid blob" tracks the active Space) + **`SpacesSheet`** (bottom-sheet grid of all Spaces). Within-Space nav is the **`SubNav`** strip (`lg:hidden`), data-driven from `spaceSubnav()` in `spaces.ts` — only Study (`STUDY_NAV`, distinct routes) and Tempo (`TEMPO_VIEWS`, `?view`) render a strip; Money/Health/Kitchen keep in-page section tabs. Note/deck **detail** pages match `NO_STRIP` so they get **no** SubNav AND no swipe-nav (a horizontal swipe in an editor must not flip tabs — update `NO_STRIP` if you add such a route). `useSwipeNav` moves between the current strip's items on a decisive horizontal swipe, ignoring inputs, horizontal scrollers, and gesture-owning elements.

`src/lib/mobile-nav.tsx` exposes `ShellContext`/`useShell` so a screen's `PageHeader` can reach the shell's `openProfile`/`openCommand` (mobile only).

### Cross-cutting
- **Last-route resume** (`src/lib/last-route.ts`): `AppLayout` saves `pathname + searchStr` on every nav (only `APP_PREFIXES` paths persist to `localStorage['mnema:last-route']`); the `/` `beforeLoad` resumes there (validated, falls back to `/today`).
- **Auth** (`src/lib/auth.tsx`): Google OAuth, web vs native split. Web = full-page redirect (guards re-run for free); native opens the system browser, finishes via an `appUrlOpen` deep-link (`tw.dco.mnema://login-callback`) + `exchangeCodeForSession`. Because native sign-in/out doesn't navigate, `onAuthStateChange` **dynamically imports** the router and calls `router.invalidate()` on `SIGNED_IN`/`SIGNED_OUT` (dynamic import avoids a static auth↔router cycle).
- **Two theming systems, don't conflate:** `theme.tsx` = light/dark (`.dark` on `<html>`, `localStorage['theme']`); the per-Space brand **hue** is a separate `.theme-*` class applied by `AppLayout` from the pathname.
- **Aliases** (`vite.config.ts`): `@` → `./src`, `@shared` → `./shared`.

## AI access worker (MCP + REST)

A **separate npm package** under `worker/` (own `package.json`, deps, `wrangler.toml`) — not part of the Vite build. All worker commands run from `worker/`: `npm run dev` (wrangler dev, reads `worker/.dev.vars`), `npm run typecheck`, `npm run deploy` (publishes to `mnema-ai.dco.tw`). There is **no test script** in the worker package.

### One Worker, two transports, one registry
`worker/src/index.ts` is a hono app exporting `{ fetch, scheduled }`. Both write transports share the **single tool registry** in `worker/src/tools.ts` (~158 tools, grouped by `// ── <Space>` comment banners — read it in pages / Grep the banners; it's ~2617 lines):
- **MCP** — `POST /mcp` (`worker/src/mcp.ts`). Stateless Streamable HTTP via `mcp-lite`; a fresh `McpServer` + `StreamableHttpTransport` per request, bound to the resolved user, every tool registered with `via: 'mcp'`. (`structuredContent` wraps bare arrays as `{ items }` because the MCP spec forbids top-level arrays.)
- **REST** — mounted at `/rest` (`worker/src/rest.ts`). `GET /rest` lists tools; `POST /rest/<tool>` validates the body with `tool.schema.safeParse`, runs with `via: 'rest'`, returns `{ ok, summary, data }`, where `data` is the tool's result (object or array — bulk/list tools return arrays; the `{ items }` array-wrapping is MCP-only).

Both call the same `ToolDef.run` → shared Zod schemas → shared `SECURITY DEFINER` RPCs (`callRpc` in `worker/src/db.ts`), so AI-added content is byte-identical to UI content. No tool writes a table directly; reads use `ownedSelect`/`serviceClient` manually scoped by `user_id`. The Worker holds `SUPABASE_SECRET_KEY` (bypasses RLS) — safe only because `callRpc` injects the *resolved* `p_user_id` and the RPC validates ownership; it never trusts a client-supplied id and stamps `p_created_via = ctx.via`.

### Auth & scopes
Caller sends `Authorization: Bearer mk_…`; the Worker SHA-256-hashes it → `verify_api_key(p_key_hash)` → `{ user_id, scopes }` (also stamps `last_used_at`, enforces revoked/expired). Keys are minted in-app (Settings → API keys). **Add-only** keys (default) can create + read everywhere but cannot mutate existing rows — tools with `requiresScope: 'edit'` are blocked by `toolAllowed()` (403 on REST, thrown error on MCP). A static `mk_` Bearer works today with **Claude Code, Cursor, and the Claude API mcp-connector**; the **claude.ai consumer connector requires OAuth 2.1 + PKCE** (Phase 3b, **not wired**).

### Generated discovery (never goes stale)
Three keyless endpoints are **derived from the same `tools` array**, so they can't drift — don't hand-maintain a separate list: `worker/src/openapi.ts` → `GET /openapi.json` (OpenAPI 3.1); `worker/src/llms.ts` → `GET /llms.txt`; `worker/src/discovery.ts` → `GET /` and `GET /.well-known/mnema`.

### Cron delivery
`worker/src/scheduled.ts` runs four idempotent scans fanning out to web-push (`@block65/webcrypto-web-push`, VAPID) + FCM (`sendFcm`): `runReminderScan`, `runTodoDigestScan`, `runHabitReminderScan` (per-minute, self-gated on the clock), `runDailyReviewScan` (evening); each marks via its own `mark_*` RPC, prunes dead 404/410 subs. The Cloudflare Cron Trigger in `wrangler.toml` is **disabled** (needs a workers.dev subdomain — error 10063), so cron is currently driven by **Supabase pg_cron** POSTing `/_cron/run-reminders` + `/_cron/run-daily-reviews`, guarded by the `x-cron-secret` (`CRON_SECRET`). Service-worker notification buttons (已完成/延後/打卡) POST `/_action`, identifying the user by their push-subscription endpoint (not an API key).

### Rate limiting
`worker/src/ratelimit.ts`: authed traffic keyed by the **API key** (agents share provider egress IPs); keyless discovery keyed by **IP**. Cloudflare bindings `RL_KEY` (600/60s) + `RL_IP` (120/60s), both optional so a missing binding never 500s.

## Conventions & gotchas

Enforced across the app (full style guide: `docs/UI_GUIDELINES.md`). Not optional.

- **Bilingual: every user-facing string is `t(en, zh)`** — no key catalog, no locale JSON. Write both inline at the call site: `const t = useT()` (from `src/lib/i18n.tsx`), then `t('Save', '儲存')`. `t` just returns the active language's argument; components must be inside `<I18nProvider>` or `useI18n` throws. Sidebar/nav items are the exception (separate `label`/`zh` fields). Date/weekday labels are already bilingual — use `src/lib/tempo-date.ts` helpers (`fmtDayDate`, `relativeDayLabel`), don't hand-format.
- **Colours: semantic OKLCH tokens only** (`src/index.css`). Never hardcode `gray-500`/`#fff`/hex/one-off shadows. Background `bg-background`; surfaces `bg-card border-border shadow-soft`; text `text-foreground`/`text-muted-foreground`; accent/links `text-brand`/`bg-brand`/`bg-brand-muted`; hover `hover:bg-accent`; destructive `text-destructive`. Radius `rounded-md` (controls) / `rounded-xl` (cards) / `rounded-full` (pills); shadow `shadow-soft` resting, `shadow-pop` raised. **Per-Space re-hue:** write `text-brand`/`bg-brand` and it follows the active Space's `.theme-*` class — don't hardcode a Space's colour. The **`--color-capture`** token is deliberately fixed and **not** re-hued (one stable global affordance).
- **Reuse `ui/*` primitives.** Never a bare `<select>` (use `Select` for the chevron + styling). Never a clickable `<div>` without `role="button"` — use a real `<button>`/`<a>`/`Link` or add `role="button"`; `src/index.css` restores `cursor: pointer` only on real interactive/`role=button` elements (Tailwind v4 dropped the default), so don't sprinkle `cursor-pointer`. Form fields → `Input`/`Textarea`/`Label`; menus → `DropdownMenu`; modals → `Dialog` (controlled `open`/`onOpenChange`; create/edit dialogs follow `NewDeckDialog`: mutate → `toast.success/error` → `onOpenChange(false)`). Tabs/section nav use the **underline** style (`-mb-px border-b-2`, active = `border-brand`), not a segmented control. Keep `focus-visible:ring-2 focus-visible:ring-ring/40`.
- **Dates: `'YYYY-MM-DD'` UTC strings, string math only.** All calendar dates are plain strings handled in UTC (`src/lib/tempo-date.ts`) so day math never drifts across tz/DST — use `addDays`/`dayDiff`/`startOfWeek`/`weekday`; don't do `new Date(iso)` local-time math or pass `Date` objects. (`todayISO()` is intentionally local-time so "today" matches the wall clock.)
- **Capacitor / native (Android):**
  - **`__BUILD_VERSION__`** is a Vite `define` from `process.env.BUILD_VERSION` (`vite.config.ts`), format `YYYYMMDDHHmm`, default `'dev'`. OTA detection compares this number; a `'dev'` build never prompts. Don't reference build version any other way.
  - **OTA is self-hosted Capgo, manual mode** (`autoUpdate: false`), two channels: `src/lib/ota.ts` ships **web-layer** bundles (fetch `/ota/manifest.json`, swap on tap; `notifyReady()` must run on boot or Capgo rolls the bundle back); `src/lib/apk-update.ts` ships **native** changes (plugins/widgets/manifest) via the `ApkInstaller` plugin + `/ota/apk-manifest.json`.
  - **`CapacitorHttp` is enabled** (`capacitor.config.ts`): on native, `fetch`/XHR route through the native HTTP stack — required because the APK origin is `https://localhost`, which `mnema-ai.dco.tw` + Supabase don't CORS-allowlist. Don't assume browser fetch interceptor/streaming semantics hold on device.
  - Build for Android via `npm run cap:sync` — **don't set `VITE_BASE`** (the bundled app needs `base: '/'`).
- **Product DNA — BYO-AI:** users connect their *own* external AI through the Worker's MCP/REST write-path; there is **no in-app AI generation**. The app surfaces/attributes/reviews what the AI wrote (e.g. `created_via` provenance, AI chips). Don't add in-app generation features.
- **Deeper context:** **`docs/AI_DEV_WORKFLOW.md`** (the minimal workflow any AI must follow — typecheck → CI → merge auto-deploys to prod, no staging; verify with a throwaway Supabase test account) and **`docs/ADR.md`** (the 17 load-bearing architecture decisions + *why* — append-only; supersede with a new ADR, don't edit). Read both before non-trivial work. Also: `docs/UI_GUIDELINES.md` (full style guide); `docs/UIUX_POLISH_AUDIT.md` + `docs/PRODUCT_GAP_ANALYSIS.md` are status/planning docs — read for intent, not current API. Approved plans live in `.claude/plans/next-phase-plan.md` + `review-action-plan.md` (note: `README.md` points at `.claude/plans/woolly-greeting-whisper.md`, which does **not** exist; `docs/KNOWN_ISSUES.md` currently lists no open issues).

## Repo map

- **`src/`** — the React/Vite frontend (root npm package). Key spots: `src/lib/api.ts` (RPC wrappers), `src/lib/hooks.ts` (React Query), `src/router.tsx` (route tree), `src/components/app-shell/spaces.ts` (Spaces SSOT), `src/lib/database.types.ts` (generated, via `db:types`).
- **`worker/`** — the Cloudflare Worker AI access layer (**separate npm package**): `src/tools.ts` (the one registry), `src/db.ts` (`callRpc`/`ownedSelect`), `src/auth.ts`, `src/mcp.ts`, `src/rest.ts`, `src/scheduled.ts`, `wrangler.toml`, `.dev.vars`.
- **`shared/`** — `schemas.ts`, the Zod contract imported by both app (`@shared`) and worker (relative).
- **`supabase/migrations/`** — numbered, append-only SQL; each defines tables + their `SECURITY DEFINER` RPCs. `config.toml` `project_id` is only the local name.
- **`scripts/`** — Node release/ops scripts: `build-web.mjs`, `ota-publish.mjs`, `apk-release.mjs`, `apply-migrations.mjs`, `setup-test-user.mjs`.
- **`e2e/`** — Playwright specs + `auth.setup.ts`/`auth.teardown.ts` (excluded from Vitest).
