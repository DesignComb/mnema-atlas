# Mnema Atlas · 讀書筆記背誦閃卡

A study-notes flashcard app where **you don't add the content — an AI does**, by calling the app
as a *tool* (MCP server + REST API), not by embedding a chatbot. Notes become FSRS
spaced-repetition flashcards and connect into an Obsidian-style knowledge graph. Notion-clean UI.

- **Frontend**: React 19 · Vite 8 · TanStack Router/Query · Tailwind v4 · TipTap (markdown) · react-force-graph · ts-fsrs · motion
- **Backend**: Supabase (Postgres + Auth + RLS). Every write goes through shared `SECURITY DEFINER` RPCs.
- **AI access**: a Cloudflare Worker exposing an **MCP server** (`mcp-lite`) + a **REST API** (`hono`), both calling the same RPCs — so AI-added content is identical to UI-added content.

> Architecture & decisions: `.claude/plans/woolly-greeting-whisper.md`.

---

## 1. Prerequisites

- Node **≥ 20.19** (you have v24 ✓)
- A **Supabase** project (free tier) — or the Supabase CLI for a local stack
- *(For the AI worker)* a **Cloudflare** account + `wrangler` (already in `worker/`)

## 2. Run the app (frontend + database)

```bash
npm install

# Apply the schema to your Supabase project. Either:
#   a) Supabase CLI:   supabase link --project-ref <ref>   &&   supabase db push
#   b) Or paste supabase/migrations/0001_init.sql into the Supabase SQL editor and run it.

cp .env.example .env.local
#   VITE_SUPABASE_URL=...            (Project settings → API)
#   VITE_SUPABASE_PUBLISHABLE_KEY=...(the publishable / anon key — safe for the browser)

npm run dev          # http://localhost:5173
```

Sign up, create a deck, write a note, add flashcards, hit **Study** to review with FSRS, and open
**Graph** to see linked notes. (Email confirmation can be turned off in Supabase Auth settings for
quick local testing.)

## 3. Run the AI worker (MCP + REST)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
#   SUPABASE_URL=...
#   SUPABASE_SECRET_KEY=sb_secret_...   ← the SECRET/service key. Server-only. NEVER put in the browser.

npm run dev          # wrangler dev → http://localhost:8787
```

In the app, go to **Settings → API keys & MCP**, mint a key, then:

**REST** (any script / the Claude API):
```bash
curl -X POST http://localhost:8787/rest/create_flashcard \
  -H "Authorization: Bearer mk_your_key" -H "Content-Type: application/json" \
  -d '{"front":"What is FSRS?","back":"A modern spaced-repetition scheduling algorithm."}'
```

**MCP** (Claude Code / Cursor — accept a static Bearer):
```jsonc
// e.g. Claude Code: claude mcp add --transport http mnema-atlas http://localhost:8787/mcp \
//        --header "Authorization: Bearer mk_your_key"
```
The new card is immediately due and shows up in **Study** with `created_via = "mcp"`.

> **claude.ai web/desktop connector** accepts **OAuth 2.1 only** (no API-key field). Enabling it is
> Phase 3b — see `worker/README.md`.

## 4. Deploy

```bash
# Frontend → any static host (Cloudflare Pages / Vercel / Netlify). Set the VITE_* env vars there.
npm run build

# Worker
cd worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler deploy
# Then set VITE_MCP_URL / VITE_REST_URL in the frontend env so the Settings screen shows them.
```

## Project layout

```
src/            React app (routes, components, lib: supabase/api/srs/hooks/auth)
shared/         Zod schemas shared by the app AND the worker (single source of truth)
supabase/       migrations/0001_init.sql  (tables, RLS, shared write RPCs)
worker/         Cloudflare Worker: MCP server + REST API
.claude/plans/  the approved architecture & build plan
```

## Status

| Phase | What | State |
|---|---|---|
| 0 | Scaffold, design system, Supabase schema + RLS + RPCs | ✅ builds & typechecks |
| 1 | Auth, decks/notes CRUD, TipTap markdown editor | ✅ (needs Supabase to run) |
| 2 | Flashcards + FSRS study loop | ✅ (needs Supabase to run) |
| 3 | MCP server + REST (Bearer key) on the shared write path | ✅ builds & bundles |
| 3b | OAuth 2.1 for the claude.ai connector | ⏳ documented, not wired |
| 4 | Force-directed note graph | ✅ renders `note_links` |
| 4b | `[[wikilink]]` autocomplete that auto-creates links | ⏳ next |
| 5 | Editable mindmap (React Flow) + pgvector semantic search | ⏳ deferred |

> Phases 1–4 are implemented and **build/typecheck cleanly**, but have **not been run end-to-end**
> yet because that needs your Supabase project + env. Section 2 gets you there.
