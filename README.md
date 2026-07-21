# Mnema 🎙️ — talk to your life OS

A bilingual (EN / 繁中) multi-Space **"life OS" you drive with your own AI**.
For **OpenAI Build Week**, we used **Codex + GPT-5.6** to give it a **voice**.

- **Live:** https://mnema-atlas.dco.tw · **Repo:** https://github.com/DesignComb/mnema-atlas
- **AI endpoint:** https://mnema-ai.dco.tw (`/mcp`, `/rest`, `/llms.txt`)

---

## What Mnema already was

One React 19 + Vite + Supabase app hosting six Spaces — **Study, Travel, Tempo (tasks), Money, Health, Kitchen**. Its core idea is **BYO-AI**: there's no in-app chatbot — you connect your *own* AI (Claude, Cursor, a script) over **MCP + REST**, and it drives the app through **160 tools**. Every write — UI, MCP, or REST — goes through the *same* Postgres `SECURITY DEFINER` RPC, so **AI-added content is byte-identical to what you type by hand**.

## What Codex + GPT-5.6 added (Build Week)

A **voice assistant**: tap the mic, say one messy sentence, and **GPT-5.6** files it into the right Spaces.

> *One sentence → a trip in **Travel**, a reminder in **Tempo**, and an expense in **Money** — in a single request.*

- **Codex reused the existing registry instead of writing new code.** The Worker already turns each tool's **Zod** schema into JSON Schema (for its OpenAPI doc); Codex fed that *same* conversion into **GPT-5.6 function calling**. The voice path runs through the *same* `SECURITY DEFINER` RPC as everything else — **no new write path, RPC, schema, or migration.**
- **Runtime** (`worker/src/assistant.ts`): `model: 'gpt-5.6'` on `/v1/chat/completions`, `tool_choice: 'auto'`, a multi-round tool loop (≤ 6 rounds). Speech → text happens client-side via the **Web Speech API**, then the transcript is POSTed as `{ text }` to `/assistant`.
- **Constraints solved:** OpenAI's 128-function cap → send only the **120 write tools** (of 160); `reasoning_effort: 'none'` (required for GPT-5.6 tool calls on chat/completions); the user's ledger id is resolved **server-side** so it can log money without inventing an id.

**Codex-authored:** `worker/src/assistant.ts`, `src/components/app-shell/CaptureDialog.tsx`, `src/lib/assistant-spaces.ts` (+ `auth.ts`, `index.ts`, `endpoints.ts`). Build specs live in `.claude/plans/voice-*-codex.md`.

---

## Run it (two servers)

```bash
# frontend → http://localhost:5173
npm install && npm run dev
# worker: MCP + REST + /assistant → http://localhost:8787
cd worker && npm install && npm run dev
```

- **Frontend `.env.local`:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MCP_URL`, `VITE_REST_URL`
- **Worker `worker/.dev.vars`** (server-only): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY` (needed for `/assistant`)

**Stack:** React 19 · Vite · TypeScript · Supabase (Postgres + RLS) · Cloudflare Worker (Hono) · Zod · MCP (`mcp-lite`) · Tailwind v4 · Capacitor.
**Deploy:** push `main` → GitHub Actions → Cloudflare Worker (`mnema-ai.dco.tw`) + Pages (`mnema-atlas.dco.tw`).
